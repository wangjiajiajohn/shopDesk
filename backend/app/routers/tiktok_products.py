"""TikTok 线上店铺商品：触发 Open API 同步落库 + 本地快照查询。"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Shop, ShopCredential, ShopProduct, User
from app.schemas import CategorySyncResult, ProductPage, ProductSyncResult, ShopProductResponse
from app.security import decrypt_token
from app.services.tiktok import categories as category_service
from app.services.tiktok.client import TikTokAPIError
from app.services.tiktok.products import ALLOWED_STATUSES, enrich_product_extras, fetch_all_products
from app.users.auth import current_user

router = APIRouter(prefix="/api/tiktok", tags=["TikTok店铺商品"])


async def _ensure_category_dict(
    db: AsyncSession, shop: Shop, cred: ShopCredential, access_token: str
) -> None:
    """商品中文树依赖类目字典；该 region 缺失时自动拉取一次（同区域多店铺共享缓存）。"""
    category_dict = await category_service.get_category_dict(db, shop.market_code)
    if category_dict:
        return
    nodes = await category_service.fetch_categories(access_token, cred.shop_cipher)
    await category_service.upsert_category_dict(db, shop.market_code, nodes)


async def _get_authorized_shop(
    db: AsyncSession, shop_id: str, user: User
) -> tuple[Shop, ShopCredential, str]:
    """校验店铺与授权状态，返回 (店铺, 凭证, 解密 access_token)。"""
    shop = await db.get(Shop, shop_id)
    if not shop or shop.user_id != str(user.id):
        raise HTTPException(status_code=404, detail=f"店铺不存在: {shop_id}")

    result = await db.execute(
        select(ShopCredential).where(ShopCredential.shop_id == shop_id)
    )
    cred = result.scalar_one_or_none()
    if not cred or not cred.access_token_encrypted:
        raise HTTPException(status_code=400, detail="该店铺尚未授权，请先录入并校验 TikTok token")
    if cred.auth_status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"店铺授权状态为 {cred.auth_status}，请先在授权管理中恢复有效授权",
        )
    if not cred.shop_cipher:
        raise HTTPException(status_code=400, detail="凭证缺少 shop_cipher，请重新校验授权")

    try:
        access_token = decrypt_token(cred.access_token_encrypted)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=f"access_token 解密失败: {exc}")
    return shop, cred, access_token


@router.post("/shops/{shop_id}/categories/sync", response_model=CategorySyncResult)
async def sync_shop_categories(
    shop_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """拉取该店铺所在 region 的 zh-CN 官方类目字典并落库（同区域多店铺共享缓存）。"""
    shop, cred, access_token = await _get_authorized_shop(db, shop_id, user)
    try:
        nodes = await category_service.fetch_categories(access_token, cred.shop_cipher)
        stats = await category_service.upsert_category_dict(db, shop.market_code, nodes)
    except TikTokAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": f"TikTok 类目拉取失败: {exc.args[0] if exc.args else exc}",
                "code": getattr(exc, "code", -1),
                "request_id": getattr(exc, "request_id", ""),
            },
        )
    return CategorySyncResult(
        region=shop.market_code,
        locale=category_service.ZH_LOCALE,
        total=stats["total"],
        created=stats["created"],
        updated=stats["updated"],
        synced_at=stats["synced_at"],
    )


@router.post("/shops/{shop_id}/products/sync", response_model=ProductSyncResult)
async def sync_shop_products(
    shop_id: str,
    status: str = Query("ALL", description="商品状态过滤"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """从 TikTok Open API 全量拉取该店铺商品，按 (shop_id, tiktok_product_id) upsert 落库。"""
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"不支持的状态过滤: {status}")

    shop, cred, access_token = await _get_authorized_shop(db, shop_id, user)

    # 确保中文类目字典就绪；失败不阻断商品同步主流程（列表类目树会回退为空）
    try:
        await _ensure_category_dict(db, shop, cred, access_token)
    except TikTokAPIError:
        pass

    try:
        items = await fetch_all_products(access_token, cred.shop_cipher, status)
    except TikTokAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": f"TikTok 商品拉取失败: {exc.args[0] if exc.args else exc}",
                "code": getattr(exc, "code", -1),
                "request_id": getattr(exc, "request_id", ""),
            },
        )

    # 现有快照按 tiktok_product_id 建索引，做 upsert
    existing_result = await db.execute(
        select(ShopProduct).where(ShopProduct.shop_id == shop_id)
    )
    existing_map = {row.tiktok_product_id: row for row in existing_result.scalars().all()}

    now = datetime.utcnow()
    created = 0
    updated = 0
    for item in items:
        row = existing_map.get(item["tiktok_product_id"])
        if row is None:
            db.add(ShopProduct(shop_id=shop_id, synced_at=now, **item))
            created += 1
        else:
            for key, value in item.items():
                setattr(row, key, value)
            row.synced_at = now
            updated += 1

    await db.commit()

    # 详情扩展补全：搜索接口不返回图片与类目，仅对缺图或缺类目的商品调详情接口（已补全的不重复拉取）
    missing_result = await db.execute(
        select(ShopProduct.tiktok_product_id).where(
            ShopProduct.shop_id == shop_id,
            (ShopProduct.main_image_url.is_(None)) | (ShopProduct.category_id.is_(None)),
        )
    )
    missing_ids = [row[0] for row in missing_result.all()]
    image_fetched = 0
    image_errors = 0
    if missing_ids:
        extras_map = await enrich_product_extras(access_token, cred.shop_cipher, missing_ids)
        image_errors = len(extras_map.pop("_errors"))
        rows_result = await db.execute(
            select(ShopProduct).where(ShopProduct.shop_id == shop_id)
        )
        for row in rows_result.scalars().all():
            payload = extras_map.get(row.tiktok_product_id)
            if payload:
                row.main_image_url = payload["main_image_url"]
                row.main_image_large_url = payload["main_image_large_url"]
                row.category_id = payload["category_id"]
                row.category_name = payload["category_name"]
                row.category_path = payload["category_path"]
                if payload["main_image_url"]:
                    image_fetched += 1
        await db.commit()

    return ProductSyncResult(
        shop_id=shop_id,
        status_filter=status,
        fetched=len(items),
        created=created,
        updated=updated,
        image_fetched=image_fetched,
        image_errors=image_errors,
        synced_at=now,
    )


@router.get("/shops/{shop_id}/products", response_model=ProductPage)
async def list_shop_products(
    shop_id: str,
    status: Optional[str] = Query(None, description="按 TikTok 状态过滤"),
    category_id: Optional[str] = Query(None, description="按官方类目 ID 过滤：叶子精确命中，中间节点命中整棵子树"),
    q: Optional[str] = Query(None, description="按标题搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """分页查询某店铺已同步的商品快照，同时返回全量状态计数与在用中文类目树。"""
    shop = await db.get(Shop, shop_id)
    if not shop or shop.user_id != str(user.id):
        raise HTTPException(status_code=404, detail=f"店铺不存在: {shop_id}")
    category_dict = await category_service.get_category_dict(db, shop.market_code)

    base_filters = [ShopProduct.shop_id == shop_id]
    if status:
        if status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"不支持的状态过滤: {status}")
        base_filters.append(ShopProduct.status == status)
    if category_id:
        # 中间节点展开为整棵子树的叶子 ID 集合，IN 精确匹配，不依赖字符串拼接
        leaf_ids = category_service.collect_subtree_leaf_ids(category_dict, category_id)
        base_filters.append(ShopProduct.category_id.in_(leaf_ids))
    if q:
        base_filters.append(ShopProduct.title.contains(q))

    total = (await db.execute(
        select(func.count(ShopProduct.id)).where(*base_filters)
    )).scalar_one()

    rows = (await db.execute(
        select(ShopProduct)
        .where(*base_filters)
        .order_by(ShopProduct.tiktok_update_time.desc().nullslast(), ShopProduct.title.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    # 全量状态计数（只限定店铺，不受当前状态/类目/关键词筛选影响，供 tab 角标使用）
    status_rows = (await db.execute(
        select(ShopProduct.status, func.count(ShopProduct.id))
        .where(ShopProduct.shop_id == shop_id)
        .group_by(ShopProduct.status)
    )).all()
    status_counts = {row[0]: row[1] for row in status_rows}

    # 店铺在用叶子（仅 ID+计数，跟随 status 口径），再用官方 parent_id 字典重建中文树
    category_filters = [ShopProduct.shop_id == shop_id, ShopProduct.category_id.is_not(None)]
    if status:
        category_filters.append(ShopProduct.status == status)
    leaf_rows = (await db.execute(
        select(ShopProduct.category_id, func.count(ShopProduct.id))
        .where(*category_filters)
        .group_by(ShopProduct.category_id)
    )).all()
    leaf_counts = {row[0]: row[1] for row in leaf_rows}
    category_tree = category_service.build_inuse_tree(category_dict, leaf_counts)

    # 列表项补中文类目名（西语原名仍保留在 category_name/category_path）
    items = []
    for row in rows:
        resp = ShopProductResponse.model_validate(row)
        if row.category_id and row.category_id in category_dict:
            resp.category_name_zh = category_dict[row.category_id].local_name
        items.append(resp)

    return ProductPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        status_counts=status_counts,
        category_tree=category_tree,
    )


@router.get("/products", response_model=List[ShopProductResponse])
async def list_all_products(
    shop_id: Optional[str] = Query(None, description="可选：限定店铺"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """跨店查询本地商品快照（多店汇总场景），仅返回当前用户店铺的数据。"""
    query = select(ShopProduct).join(Shop, ShopProduct.shop_id == Shop.id).filter(Shop.user_id == str(user.id))
    if shop_id:
        query = query.where(ShopProduct.shop_id == shop_id)
    query = query.order_by(ShopProduct.synced_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
