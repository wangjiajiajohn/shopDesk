"""Authenticated, owner-scoped read-only returns monitor."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Shop, User
from app.users.auth import current_user
from app.routers.tiktok_products import _get_authorized_shop
from app.services.tiktok.returns import fetch_pending_returns
from app.services.tiktok.client import TikTokAPIError
router = APIRouter(prefix='/api/tiktok', tags=['TikTok退货监控'])

@router.get('/return-monitor')
async def return_monitor(shop_id: str = 'ALL', db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    shops = (await db.execute(select(Shop).where(Shop.user_id == str(user.id)))).scalars().all()
    if shop_id != 'ALL':
        shops = [s for s in shops if s.id == shop_id]
        if not shops: raise HTTPException(404, '店铺不存在')
    items, total_records = [], 0
    for shop in shops:
        _, cred, token = await _get_authorized_shop(db, shop.id, user)
        try: pending, count = await fetch_pending_returns(token, cred.shop_cipher)
        except TikTokAPIError as exc:
            raise HTTPException(502, detail={'message': f'退货读取失败：{exc}', 'code': exc.code})
        total_records += count
        items.extend({**r, 'shop_id': shop.id, 'shop_name': shop.shop_name} for r in pending)
    items.sort(key=lambda r: (r['created_at'] or 0, r['return_id']))
    return {'items': items, 'total': len(items), 'total_records': total_records, 'snapshot_at': datetime.now(timezone.utc).isoformat()}
