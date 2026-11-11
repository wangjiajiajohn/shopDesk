"""TikTok 官方类目字典查询：纯本地缓存读取，不调 Open API、不依赖店铺凭证。"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.tiktok import categories as category_service

router = APIRouter(prefix="/api/tiktok/categories", tags=["TikTok类目字典"])


@router.get("/tree")
async def get_category_tree(
    region: str = Query("MX", description="站点区域码，如 MX"),
    db: AsyncSession = Depends(get_db),
):
    """返回某 region 的完整 zh-CN 类目树（创建商品选择类目用）。

    数据来自本地 tiktok_categories 缓存；未同步时返回 404，引导先调 categories/sync。
    """
    category_dict = await category_service.get_category_dict(db, region)
    if not category_dict:
        raise HTTPException(
            status_code=404,
            detail=f"区域 {region} 的类目字典尚未同步，请先在 TikTok 商品页点击「更新类目」",
        )
    tree = category_service.build_full_tree(category_dict)
    return {
        "region": region,
        "locale": category_service.ZH_LOCALE,
        "total": len(category_dict),
        "tree": tree,
    }
