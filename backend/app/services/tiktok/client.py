"""TikTok Shop 业务 API 签名客户端。

签名规则（官方 Sign your API request 文档，2026-11 核实）：
1. query 参数排除 sign、access_token，按 key 字母序排列，直接拼接 key+value
2. input = 请求 path + 参数字符串 + 请求体原文
3. sign = HMAC_SHA256(app_secret, app_secret + input + app_secret) 的十六进制
4. 请求头携带 app_key / sign / timestamp(10位秒级) / x-tts-access-token
"""
import hashlib
import hmac
import time
from typing import Optional

import httpx

from app.config import settings


class TikTokAPIError(Exception):
    def __init__(self, message: str, code: int = -1, request_id: str = ""):
        super().__init__(message)
        self.code = code
        self.request_id = request_id


def _build_sign(path: str, query: dict, body: str) -> str:
    # 1. 排除 sign / access_token，按 key 排序，拼接 key+value
    #    注意：app_key、timestamp 必须在签名前就放入 query（与已上线实现一致）
    filtered = {
        k: v for k, v in query.items()
        if k not in ("sign", "access_token") and v is not None and v != ""
    }
    param_str = "".join(f"{k}{filtered[k]}" for k in sorted(filtered.keys()))
    # 2-3. secret 包裹后 HMAC-SHA256
    raw = (
        settings.TIKTOK_APP_SECRET.encode("utf-8")
        + path.encode("utf-8")
        + param_str.encode("utf-8")
        + body.encode("utf-8")
        + settings.TIKTOK_APP_SECRET.encode("utf-8")
    )
    return hmac.new(
        settings.TIKTOK_APP_SECRET.encode("utf-8"),
        raw,
        digestmod=hashlib.sha256,
    ).hexdigest()


async def signed_request(
    method: str,
    path: str,
    access_token: str,
    query: Optional[dict] = None,
    body: Optional[dict] = None,
    shop_cipher: Optional[str] = None,
) -> dict:
    """发起带签名的业务 API 请求，返回 data 字段。

    签名基准串 = path + 按 key 排序的 query（含 app_key/timestamp，
    不含 sign/access_token）+ body 原文，外层包 app_secret。
    """
    if not settings.is_configured:
        raise TikTokAPIError("后端尚未配置 TIKTOK_APP_KEY / TIKTOK_APP_SECRET")

    method = method.upper()
    full_query = dict(query or {})
    # 业务接口（非 shops 列表查询）需要带 shop_cipher
    if shop_cipher and path != "/authorization/202309/shops":
        full_query["shop_cipher"] = shop_cipher
    # app_key、timestamp 必须先入 query 再参与签名
    full_query["app_key"] = settings.TIKTOK_APP_KEY
    full_query["timestamp"] = str(int(time.time()))

    # GET 不带 body；POST 用紧凑 JSON 原文参与签名并发送
    body_str = ""
    if method == "POST" and body is not None:
        import json
        body_str = json.dumps(body, separators=(",", ":"), ensure_ascii=False)

    full_query["sign"] = _build_sign(path, full_query, body_str)
    url = f"{settings.TIKTOK_API_BASE}{path}"
    headers = {
        "x-tts-access-token": access_token,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if method == "GET":
                resp = await client.get(url, params=full_query, headers=headers)
            else:
                resp = await client.post(url, params=full_query, headers=headers, content=body_str)
            # 先尝试解析 TikTok 的 JSON 错误体（400/4xx 也带 code/message/request_id）
            try:
                payload = resp.json()
            except ValueError:
                resp.raise_for_status()
                raise TikTokAPIError("TikTok 业务接口返回了非 JSON 内容")
    except httpx.HTTPError as exc:
        raise TikTokAPIError(f"请求 TikTok 业务接口失败: {exc}") from exc

    if payload.get("code") != 0:
        raise TikTokAPIError(
            payload.get("message", "未知业务接口错误"),
            code=payload.get("code", -1),
            request_id=payload.get("request_id", ""),
        )
    return payload.get("data", {})


async def get_authorized_shops(access_token: str) -> list:
    """校验 token 真实性：拉取该 token 可访问的店铺列表（含 cipher）。"""
    data = await signed_request(
        "GET", "/authorization/202309/shops", access_token
    )
    return data.get("shops", [])
