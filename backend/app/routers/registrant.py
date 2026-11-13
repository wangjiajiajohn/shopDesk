"""店铺注册人资料路由（按店铺隔离）。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..users.auth import current_user
from ..models import User, RegistrantProfile
from .shops import get_owned_shop

router = APIRouter(prefix="/api/registrant", tags=["注册人资料"])


class RegistrantUpdate(BaseModel):
    identity_fields: list = []
    tax_fields: list = []


@router.get("")
async def get_registrant(
    shop_id: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """获取指定店铺的注册人资料，没有则返回空。"""
    shop = await get_owned_shop(db, user, shop_id)
    p = (await db.execute(
        select(RegistrantProfile).where(
            RegistrantProfile.user_id == str(user.id),
            RegistrantProfile.shop_id == shop.id,
        )
    )).scalar_one_or_none()
    if not p:
        return {"identity_fields": [], "tax_fields": []}
    return {"identity_fields": p.identity_fields or [], "tax_fields": p.tax_fields or []}


@router.put("")
async def update_registrant(
    data: RegistrantUpdate,
    shop_id: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """更新指定店铺的注册人资料（upsert）。"""
    shop = await get_owned_shop(db, user, shop_id)
    p = (await db.execute(
        select(RegistrantProfile).where(
            RegistrantProfile.user_id == str(user.id),
            RegistrantProfile.shop_id == shop.id,
        )
    )).scalar_one_or_none()
    if not p:
        p = RegistrantProfile(user_id=str(user.id), shop_id=shop.id)
        db.add(p)
    p.identity_fields = data.identity_fields
    p.tax_fields = data.tax_fields
    await db.commit()
    return {"ok": True}
