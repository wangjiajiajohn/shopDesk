import asyncio
from app.database import AsyncSessionLocal, engine, Base
from app.models import Market
from sqlalchemy.future import select

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 预置基础市场配置（系统运行必需的参考数据，非业务 mock）
        res = await session.execute(select(Market).filter(Market.country_code == "MX"))
        mx_market = res.scalars().first()
        if not mx_market:
            mx_market = Market(
                country_code="MX",
                name="墨西哥",
                default_language="es",
                currency="MXN",
                exchange_rate_cny=2.75,
                platform_commission_rate=0.08
            )
            session.add(mx_market)
            await session.commit()
            print("✓ 已预置市场: 🇲🇽 墨西哥 (MX / es / MXN)")

        # 店铺、供应商、货源商品均由用户在界面真实录入，不预置任何演示数据

if __name__ == "__main__":
    asyncio.run(seed())
