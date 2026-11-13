from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from ..database import get_db
from ..models import PresalePick, ProductAsset, SourceProduct, SourceProductSku, Supplier, User
from ..schemas import (
    ProductAssetResponse,
    SourceProductCreate,
    SourceProductResponse,
    SourceProductSkuCreate,
    SourceProductSkuResponse,
    SourceProductSkuUpdate,
    SourceProductUpdate,
)
from ..users.auth import current_user

router = APIRouter(prefix="/api/source-products", tags=["货源商品库"])


async def _sync_spu_stock(db: AsyncSession, product_id: str) -> None:
    """SKU 库存变动后，把 SPU 库存刷新为变体库存合计。"""
    result = await db.execute(
        select(SourceProductSku.stock_quantity).where(
            SourceProductSku.source_product_id == product_id
        )
    )
    total = sum(row[0] for row in result.all())
    spu = await db.get(SourceProduct, product_id)
    if spu:
        spu.stock_quantity = total

def enrich_product_calc(product: SourceProduct) -> SourceProductResponse:
    """计算体积重、抛货标记以及阶梯折扣率"""
    res = SourceProductResponse.model_validate(product)
    
    # 包装体积 (cm3)
    l = product.package_length_cm or 0
    w = product.package_width_cm or 0
    h = product.package_height_cm or 0
    vol = round(l * w * h, 1)
    res.volume_cm3 = vol

    # 国际货运标准体积重 (L*W*H / 6000 克)
    vol_weight = round((vol / 6000.0) * 1000, 1)
    res.volume_weight_g = vol_weight
    res.is_bulky = vol_weight > (product.weight_g or 0)

    # 阶梯价折扣计算（一口价供应商无阶梯价，返回 0）
    p1 = product.price_tier_1
    if p1 and p1 > 0 and product.price_tier_2 is not None and product.price_tier_3 is not None:
        res.tier_2_discount_percent = round(((p1 - product.price_tier_2) / p1) * 100, 1)
        res.tier_3_discount_percent = round(((p1 - product.price_tier_3) / p1) * 100, 1)
    else:
        res.tier_2_discount_percent = 0.0
        res.tier_3_discount_percent = 0.0

    return res


async def _picked_product_ids(db: AsyncSession, user_id: str) -> set:
    """当前账号加入预销售清单的货源 SPU id 集合。"""
    result = await db.execute(
        select(PresalePick.source_product_id).where(PresalePick.user_id == user_id)
    )
    return {row[0] for row in result.all()}


def _annotate_pick(products: List[SourceProduct], picked_ids: set) -> List[SourceProductResponse]:
    responses = [enrich_product_calc(p) for p in products]
    for res in responses:
        res.is_picked = res.id in picked_ids
    return responses

def _source_issue_types(data, chart):
    if not data:
        return []
    types = {"source_records" if i.get("field") in {"source_layout", "source_column_mismatch", "source_skc"} else i.get("field") for i in data.get("issues", [])}
    if not any(a.get("role") in {"size_chart", "size_diagram"} for a in data.get("assets", [])) and not any((chart or {}).get(k) for k in ("original_image", "original_images", "rows")):
        types.add("missing_chart")
    if any(e.get("kind") == "ocr_text" and e.get("status") not in {"reviewed", "verified"} for e in data.get("extractions", [])):
        types.add("ocr_review")
    if data.get("raw_photo_links"):
        types.add("photo_links")
    return sorted(t for t in types if t)


@router.get("/page")
async def source_product_page(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str = "", category: str = "ALL", supplier_id: str = "ALL", issue: str = "ALL", queue_only: bool = False,
    db: AsyncSession = Depends(get_db), user: User = Depends(current_user),
):
    # Read only list columns; never serialize raw cells, OCR or full asset/SKU objects.
    fields = ["id", "title", "sku_code", "category_name", "supplier_id", "main_image", "supply_price", "supply_currency", "specs", "source_data", "size_chart"]
    query = select(*(getattr(SourceProduct, f) for f in fields)).where(SourceProduct.user_id == str(user.id)).order_by(SourceProduct.created_at.desc(), SourceProduct.id)
    rows = (await db.execute(query)).mappings().all()
    supplier_rows = (await db.execute(select(Supplier.id, Supplier.name).where(Supplier.user_id == str(user.id)))).all()
    supplier_names = dict(supplier_rows)
    picked_ids = await _picked_product_ids(db, str(user.id))
    categories, counts, issue_counts, matches = [], {}, {}, []
    source_order = []
    supplier_total = 0
    for row in rows:
        if queue_only and row["id"] not in picked_ids:
            continue
        d = dict(row); data = d.pop("source_data") or {}; chart = d.pop("size_chart")
        source_order.extend(c for c in data.get("category_order", []) if c not in source_order)
        cats = list(dict.fromkeys(c for c in [d["category_name"], *data.get("category_memberships", [])] if c))
        if supplier_id != "ALL" and d["supplier_id"] != supplier_id:
            continue
        categories.extend(c for c in cats if c not in categories)
        supplier_total += 1
        for c in cats:
            counts[c] = counts.get(c, 0) + 1
        if category != "ALL" and category not in cats:
            continue
        types = _source_issue_types(data, chart)
        for t in types:
            issue_counts[t] = issue_counts.get(t, 0) + 1
        if issue != "ALL" and not (bool(types) if issue == "ANY" else issue in types):
            continue
        name = supplier_names.get(d["supplier_id"], "")
        if q.strip() and q.strip().lower() not in " ".join([d["title"] or "", d["sku_code"] or "", name, str(data.get("raw_cells", []))]).lower():
            continue
        d["is_picked"] = d["id"] in picked_ids
        d["supplier"] = {"name": name}
        d["source_data"] = {k: data[k] for k in ("issues", "price_unit", "pack_quantity") if k in data}
        matches.append(d)
    categories.sort(key=lambda c: source_order.index(c) if c in source_order else len(source_order))
    total = len(matches)
    page = min(page, max(1, (total + page_size - 1) // page_size))
    return {"items": matches[(page-1)*page_size:page*page_size], "total": total, "page": page, "page_size": page_size, "catalog_total": len(rows), "queue_total": sum(r["id"] in picked_ids and (supplier_id == "ALL" or r["supplier_id"] == supplier_id) for r in rows), "supplier_total": supplier_total, "categories": categories, "category_counts": counts, "issue_counts": issue_counts}


@router.post("/sales-queue")
async def update_sales_queue(
    product_ids: List[str] = Body(...), operation: str = Query("add", pattern="^(add|remove)$"),
    db: AsyncSession = Depends(get_db), user: User = Depends(current_user),
):
    ids = list(dict.fromkeys(product_ids))
    if not ids or len(ids) > 100:
        raise HTTPException(status_code=400, detail="每次请选择1至100款商品")
    owned = set((await db.execute(select(SourceProduct.id).where(SourceProduct.user_id == str(user.id), SourceProduct.id.in_(ids)))).scalars().all())
    if owned != set(ids):
        raise HTTPException(status_code=404, detail="部分货源商品不存在")
    existing = (await db.execute(select(PresalePick).where(PresalePick.user_id == str(user.id), PresalePick.source_product_id.in_(ids)))).scalars().all()
    existing_ids = {p.source_product_id for p in existing}
    if operation == "add":
        for product_id in ids:
            if product_id not in existing_ids:
                db.add(PresalePick(user_id=str(user.id), source_product_id=product_id))
    else:
        for pick in existing:
            await db.delete(pick)
    await db.commit()
    return {"success": True, "changed": len(set(ids)-existing_ids) if operation == "add" else len(existing)}


@router.get("", response_model=List[SourceProductResponse])
async def list_source_products(
    q: Optional[str] = Query(None, description="搜索标题或货号"),
    category: Optional[str] = Query(None, description="按类目过滤"),
    supplier_id: Optional[str] = Query(None, description="按供应商过滤"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    query = select(SourceProduct).options(
        selectinload(SourceProduct.supplier),
        selectinload(SourceProduct.skus),
        selectinload(SourceProduct.assets),
    ).filter(SourceProduct.user_id == str(user.id)).order_by(SourceProduct.created_at.desc())
    if q:
        query = query.filter((SourceProduct.title.contains(q)) | (SourceProduct.sku_code.contains(q)))
    if category:
        query = query.filter(SourceProduct.category_name == category)
    if supplier_id:
        query = query.filter(SourceProduct.supplier_id == supplier_id)

    result = await db.execute(query)
    products = result.scalars().all()
    picked_ids = await _picked_product_ids(db, str(user.id))
    return _annotate_pick(products, picked_ids)

@router.post("", response_model=SourceProductResponse)
async def create_source_product(
    product_in: SourceProductCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    # 校验货号唯一性
    exist = await db.execute(select(SourceProduct).filter(SourceProduct.sku_code == product_in.sku_code))
    if exist.scalars().first():
        raise HTTPException(status_code=400, detail="商品货号 (SKU) 已存在")

    # 校验阶梯价逻辑：p1 >= p2 >= p3（三档都填才校验；一口价供应商可整组留空）
    tiers = (product_in.price_tier_1, product_in.price_tier_2, product_in.price_tier_3)
    if any(t is not None for t in tiers):
        if any(t is None for t in tiers):
            raise HTTPException(status_code=400, detail="阶梯价需三档同时填写，或整组留空改用 SKU 一口价")
        if not (tiers[0] >= tiers[1] >= tiers[2]):
            raise HTTPException(status_code=400, detail="阶梯成本价必须满足：1件价 ≥ 2件价 ≥ 3件价")

    product = SourceProduct(**product_in.model_dump(), user_id=str(user.id))
    db.add(product)
    await db.commit()
    await db.refresh(product)

    # 重新加载关联
    query = select(SourceProduct).options(
        selectinload(SourceProduct.supplier),
        selectinload(SourceProduct.skus),
        selectinload(SourceProduct.assets),
    ).filter(SourceProduct.id == product.id)
    result = await db.execute(query)
    loaded = result.scalar_one()
    return enrich_product_calc(loaded)

@router.get("/{product_id}", response_model=SourceProductResponse)
async def get_source_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    query = select(SourceProduct).options(
        selectinload(SourceProduct.supplier),
        selectinload(SourceProduct.skus),
        selectinload(SourceProduct.assets),
    ).filter(SourceProduct.id == product_id, SourceProduct.user_id == str(user.id))
    result = await db.execute(query)
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    picked_ids = await _picked_product_ids(db, str(user.id))
    return _annotate_pick([product], picked_ids)[0]

@router.put("/{product_id}", response_model=SourceProductResponse)
async def update_source_product(
    product_id: str,
    product_in: SourceProductUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    query = select(SourceProduct).options(
        selectinload(SourceProduct.supplier),
        selectinload(SourceProduct.skus),
        selectinload(SourceProduct.assets),
    ).filter(SourceProduct.id == product_id, SourceProduct.user_id == str(user.id))
    result = await db.execute(query)
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    update_data = product_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    await db.commit()
    await db.refresh(product)
    return enrich_product_calc(product)

@router.delete("/{product_id}")
async def delete_source_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="商品不存在")
    await db.delete(product)
    await db.commit()
    return {"success": True, "message": "商品已成功删除"}


# ----------------- SKU 变体子资源 -----------------
@router.get("/{product_id}/skus", response_model=List[SourceProductSkuResponse])
async def list_product_skus(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    # 校验商品归属
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="货源商品不存在")
    result = await db.execute(
        select(SourceProductSku)
        .where(SourceProductSku.source_product_id == product_id)
        .order_by(SourceProductSku.sort_order)
    )
    return result.scalars().all()


@router.post("/{product_id}/skus", response_model=SourceProductSkuResponse, status_code=201)
async def create_product_sku(
    product_id: str,
    sku_in: SourceProductSkuCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="货源商品不存在")
    dup = (
        await db.execute(select(SourceProductSku).where(SourceProductSku.sku_code == sku_in.sku_code))
    ).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=400, detail="SKU 编码已存在")

    sku = SourceProductSku(source_product_id=product_id, **sku_in.model_dump())
    db.add(sku)
    await db.commit()
    await db.refresh(sku)
    await _sync_spu_stock(db, product_id)
    await db.commit()
    return sku


@router.put("/{product_id}/skus/{sku_id}", response_model=SourceProductSkuResponse)
async def update_product_sku(
    product_id: str,
    sku_id: str,
    sku_in: SourceProductSkuUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="货源商品不存在")
    sku = await db.get(SourceProductSku, sku_id)
    if not sku or sku.source_product_id != product_id:
        raise HTTPException(status_code=404, detail="SKU 不存在")
    for key, value in sku_in.model_dump(exclude_unset=True).items():
        setattr(sku, key, value)
    await db.commit()
    await db.refresh(sku)
    await _sync_spu_stock(db, product_id)
    await db.commit()
    return sku


@router.delete("/{product_id}/skus/{sku_id}")
async def delete_product_sku(
    product_id: str,
    sku_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="货源商品不存在")
    sku = await db.get(SourceProductSku, sku_id)
    if not sku or sku.source_product_id != product_id:
        raise HTTPException(status_code=404, detail="SKU 不存在")
    await db.delete(sku)
    await db.commit()
    await _sync_spu_stock(db, product_id)
    await db.commit()
    return {"success": True, "message": "SKU 已删除"}


# ----------------- 素材只读 -----------------
@router.get("/{product_id}/assets", response_model=List[ProductAssetResponse])
async def list_product_assets(
    product_id: str,
    role: Optional[str] = Query(None, description="按素材角色过滤 main/sub/sku/detail"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="货源商品不存在")
    query = select(ProductAsset).where(ProductAsset.source_product_id == product_id)
    if role:
        query = query.filter(ProductAsset.role == role)
    result = await db.execute(query.order_by(ProductAsset.role, ProductAsset.sort_order))
    return result.scalars().all()
