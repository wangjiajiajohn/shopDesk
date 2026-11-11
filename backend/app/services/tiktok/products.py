"""TikTok Shop 线上商品拉取：202502 搜索接口的分页封装与数据规范化。

接口（官方现行版本，所需 scope: seller.product.basic）：
    POST /product/202502/products/search        —— 列表（不含图片）
    GET  /product/202309/products/{product_id}  —— 详情（含 main_images 主图）
"""
import asyncio
from typing import Optional
from urllib.parse import urlsplit

from .client import TikTokAPIError, signed_request

_SEARCH_PATH = "/product/202502/products/search"
_PAGE_SIZE = 100
_MAX_PAGES = 200  # 防护：单店最多 2 万条，超出判定为分页异常，避免 token 死循环

# 官方 status 枚举白名单（与 Movae 线上实现一致）
ALLOWED_STATUSES = {
    "ALL", "DRAFT", "PENDING", "FAILED", "ACTIVATE",
    "SELLER_DEACTIVATED", "PLATFORM_DEACTIVATED", "FREEZE", "DELETED",
}


def _to_float(value) -> Optional[float]:
    """TikTok 金额多为字符串，安全转 float；无法转换返回 None。"""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_product(product: dict) -> dict:
    """把接口原始商品规范化为落库结构，并做严格格式校验。"""
    if not isinstance(product, dict):
        raise TikTokAPIError("TikTok 商品条目格式异常")
    pid = product.get("id")
    if not isinstance(pid, str) or not pid.isdigit():
        raise TikTokAPIError("TikTok 商品 id 格式异常，请重新拉取")

    raw_skus = product.get("skus", [])
    if not isinstance(raw_skus, list):
        raise TikTokAPIError(f"商品 {pid} 的 SKU 列表格式异常")

    sku_snapshot = []
    prices = []
    currency = None
    inventory_total = 0

    for sku in raw_skus:
        if not isinstance(sku, dict):
            raise TikTokAPIError(f"商品 {pid} 的 SKU 条目格式异常")
        item = {k: sku[k] for k in ("id", "seller_sku") if k in sku}

        price = sku.get("price")
        if isinstance(price, dict):
            item["price"] = {
                k: price[k]
                for k in ("currency", "sale_price", "tax_exclusive_price")
                if k in price
            }
            currency = currency or price.get("currency")
            # 202502 搜索接口部分店铺只回 tax_exclusive_price（税前价），sale_price 缺失时兜底
            sale = _to_float(price.get("sale_price"))
            if sale is None:
                sale = _to_float(price.get("tax_exclusive_price"))
            if sale is not None:
                prices.append(sale)

        if isinstance(sku.get("inventory"), list):
            inv_rows = []
            for row in sku["inventory"]:
                if not isinstance(row, dict):
                    continue
                inv_rows.append({
                    k: row[k] for k in ("warehouse_id", "quantity") if k in row
                })
                try:
                    inventory_total += int(row.get("quantity") or 0)
                except (TypeError, ValueError):
                    pass
            item["inventory"] = inv_rows

        sku_snapshot.append(item)

    return {
        "tiktok_product_id": pid,
        "title": product.get("title") or "",
        "status": product.get("status") or "UNKNOWN",
        "has_draft": bool(product.get("has_draft")),
        "sku_count": len(sku_snapshot),
        "price_currency": currency,
        "min_price": min(prices) if prices else None,
        "max_price": max(prices) if prices else None,
        "inventory_total": inventory_total,
        "skus": sku_snapshot,
        "raw_payload": product,
        "tiktok_create_time": product.get("create_time"),
        "tiktok_update_time": product.get("update_time"),
    }


async def search_products_page(
    access_token: str,
    shop_cipher: str,
    page_token: str = "",
    status: str = "ALL",
) -> dict:
    """拉取单页商品，返回 {items(规范化), next_page_token, total_count}。"""
    if status not in ALLOWED_STATUSES:
        raise TikTokAPIError(f"不支持的商品状态过滤: {status}")

    query = {"page_size": _PAGE_SIZE}
    if page_token:
        query["page_token"] = page_token

    data = await signed_request(
        "POST",
        _SEARCH_PATH,
        access_token,
        query=query,
        body={"status": status},
        shop_cipher=shop_cipher,
    )

    rows = data.get("products")
    next_token = data.get("next_page_token") or ""
    total = data.get("total_count")
    if not isinstance(rows, list) or len(rows) > _PAGE_SIZE:
        raise TikTokAPIError("TikTok 返回的商品分页格式异常")
    if not isinstance(next_token, str):
        raise TikTokAPIError("TikTok 返回的分页游标格式异常")
    if next_token and next_token == page_token:
        raise TikTokAPIError("TikTok 分页游标未推进，已终止同步")
    if total is not None and (not isinstance(total, int) or total < 0):
        raise TikTokAPIError("TikTok 返回的商品总数格式异常")

    return {
        "items": [normalize_product(row) for row in rows],
        "next_page_token": next_token,
        "total_count": total,
    }


async def fetch_all_products(
    access_token: str,
    shop_cipher: str,
    status: str = "ALL",
) -> list:
    """循环分页拉取店铺全部商品（带最大页数与游标重复防护）。"""
    all_items = []
    token = ""
    for page_index in range(_MAX_PAGES):
        page = await search_products_page(access_token, shop_cipher, token, status)
        all_items.extend(page["items"])
        token = page["next_page_token"]
        if not token:
            return all_items
    raise TikTokAPIError(f"商品分页数超过上限 {_MAX_PAGES} 页，已终止同步")


# ----------------- 商品主图（详情接口补全） -----------------
_DETAIL_PATH = "/product/202309/products/{product_id}"
_IMAGE_CONCURRENCY = 4      # 详情接口并发上限，避免触发平台 QPS 限流
_image_semaphore: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    """懒加载信号量，避免 Python 3.9 模块导入时绑定到错误事件循环。"""
    global _image_semaphore
    if _image_semaphore is None:
        _image_semaphore = asyncio.Semaphore(_IMAGE_CONCURRENCY)
    return _image_semaphore


def _safe_https_url(url) -> Optional[str]:
    """只接受带 https 且无用户信息的 CDN 地址。"""
    if not isinstance(url, str) or not url:
        return None
    try:
        parsed = urlsplit(url)
        if parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password:
            return url
    except ValueError:
        return None
    return None


def extract_main_images(detail: dict) -> tuple[Optional[str], Optional[str]]:
    """从详情报文提取第一张主图的 (缩略图 URL, 原图 URL)；无图返回 (None, None)。"""
    images = detail.get("main_images")
    if not isinstance(images, list) or not images or not isinstance(images[0], dict):
        return None, None
    first = images[0]

    thumb = None
    for url in first.get("thumb_urls", []) if isinstance(first.get("thumb_urls"), list) else []:
        thumb = _safe_https_url(url)
        if thumb:
            break

    large = None
    for url in first.get("urls", []) if isinstance(first.get("urls"), list) else []:
        large = _safe_https_url(url)
        if large:
            break
    return thumb, large


def extract_category(detail: dict) -> dict:
    """从详情 category_chains 提取叶子类目与完整类目链；无类目返回全 None 值。

    链上节点结构：{id, local_name(西语), parent_id, is_leaf}，按平台返回顺序即从根到叶。
    """
    empty = {"category_id": None, "category_name": None, "category_path": None}
    chains = detail.get("category_chains")
    if not isinstance(chains, list) or not chains:
        return empty
    names = [node.get("local_name") for node in chains if isinstance(node, dict) and node.get("local_name")]
    if not names:
        return empty
    # 叶子取链上最后一个节点；个别商品无 is_leaf 标记时同样回退到末节点
    leaf = next((node for node in reversed(chains) if isinstance(node, dict) and node.get("id")), None)
    return {
        "category_id": str(leaf["id"]) if leaf else None,
        "category_name": leaf.get("local_name") if leaf else names[-1],
        "category_path": " / ".join(names),
    }


async def fetch_product_extras(
    access_token: str,
    shop_cipher: str,
    product_id: str,
) -> dict:
    """调单个商品详情接口，一次调用同时取主图与类目（信号量限流）。"""
    async with _get_semaphore():
        data = await signed_request(
            "GET",
            _DETAIL_PATH.format(product_id=product_id),
            access_token,
            query={},
            shop_cipher=shop_cipher,
        )
    if str(data.get("id", "")) != product_id:
        raise TikTokAPIError(f"商品 {product_id} 详情返回与请求编号不一致")
    thumb, large = extract_main_images(data)
    return {
        "main_image_url": thumb,
        "main_image_large_url": large,
        **extract_category(data),
    }


async def enrich_product_extras(
    access_token: str,
    shop_cipher: str,
    product_ids: list,
) -> dict:
    """并发补全一批商品的详情扩展信息（主图 + 类目）。

    返回 {product_id: {主图与类目字段}}；单个商品失败不阻断整批，
    错误收集到返回值的 "_errors" 键。
    """
    async def _one(pid: str) -> tuple[str, Optional[dict], Optional[str]]:
        try:
            return pid, await fetch_product_extras(access_token, shop_cipher, pid), None
        except Exception as exc:  # 详情接口个别失败不应让整次同步失败
            return pid, None, str(exc)

    results = await asyncio.gather(*[_one(pid) for pid in product_ids])
    extras_map = {}
    errors = []
    for pid, payload, error in results:
        if payload is not None:
            extras_map[pid] = payload
        else:
            errors.append({"product_id": pid, "error": error})
    extras_map["_errors"] = errors
    return extras_map
