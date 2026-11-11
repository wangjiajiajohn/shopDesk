from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import Supplier, User
from ..schemas import SupplierCreate, SupplierResponse
from ..users.auth import current_user

router = APIRouter(prefix="/api/suppliers", tags=["供应商管理"])

@router.get("", response_model=List[SupplierResponse])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    result = await db.execute(
        select(Supplier)
        .filter(Supplier.user_id == str(user.id))
        .order_by(Supplier.created_at.desc())
    )
    return result.scalars().all()

@router.post("", response_model=SupplierResponse)
async def create_supplier(
    supplier_in: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    supplier = Supplier(**supplier_in.model_dump(), user_id=str(user.id))
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    supplier_in: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier or supplier.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="供应商不存在")
    for key, value in supplier_in.model_dump().items():
        setattr(supplier, key, value)
    await db.commit()
    await db.refresh(supplier)
    return supplier

@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier or supplier.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="供应商不存在")
    await db.delete(supplier)
    await db.commit()
    return {"success": True, "message": "供应商已删除"}
