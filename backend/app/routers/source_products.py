from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from ..database import get_db
from ..models import ProductAsset, SourceProduct, SourceProductSku, Supplier, User
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
    return [enrich_product_calc(p) for p in products]

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
    return enrich_product_calc(product)

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
