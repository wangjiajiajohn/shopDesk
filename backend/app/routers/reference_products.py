"""参考商品路由（按用户隔离）。"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..users.auth import current_user
from ..models import User, ReferenceDataset, ReferenceProduct

router = APIRouter(prefix="/api/reference-products", tags=["参考商品"])


def assign_material_numbers(products):
    """Stable account-local numbers, independent of category/rank/page order."""
    used = set()
    pending = []
    changed = False
    for product in products:
        number = (product.index_data or {}).get("materialNumber")
        if isinstance(number, int) and not isinstance(number, bool) and number > 0 and number not in used:
            used.add(number)
            if (product.detail_data or {}).get("materialNumber") != number:
                product.detail_data = {**(product.detail_data or {}), "materialNumber": number}
                changed = True
        else:
            pending.append(product)
    next_number = max(used, default=0) + 1
    for product in pending:
        product.index_data = {**(product.index_data or {}), "materialNumber": next_number}
        product.detail_data = {**(product.detail_data or {}), "materialNumber": next_number}
        next_number += 1
        changed = True
    return changed


async def _number_account_products(db, user_id):
    products = (await db.execute(select(ReferenceProduct).where(
        ReferenceProduct.user_id == str(user_id)
    ).order_by(ReferenceProduct.created_at.asc(), ReferenceProduct.id.asc()))).scalars().all()
    if assign_material_numbers(products):
        await db.commit()
    return products


@router.get("/index")
async def get_reference_index(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """返回当前用户的参考商品索引（合并 items + categories）。"""
    ds = (await db.execute(
        select(ReferenceDataset).where(ReferenceDataset.user_id == str(user.id))
    )).scalar_one_or_none()

    if not ds:
        return {"schemaVersion": 1, "items": [], "categories": []}

    products = await _number_account_products(db, user.id)
    products = [p for p in products if p.dataset_id == ds.id]

    items = [p.index_data for p in products]
    return {
        "schemaVersion": 1,
        "datasetId": ds.dataset_id,
        "market": ds.market,
        "capturedAt": ds.captured_at,
        "categories": ds.categories or [],
        "items": items,
    }


@router.get("/{product_id}")
async def get_reference_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """返回当前用户下指定参考商品的详情。"""
    p = (await db.execute(
        select(ReferenceProduct).where(
            ReferenceProduct.user_id == str(user.id),
            ReferenceProduct.product_id == product_id,
        )
    )).scalar_one_or_none()

    if not p:
        raise HTTPException(status_code=404, detail="参考商品不存在")
    if not (p.index_data or {}).get("materialNumber"):
        await _number_account_products(db, user.id)
    return p.detail_data
