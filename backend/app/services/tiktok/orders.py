"""TikTok Shop 订单拉取：202309 订单搜索接口的分页封装与白名单规范化。

接口（所需 scope: 订单读取）：
    POST /order/202309/orders/search
    query: page_size(≤100)、page_token、shop_cipher、sort_field/sort_order
    body : {"create_time_ge": 秒, "create_time_lt": 秒, "order_status"?: 枚举}
    约束：单次时间跨度不超过 90 天

隐私红线：接口返回含 buyer_email / recipient_address / user_id 等买家信息，
本模块只提取运营字段，隐私数据在 normalize 阶段即被丢弃，永不落库。
"""
import time
from typing import Optional

from .client import TikTokAPIError, signed_request

_SEARCH_PATH = "/order/202309/orders/search"
_PAGE_SIZE = 100
_MAX_PAGES = 50       # 单轮最多 5000 条，与 Movae 线上防护一致
_MAX_RANGE_SECONDS = 90 * 86400

# 官方订单状态枚举
ORDER_STATUSES = {
    "UNPAID", "ON_HOLD", "AWAITING_SHIPMENT", "PARTIALLY_SHIPPING",
    "AWAITING_COLLECTION", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED",
}

# GMV 口径：未支付与已取消订单不计入成交（路由层 SQL 聚合也复用此常量）
GMV_EXCLUDED_STATUSES = {"UNPAID", "CANCELLED"}

# 待履约（运营待办）：待发货 + 待揽收
AWAITING_FULFILLMENT_STATUSES = {"AWAITING_SHIPMENT", "AWAITING_COLLECTION"}

# line_item 白名单（商品维度，不含收件人）
# sku_image 为 SKU 维度变体图（CDN 公网地址，非隐私字段）；旧订单缺失时由路由层用商品主图兜底
_LINE_ITEM_FIELDS = (
    "id", "product_id", "product_name", "sku_id", "sku_name",
    "seller_sku", "sale_price", "currency", "sku_image",
)
_PAYMENT_FIELDS = (
    "currency", "total_amount", "sub_total", "shipping_fee",
    "platform_discount", "seller_discount",
)


def _to_float(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _positive_timestamp(value) -> Optional[int]:
    try:
        if isinstance(value, bool):
            return None
        result = int(value)
        return result if result > 0 else None
    except (TypeError, ValueError, OverflowError):
        return None


def normalize_order(order: dict) -> dict:
    """白名单提取订单字段；买家邮箱、收件地址、user_id 等隐私数据直接丢弃。"""
    if not isinstance(order, dict):
        raise TikTokAPIError("TikTok 订单条目格式异常")
    oid = order.get("id")
    if not isinstance(oid, str) or not oid.isdigit():
        raise TikTokAPIError("TikTok 订单 id 格式异常，请重新拉取")

    raw_lines = order.get("line_items", [])
    if not isinstance(raw_lines, list):
        raise TikTokAPIError(f"订单 {oid} 的商品明细格式异常")
    line_items = [
        {k: line[k] for k in _LINE_ITEM_FIELDS if k in line}
        for line in raw_lines
        if isinstance(line, dict)
    ]

    payment = order.get("payment") if isinstance(order.get("payment"), dict) else {}
    payment_norm = {k: payment.get(k) for k in _PAYMENT_FIELDS if k in payment}

    return {
        "tiktok_order_id": oid,
        "status": order.get("status") or "UNKNOWN",
        "currency": payment_norm.get("currency"),
        "total_amount": _to_float(payment_norm.get("total_amount")) or 0.0,
        "sub_total": _to_float(payment_norm.get("sub_total")),
        "shipping_fee": _to_float(payment_norm.get("shipping_fee")),
        "platform_discount": _to_float(payment_norm.get("platform_discount")),
        "seller_discount": _to_float(payment_norm.get("seller_discount")),
        "item_count": len(line_items),
        "line_items": line_items,
        "is_cod": bool(order.get("is_cod")),
        "shipping_type": order.get("shipping_type"),
        "fulfillment_type": order.get("fulfillment_type"),
        "rts_sla_time": _positive_timestamp(order.get("rts_sla_time")),
        "tts_sla_time": _positive_timestamp(order.get("tts_sla_time")),
        "cancel_order_sla_time": _positive_timestamp(order.get("cancel_order_sla_time")),
        "paid_time": order.get("paid_time"),
        "tiktok_create_time": order.get("create_time"),
        "tiktok_update_time": order.get("update_time"),
    }


async def search_orders_page(
    access_token: str,
    shop_cipher: str,
    create_time_ge: int,
    create_time_lt: int,
    page_token: str = "",
    status: str = "",
) -> dict:
    """拉取单页订单。"""
    if status and status not in ORDER_STATUSES:
        raise TikTokAPIError(f"不支持的订单状态过滤: {status}")
    if create_time_lt <= create_time_ge:
        raise TikTokAPIError("订单查询时间范围无效")
    if create_time_lt - create_time_ge > _MAX_RANGE_SECONDS:
        raise TikTokAPIError("订单查询时间跨度不能超过 90 天")
    if create_time_lt > int(time.time()) + 300:
        raise TikTokAPIError("查询结束时间不能晚于当前时间")

    query = {"page_size": _PAGE_SIZE, "sort_field": "create_time", "sort_order": "DESC"}
    if page_token:
        query["page_token"] = page_token

    body = {"create_time_ge": create_time_ge, "create_time_lt": create_time_lt}
    if status:
        body["order_status"] = status

    data = await signed_request(
        "POST", _SEARCH_PATH, access_token,
        query=query, body=body, shop_cipher=shop_cipher,
    )

    rows = data.get("orders")
    next_token = data.get("next_page_token") or ""
    if not isinstance(rows, list) or len(rows) > _PAGE_SIZE:
        raise TikTokAPIError("TikTok 返回的订单分页格式异常")
    if not isinstance(next_token, str):
        raise TikTokAPIError("TikTok 返回的订单分页游标格式异常")
    if next_token and next_token == page_token:
        raise TikTokAPIError("订单分页游标未推进，已终止同步")

    return {
        "items": [normalize_order(row) for row in rows],
        "next_page_token": next_token,
        "total_count": data.get("total_count"),
    }


async def fetch_orders(
    access_token: str,
    shop_cipher: str,
    create_time_ge: int,
    create_time_lt: int,
    status: str = "",
) -> list:
    """循环分页拉取时间范围内全部订单（带页数与游标重复防护）。"""
    all_items = []
    token = ""
    seen = set()
    for _ in range(_MAX_PAGES):
        page = await search_orders_page(
            access_token, shop_cipher, create_time_ge, create_time_lt, token, status
        )
        all_items.extend(page["items"])
        token = page["next_page_token"]
        if not token:
            return all_items
        if token in seen:
            raise TikTokAPIError("订单分页游标重复，已终止同步")
        seen.add(token)
    raise TikTokAPIError(f"订单分页数超过上限 {_MAX_PAGES} 页，请缩短时间范围")


def is_gmv_order(status: str) -> bool:
    """该状态订单是否计入 GMV（排除未支付、已取消）。"""
    return status not in GMV_EXCLUDED_STATUSES
