"""TikTok Shop 授权域接口：授权链接、auth_code 换 token、刷新 token。

官方文档（2026-11 核实）：
- 卖家授权链接: https://services.tiktokshop.com/open/authorize?service_id=xxx
- 换 token: GET  {AUTH_BASE}/api/v2/token/get      grant_type=authorized_code
- 刷新 token: GET {AUTH_BASE}/api/v2/token/refresh  grant_type=refresh_token
- auth_code 30 分钟有效、仅可使用一次；access_token 7 天、refresh_token 约 30 天
"""
from urllib.parse import urlencode

import httpx

from app.config import settings


class TikTokAuthError(Exception):
    """授权接口返回错误或网络失败。"""

    def __init__(self, message: str, code: int = -1, request_id: str = ""):
        super().__init__(message)
        self.code = code
        self.request_id = request_id


def build_authorize_url(state: str) -> str:
    """构造卖家授权页 URL（完整 OAuth 流程使用，第一版可暂不启用）。"""
    query = urlencode({"service_id": settings.TIKTOK_SERVICE_ID, "state": state})
    return f"https://services.tiktokshop.com/open/authorize?{query}"


async def _get_token_endpoint(path: str, params: dict) -> dict:
    if not settings.is_configured:
        raise TikTokAuthError(
            "后端尚未配置 TIKTOK_APP_KEY / TIKTOK_APP_SECRET，请先填写 backend/.env"
        )
    base_params = {
        "app_key": settings.TIKTOK_APP_KEY,
        "app_secret": settings.TIKTOK_APP_SECRET,
    }
    base_params.update(params)
    url = f"{settings.TIKTOK_AUTH_BASE}{path}?{urlencode(base_params)}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as exc:
        raise TikTokAuthError(f"请求 TikTok 授权接口失败: {exc}") from exc
    except ValueError as exc:
        raise TikTokAuthError("TikTok 授权接口返回了非 JSON 内容") from exc

    if payload.get("code") != 0:
        raise TikTokAuthError(
            payload.get("message", "未知授权错误"),
            code=payload.get("code", -1),
            request_id=payload.get("request_id", ""),
        )
    return payload["data"]


async def exchange_auth_code(auth_code: str) -> dict:
    """用回调拿到的 auth_code 换取完整 token 组（完整 OAuth 流程）。"""
    return await _get_token_endpoint(
        "/api/v2/token/get",
        {"auth_code": auth_code, "grant_type": "authorized_code"},
    )


async def refresh_access_token(refresh_token: str) -> dict:
    """用 refresh_token 换新的 access_token。"""
    return await _get_token_endpoint(
        "/api/v2/token/refresh",
        {"refresh_token": refresh_token, "grant_type": "refresh_token"},
    )
