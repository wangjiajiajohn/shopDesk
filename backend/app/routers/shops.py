from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import Market, Shop, User
from ..schemas import ShopCreate, ShopResponse
from ..users.auth import current_user

router = APIRouter(prefix="/api/shops", tags=["店铺管理"])


async def get_owned_shop(db: AsyncSession, user: User, shop_id: str = None) -> Shop:
    """校验店铺归属；兼容单店铺账号未传 shop_id 的旧调用。"""
    if shop_id:
        shop = await db.get(Shop, shop_id)
        if not shop or shop.user_id != str(user.id):
            raise HTTPException(status_code=404, detail="店铺不存在")
        return shop
    shops = (await db.execute(
        select(Shop).filter(Shop.user_id == str(user.id)).order_by(Shop.created_at, Shop.id)
    )).scalars().all()
    if len(shops) != 1:
        raise HTTPException(status_code=400, detail="请选择店铺")
    return shops[0]


@router.get("", response_model=List[ShopResponse])
async def list_shops(
    market_code: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    query = select(Shop).filter(Shop.user_id == str(user.id)).order_by(Shop.created_at, Shop.id)
    if market_code:
        query = query.filter(Shop.market_code == market_code)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=ShopResponse)
async def create_shop(
    shop_in: ShopCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    # 验证关联市场存在
    market = await db.get(Market, shop_in.market_code)
    if not market:
        raise HTTPException(status_code=400, detail="指定的国家市场不存在")

    # 验证 tiktok_shop_id 唯一
    result = await db.execute(select(Shop).filter(Shop.tiktok_shop_id == shop_in.tiktok_shop_id))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="该 TikTok Shop ID 已绑定")

    shop = Shop(**shop_in.model_dump(), user_id=str(user.id))
    db.add(shop)
    await db.commit()
    await db.refresh(shop)
    return shop

@router.delete("/{shop_id}")
async def delete_shop(
    shop_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    shop = await db.get(Shop, shop_id)
    if not shop or shop.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="店铺不存在")
    await db.delete(shop)
    await db.commit()
    return {"success": True, "message": "店铺已成功解绑"}
