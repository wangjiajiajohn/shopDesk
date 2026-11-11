"""TikTok 线上订单：Open API 同步落库 + 首页 GMV 聚合 + 本地订单查询。"""
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Shop, ShopOrder, ShopProduct, User
from app.schemas import OrderSummary, OrderSyncResult
from app.services.tiktok.client import TikTokAPIError
from app.services.tiktok.orders import (
    AWAITING_FULFILLMENT_STATUSES,
    GMV_EXCLUDED_STATUSES,
    ORDER_STATUSES,
    fetch_orders,
)
# 同域路由复用授权校验（店铺存在性、ACTIVE 状态、shop_cipher、token 解密）
from app.routers.tiktok_products import _get_authorized_shop
from app.users.auth import current_user

router = APIRouter(prefix="/api/tiktok", tags=["TikTok店铺订单"])

# 店铺所在市场时区：墨西哥站统一按墨西哥城自然日统计（UTC-6，无夏令时）
MARKET_TZ = ZoneInfo("America/Mexico_City")
SYNC_MAX_DAYS = 90


@router.post("/shops/{shop_id}/orders/sync", response_model=OrderSyncResult)
async def sync_shop_orders(
    shop_id: str,
    days: int = Query(7, ge=1, le=SYNC_MAX_DAYS, description="拉取最近 N 天订单，上限 90"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """按创建时间拉取近 N 天订单并按 (shop_id, tiktok_order_id) upsert。"""
    _, cred, access_token = await _get_authorized_shop(db, shop_id, user)

    now_ts = int(datetime.now().timestamp())
    start_ts = now_ts - days * 86400
    try:
        items = await fetch_orders(access_token, cred.shop_cipher, start_ts, now_ts)
    except TikTokAPIError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": f"TikTok 订单拉取失败: {exc.args[0] if exc.args else exc}",
                "code": getattr(exc, "code", -1),
                "request_id": getattr(exc, "request_id", ""),
            },
        )

    existing = (await db.execute(
        select(ShopOrder).where(ShopOrder.shop_id == shop_id)
    )).scalars().all()
    existing_map = {row.tiktok_order_id: row for row in existing}

    now = datetime.utcnow()
    created = updated = 0
    for item in items:
        row = existing_map.get(item["tiktok_order_id"])
        if row is None:
            db.add(ShopOrder(shop_id=shop_id, synced_at=now, **item))
            created += 1
        else:
            for key, value in item.items():
                setattr(row, key, value)
            row.synced_at = now
            updated += 1

    await db.commit()
    return OrderSyncResult(
        shop_id=shop_id, range_days=days, fetched=len(items),
        created=created, updated=updated, synced_at=now,
    )


async def _aggregate_range(db: AsyncSession, shop_id: str, start_ts: int, end_ts: int) -> dict:
    """聚合指定 UTC 秒时间范围内的 GMV 与订单数（成交口径排除未支付/取消）。"""
    gmv_expr = func.coalesce(func.sum(case(
        (~ShopOrder.status.in_(GMV_EXCLUDED_STATUSES), ShopOrder.total_amount),
        else_=0.0,
    )), 0.0)
    paid_count_expr = func.sum(case(
        (~ShopOrder.status.in_(GMV_EXCLUDED_STATUSES), 1),
        else_=0,
    ))
    stmt = select(
        gmv_expr,
        func.coalesce(paid_count_expr, 0),
        func.count(ShopOrder.id),
        func.coalesce(func.max(ShopOrder.currency), None),
    ).where(
        ShopOrder.shop_id == shop_id,
        ShopOrder.tiktok_create_time >= start_ts,
        ShopOrder.tiktok_create_time < end_ts,
    )
    gmv, paid_count, total_count, currency = (await db.execute(stmt)).one()
    return {
        "gmv": round(float(gmv), 2),
        "paid_count": int(paid_count),
        "total_count": int(total_count),
        "currency": currency,
    }


@router.get("/shops/{shop_id}/orders/summary", response_model=OrderSummary)
async def order_summary(
    shop_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """首页经营指标：市场时区今日/昨日 GMV、订单数、客单价与待履约数。"""
    await _get_authorized_shop(db, shop_id, user)  # 仅做授权校验

    now_mx = datetime.now(MARKET_TZ)
    today_start = now_mx.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_ts = int(today_start.timestamp())
    tomorrow_start_ts = today_start_ts + 86400
    yesterday_start_ts = today_start_ts - 86400

    today = await _aggregate_range(db, shop_id, today_start_ts, tomorrow_start_ts)
    yesterday = await _aggregate_range(db, shop_id, yesterday_start_ts, today_start_ts)

    # 待履约数是全量待办，不限于今日
    awaiting = (await db.execute(
        select(func.count(ShopOrder.id)).where(
            ShopOrder.shop_id == shop_id,
            ShopOrder.status.in_(AWAITING_FULFILLMENT_STATUSES),
        )
    )).scalar_one()

    latest_sync = (await db.execute(
        select(func.max(ShopOrder.synced_at)).where(ShopOrder.shop_id == shop_id)
    )).scalar_one_or_none()

    change_pct = None
    if yesterday["gmv"] > 0:
        change_pct = round((today["gmv"] - yesterday["gmv"]) / yesterday["gmv"] * 100, 1)
    aov = round(today["gmv"] / today["paid_count"], 2) if today["paid_count"] else 0.0

    return OrderSummary(
        shop_id=shop_id,
        timezone="America/Mexico_City",
        date=today_start.strftime("%Y-%m-%d"),
        today_gmv=today["gmv"],
        currency=today["currency"],
        today_paid_order_count=today["paid_count"],
        today_total_order_count=today["total_count"],
        today_avg_order_value=aov,
        awaiting_fulfillment_count=int(awaiting),
        yesterday_gmv=yesterday["gmv"],
        yesterday_paid_order_count=yesterday["paid_count"],
        gmv_change_pct=change_pct,
        synced_at=latest_sync,
    )


def _escape_like(value: str) -> str:
    """转义 SQLite LIKE 通配符（% / _ / 反斜杠本身），配合 escape='\\' 使用。"""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("/shops/{shop_id}/orders")
async def list_shop_orders(
    shop_id: str,
    status: Optional[str] = Query(None, description="单状态或逗号分隔多状态，如 AWAITING_SHIPMENT,AWAITING_COLLECTION"),
    keyword: Optional[str] = Query(None, description="匹配订单号 / line_items JSON 内的商品名与商家 SKU"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """本地订单快照分页查询（白名单字段，无买家隐私）。

    返回 {items, total, page, page_size, status_counts}；status_counts 为该店铺
    全量订单的状态分布（不受 status/keyword 过滤影响），供前端筛选 tab 计数。
    """
    shop = await db.get(Shop, shop_id)
    if not shop or shop.user_id != str(user.id):
        raise HTTPException(status_code=404, detail=f"店铺不存在: {shop_id}")
    filters = [ShopOrder.shop_id == shop_id]

    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        invalid = [s for s in statuses if s not in ORDER_STATUSES]
        if invalid:
            raise HTTPException(status_code=400, detail=f"不支持的订单状态: {','.join(invalid)}")
        if statuses:
            filters.append(ShopOrder.status.in_(statuses))

    kw = (keyword or "").strip()
    if kw:
        like_expr = f"%{_escape_like(kw)}%"
        # line_items 在 SQLite 中以 JSON 文本存储，LIKE 可命中其中的商品名/商家 SKU 文本
        filters.append(or_(
            ShopOrder.tiktok_order_id.like(like_expr, escape="\\"),
            cast(ShopOrder.line_items, String).like(like_expr, escape="\\"),
        ))

    total = (await db.execute(
        select(func.count(ShopOrder.id)).where(*filters)
    )).scalar_one()

    rows = (await db.execute(
        select(ShopOrder)
        .where(*filters)
        .order_by(ShopOrder.tiktok_create_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    # 全量状态分布（仅按店铺，不带筛选条件），保持筛选 tab 计数稳定
    status_rows = (await db.execute(
        select(ShopOrder.status, func.count(ShopOrder.id))
        .where(ShopOrder.shop_id == shop_id)
        .group_by(ShopOrder.status)
    )).all()
    status_counts = {st: int(n) for st, n in status_rows}

    # 图片兜底：收集当前页缺少 sku_image 的明细所涉商品，批量取店铺商品主图（按 product_id 关联）
    missing_product_ids = {
        li.get("product_id")
        for r in rows
        for li in (r.line_items or [])
        if not li.get("sku_image") and li.get("product_id")
    }
    image_fallback = {}
    if missing_product_ids:
        product_rows = (await db.execute(
            select(ShopProduct.tiktok_product_id, ShopProduct.main_image_url).where(
                ShopProduct.shop_id == shop_id,
                ShopProduct.tiktok_product_id.in_(missing_product_ids),
            )
        )).all()
        image_fallback = {pid: url for pid, url in product_rows if url}

    items = [
        {
            "id": r.id,
            "tiktok_order_id": r.tiktok_order_id,
            "status": r.status,
            "currency": r.currency,
            "total_amount": r.total_amount,
            "item_count": r.item_count,
            "is_cod": r.is_cod,
            "line_items": [
                {
                    **li,
                    # 优先 SKU 变体图，缺失时回退商品主图；两者皆无则为 None，前端显示占位
                    "image_url": li.get("sku_image") or image_fallback.get(li.get("product_id")),
                }
                for li in (r.line_items or [])
            ],
            "paid_time": r.paid_time,
            "tiktok_create_time": r.tiktok_create_time,
            "synced_at": r.synced_at,
        }
        for r in rows
    ]

    return {
        "items": items,
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "status_counts": status_counts,
    }
