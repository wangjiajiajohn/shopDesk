"""TikTok 真实授权路由：测试店手动 token、真实 API 校验、刷新、解绑。"""
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Shop, ShopCredential, User
from app.schemas import AuthTestResult, CredentialResponse, ManualTokenCreate
from app.security import decrypt_token, encrypt_token, mask_token
from app.services.tiktok.auth import TikTokAuthError, refresh_access_token
from app.services.tiktok.client import TikTokAPIError, get_authorized_shops
from app.config import settings
from app.users.auth import current_user

router = APIRouter(prefix="/api/tiktok/auth", tags=["TikTok授权"])

_ACCESS_TTL_SECONDS = 7 * 24 * 3600      # access_token 官方有效期 7 天
_REFRESH_TTL_SECONDS = 30 * 24 * 3600    # refresh_token 约 30 天


def _parse_expire_at(value, default_ttl_seconds: int) -> datetime:
    """token/get、token/refresh 返回的 *_expire_in 是【绝对 Unix 秒级时间戳】
    （参考 Movae 生产实现：直接与 time.time() 比较）。异常/缺省时回退为 TTL。"""
    import time
    if isinstance(value, int) and value > int(time.time()):
        return datetime.utcfromtimestamp(value)
    return datetime.utcnow() + timedelta(seconds=default_ttl_seconds)


# ---------------- 辅助函数 ----------------
async def _get_shop_or_404(db: AsyncSession, shop_id: str, user: User) -> Shop:
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop or shop.user_id != str(user.id):
        raise HTTPException(status_code=404, detail=f"店铺不存在: {shop_id}")
    return shop


async def _get_or_create_credential(db: AsyncSession, shop_id: str) -> ShopCredential:
    result = await db.execute(
        select(ShopCredential).where(ShopCredential.shop_id == shop_id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        cred = ShopCredential(shop_id=shop_id)
        db.add(cred)
    return cred


def _to_response(cred: ShopCredential) -> CredentialResponse:
    return CredentialResponse(
        shop_id=cred.shop_id,
        auth_status=cred.auth_status,
        seller_name=cred.seller_name,
        seller_base_region=cred.seller_base_region,
        open_id_masked=mask_token(cred.open_id) if cred.open_id else None,
        has_refresh_token=bool(cred.refresh_token_encrypted),
        is_dev_shop=cred.is_dev_shop,
        granted_scopes=cred.granted_scopes or [],
        access_token_expire_at=cred.access_token_expire_at,
        refresh_token_expire_at=cred.refresh_token_expire_at,
        last_verified_at=cred.last_verified_at,
        last_test_message=cred.last_test_message,
    )


async def _verify_and_update(db: AsyncSession, shop: Shop, cred: ShopCredential) -> AuthTestResult:
    """用真实业务接口 /authorization/202309/shops 校验 token，并回写店铺密文。"""
    now = datetime.utcnow()
    try:
        access_token = decrypt_token(cred.access_token_encrypted)
        shops_data = await get_authorized_shops(access_token)
    except (ValueError, TikTokAPIError) as exc:
        cred.auth_status = "INVALID"
        cred.last_verified_at = now
        cred.last_test_message = f"校验失败: {getattr(exc, 'message', str(exc))}"
        await db.commit()
        return AuthTestResult(
            ok=False,
            auth_status="INVALID",
            message=cred.last_test_message,
            request_id=getattr(exc, "request_id", ""),
            verified_at=now,
        )

    # 匹配当前工作台店铺：tiktok_shop_id 可能对应接口的 code（如 MXMXLC8RL23N）或数字 id
    matched = next(
        (
            s for s in shops_data
            if str(s.get("code")) == str(shop.tiktok_shop_id)
            or str(s.get("id")) == str(shop.tiktok_shop_id)
        ),
        None,
    )
    if matched is None and len(shops_data) == 1:
        matched = shops_data[0]
    if matched is None:
        matched = shops_data[0] if shops_data else {}

    if matched:
        # /authorization/202309/shops 返回字段为 cipher（参考已上线项目实现）
        cred.shop_cipher = (
            matched.get("cipher") or matched.get("shop_cipher") or cred.shop_cipher
        )
        cred.seller_base_region = matched.get("region") or cred.seller_base_region
        cred.seller_name = matched.get("name") or cred.seller_name

    cred.auth_status = "ACTIVE"
    cred.last_verified_at = now
    request_id_note = f"；拉取到 {len(shops_data)} 家授权店铺"
    cred.last_test_message = f"真实接口校验通过{request_id_note}"
    await db.commit()

    return AuthTestResult(
        ok=True,
        auth_status="ACTIVE",
        message=cred.last_test_message,
        matched_shops=shops_data,
        verified_at=now,
    )


# ---------------- 接口 ----------------
@router.get("/config-status")
async def config_status():
    """前端用来判断后端 .env 是否配好（只返回布尔，不泄露密钥）。"""
    return {
        "is_configured": settings.is_configured,
        "has_service_id": bool(settings.TIKTOK_SERVICE_ID)
        and settings.TIKTOK_SERVICE_ID != "请填入_service_id",
        "api_base": settings.TIKTOK_API_BASE,
    }


@router.get("/credentials", response_model=List[CredentialResponse])
async def list_credentials(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    result = await db.execute(
        select(ShopCredential)
        .join(Shop, ShopCredential.shop_id == Shop.id)
        .filter(Shop.user_id == str(user.id))
    )
    return [_to_response(c) for c in result.scalars().all()]


@router.post("/manual-token", response_model=AuthTestResult)
async def save_manual_token(
    payload: ManualTokenCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """录入 Partner Center 测试店生成的 token，保存后立即真实校验。"""
    shop = await _get_shop_or_404(db, payload.shop_id, user)
    cred = await _get_or_create_credential(db, payload.shop_id)

    now = datetime.utcnow()
    cred.access_token_encrypted = encrypt_token(payload.access_token.strip())
    cred.refresh_token_encrypted = (
        encrypt_token(payload.refresh_token.strip())
        if payload.refresh_token else None
    )
    cred.access_token_expire_at = now + timedelta(
        seconds=payload.access_token_expire_in or _ACCESS_TTL_SECONDS
    )
    if payload.refresh_token:
        cred.refresh_token_expire_at = now + timedelta(
            seconds=payload.refresh_token_expire_in or _REFRESH_TTL_SECONDS
        )
    cred.is_dev_shop = payload.is_dev_shop
    cred.auth_status = "UNAUTHORIZED"  # 等待真实接口验证
    await db.commit()

    return await _verify_and_update(db, shop, cred)


@router.post("/{shop_id}/test", response_model=AuthTestResult)
async def test_token(
    shop_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """对已保存的 token 重新发起真实 API 校验。"""
    shop = await _get_shop_or_404(db, shop_id, user)
    cred = await _get_or_create_credential(db, shop_id)
    if not cred.access_token_encrypted:
        raise HTTPException(status_code=400, detail="该店铺尚未录入 token")
    return await _verify_and_update(db, shop, cred)


@router.post("/{shop_id}/refresh", response_model=AuthTestResult)
async def refresh_token(
    shop_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """用 refresh_token 向 TikTok 换新 access_token，并重新校验。"""
    shop = await _get_shop_or_404(db, shop_id, user)
    cred = await _get_or_create_credential(db, shop_id)
    if not cred.refresh_token_encrypted:
        raise HTTPException(status_code=400, detail="该店铺没有 refresh_token，无法自动续期")

    try:
        refresh_token_plain = decrypt_token(cred.refresh_token_encrypted)
        data = await refresh_access_token(refresh_token_plain)
    except (ValueError, TikTokAuthError) as exc:
        cred.auth_status = "REVOKED"
        cred.last_test_message = f"刷新失败: {getattr(exc, 'message', str(exc))}"
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail={
                "message": cred.last_test_message,
                "code": getattr(exc, "code", -1),
                "request_id": getattr(exc, "request_id", ""),
            },
        )

    now = datetime.utcnow()
    cred.access_token_encrypted = encrypt_token(data["access_token"])
    # 刷新接口可能同时下发新的 refresh_token，有就轮换
    if data.get("refresh_token"):
        cred.refresh_token_encrypted = encrypt_token(data["refresh_token"])
        cred.refresh_token_expire_at = _parse_expire_at(
            data.get("refresh_token_expire_in"), _REFRESH_TTL_SECONDS
        )
    # *_expire_in 为绝对 Unix 时间戳，不能当 TTL 秒数叠加
    cred.access_token_expire_at = _parse_expire_at(
        data.get("access_token_expire_in"), _ACCESS_TTL_SECONDS
    )
    if data.get("open_id"):
        cred.open_id = data["open_id"]
    # 刷新响应可能携带最新 scope 集合，有则覆盖落库
    scopes = data.get("granted_scopes")
    if isinstance(scopes, list) and all(isinstance(s, str) for s in scopes):
        cred.granted_scopes = scopes
    await db.commit()

    return await _verify_and_update(db, shop, cred)


@router.delete("/{shop_id}")
async def revoke_credential(
    shop_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """解绑/清除本地凭证记录（不会调用 TikTok 吊销接口）。"""
    await _get_shop_or_404(db, shop_id, user)
    result = await db.execute(
        select(ShopCredential).where(ShopCredential.shop_id == shop_id)
    )
    cred = result.scalar_one_or_none()
    if cred:
        await db.delete(cred)
        await db.commit()
    return {"ok": True, "message": "本地授权凭证已清除"}
