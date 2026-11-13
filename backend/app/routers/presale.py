"""预销售清单（账号级选品结果）。

只维护"账号 ↔ 货源 SPU"的关联，不复制商品数据。爬虫下架/删除货源不级联清理，
失效状态由货源自身的 is_active 字段体现。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_db
from ..models import PresalePick, SourceProduct, User
from ..schemas import SourceProductResponse
from ..users.auth import current_user
from .source_products import _annotate_pick, _picked_product_ids

router = APIRouter(prefix="/api/presale-picks", tags=["预销售清单"])


@router.get("", response_model=List[SourceProductResponse])
async def list_presale_picks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """当前账号的预销售清单，按加入时间倒序。"""
    result = await db.execute(
        select(SourceProduct)
        .join(PresalePick, PresalePick.source_product_id == SourceProduct.id)
        .options(
            selectinload(SourceProduct.supplier),
            selectinload(SourceProduct.skus),
            selectinload(SourceProduct.assets),
        )
        .where(PresalePick.user_id == str(user.id))
        .order_by(PresalePick.created_at.desc())
    )
    products = result.scalars().all()
    picked_ids = await _picked_product_ids(db, str(user.id))
    return _annotate_pick(products, picked_ids)


@router.post("/{product_id}", response_model=SourceProductResponse, status_code=201)
async def add_presale_pick(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    product = await db.get(SourceProduct, product_id)
    if not product or product.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="货源商品不存在")

    existing = (
        await db.execute(
            select(PresalePick).where(
                PresalePick.user_id == str(user.id),
                PresalePick.source_product_id == product_id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(PresalePick(user_id=str(user.id), source_product_id=product_id))
        await db.commit()

    query = select(SourceProduct).options(
        selectinload(SourceProduct.supplier),
        selectinload(SourceProduct.skus),
        selectinload(SourceProduct.assets),
    ).filter(SourceProduct.id == product_id)
    loaded = (await db.execute(query)).scalar_one()
    return _annotate_pick([loaded], {product_id})[0]


@router.delete("/{product_id}")
async def remove_presale_pick(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    pick = (
        await db.execute(
            select(PresalePick).where(
                PresalePick.user_id == str(user.id),
                PresalePick.source_product_id == product_id,
            )
        )
    ).scalar_one_or_none()
    if pick is not None:
        await db.delete(pick)
        await db.commit()
    return {"success": True, "message": "已移出预销售清单"}
