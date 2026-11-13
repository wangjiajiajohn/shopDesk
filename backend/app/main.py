from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .migrations import run_sqlite_migrations
from .routers import markets, shops, suppliers, source_products, tiktok_auth, resources, tiktok_products, tiktok_orders, tiktok_categories, ai, auth
from .services.ai.client import ai_client

app = FastAPI(
    title="ShopDesk - TikTok跨境电商工作台 API",
    version="1.0.0",
    description="提供国家市场管理、动态店铺绑定、货源阶梯成本CRUD等接口"
)

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(markets.router)
app.include_router(shops.router)
app.include_router(suppliers.router)
app.include_router(source_products.router)
app.include_router(tiktok_auth.router)
app.include_router(tiktok_products.router)
app.include_router(tiktok_categories.router)
app.include_router(tiktok_orders.router)
app.include_router(resources.router)
app.include_router(ai.router)
app.include_router(auth.router)

@app.on_event("startup")
async def startup_event():
    # 先执行 SQLite 轻量迁移（补列/空表重建），再自动创建新表
    migration_changes = await run_sqlite_migrations()
    if migration_changes:
        print("[migrations]", "; ".join(migration_changes))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event("shutdown")
async def shutdown_event():
    await ai_client.aclose()

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ShopDesk Backend",
        "version": "1.0.0"
    }

from app.routers import tiktok_returns
app.include_router(tiktok_returns.router)
