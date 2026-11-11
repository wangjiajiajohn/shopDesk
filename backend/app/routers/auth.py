"""认证路由：fastapi-users 标准路由 + 邮箱验证码验证路由。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.models import User
from app.users.auth import auth_backend, fastapi_users
from app.users.manager import UserManager, consume_reset_code, consume_verification_code, get_user_manager
from app.users.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])

# 标准 fastapi-users 路由
router.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/jwt")
router.include_router(fastapi_users.get_register_router(UserRead, UserCreate))
router.include_router(fastapi_users.get_verify_router(UserRead))
router.include_router(fastapi_users.get_reset_password_router())
router.include_router(fastapi_users.get_users_router(UserRead, UserUpdate))


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


@router.post("/verify-code")
async def verify_by_code(
    req: VerifyCodeRequest,
    user_manager: UserManager = Depends(get_user_manager),
):
    """用邮箱 + 6 位验证码完成邮箱验证。"""
    token = consume_verification_code(req.email, req.code)
    if not token:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    try:
        user = await user_manager.verify(token)
    except Exception:
        raise HTTPException(status_code=400, detail="验证失败，请重新获取验证码")
    return {"status": "ok", "email": user.email, "is_verified": user.is_verified}


class ResetPasswordCodeRequest(BaseModel):
    email: EmailStr
    code: str
    password: str


@router.post("/reset-password-code")
async def reset_password_by_code(
    req: ResetPasswordCodeRequest,
    user_manager: UserManager = Depends(get_user_manager),
):
    """用邮箱 + 6 位验证码 + 新密码完成密码重置。"""
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="密码至少 8 位")
    token = consume_reset_code(req.email, req.code)
    if not token:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")
    try:
        await user_manager.reset_password(token, req.password)
    except Exception:
        raise HTTPException(status_code=400, detail="重置失败，请重新获取验证码")
    return {"status": "ok", "message": "密码重置成功，请使用新密码登录"}
