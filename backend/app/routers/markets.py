from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models import Market
from ..schemas import MarketCreate, MarketResponse

router = APIRouter(prefix="/api/markets", tags=["国家市场"])

@router.get("", response_model=List[MarketResponse])
async def list_markets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Market))
    return result.scalars().all()

@router.post("", response_model=MarketResponse)
async def create_market(market_in: MarketCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.get(Market, market_in.country_code)
    if existing:
        raise HTTPException(status_code=400, detail="该国家代码已存在")
    market = Market(**market_in.model_dump())
    db.add(market)
    await db.commit()
    await db.refresh(market)
    return market
