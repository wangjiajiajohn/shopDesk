"""UserManager：密码哈希、邮箱验证流程、邮件发送。

邮件策略：
- 开发期（未配置 SMTP）：生成 6 位验证码，存内存字典，打印到后端日志。
- 生产期：配置 SMTP 后走 aiosmtplib 真发信（预留 send_email 接口，待接入）。
"""
from __future__ import annotations

import logging
import random
import time
from typing import Optional
import uuid

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, UUIDIDMixin

from app.config import settings
from app.models import User
from app.services.email import send_email
from app.users.db import get_user_db

logger = logging.getLogger("shopdesk.auth")

# 邮箱验证码内存存储：email -> {code, token, expires_at}
# 生产环境应换 Redis/数据库，这里内存足够开发用（服务重启即失效）
_verification_codes: dict[str, dict] = {}
# 重置密码验证码内存存储：email -> {code, token, expires_at}
_reset_codes: dict[str, dict] = {}
CODE_TTL_SECONDS = 600  # 10 分钟


def _make_verification_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def consume_verification_code(email: str, code: str) -> Optional[str]:
    """用邮箱+验证码换取 fastapi-users 的验证 token。成功返回 token，失败返回 None。"""
    record = _verification_codes.get(email)
    if not record:
        return None
    if record["code"] != code or record["expires_at"] < time.time():
        return None
    token = record["token"]
    del _verification_codes[email]
    return token


def consume_reset_code(email: str, code: str) -> Optional[str]:
    """用邮箱+验证码换取 fastapi-users 的重置密码 token。成功返回 token，失败返回 None。"""
    record = _reset_codes.get(email)
    if not record:
        return None
    if record["code"] != code or record["expires_at"] < time.time():
        return None
    token = record["token"]
    del _reset_codes[email]
    return token


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        logger.info(f"新用户注册：{user.email}")

    async def on_after_request_verify(self, user: User, token: str, request: Optional[Request] = None):
        """邮箱验证请求：开发期把 token 转成 6 位验证码打印到日志。"""
        code = _make_verification_code()
        _verification_codes[user.email] = {
            "code": code,
            "token": token,
            "expires_at": time.time() + CODE_TTL_SECONDS,
        }
        # 优先走 SMTP 真实发信；失败/未配置时回退到控制台打印验证码
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2 style="color:#4f46e5;">ShopDesk 邮箱验证</h2>
          <p>您好，您正在注册 ShopDesk，请使用以下验证码完成邮箱验证：</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4f46e5;background:#eef2ff;padding:16px;border-radius:8px;text-align:center;">
            {code}
          </div>
          <p style="color:#64748b;font-size:13px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
          <p style="color:#94a3b8;font-size:12px;">如非本人操作，请忽略此邮件。</p>
        </div>
        """
        sent = await send_email(user.email, "ShopDesk 邮箱验证码", html)
        if not sent:
            # 回退：打印到控制台（开发期兜底）
            msg = (
                f"[邮箱验证] {user.email} 验证码：{code}  "
                f"(10分钟内有效；SMTP 发信失败，已回退日志)"
            )
            logger.info(msg)
            print(msg, flush=True)

    async def on_after_forgot_password(self, user: User, token: str, request: Optional[Request] = None):
        """忘记密码：生成 6 位验证码，通过邮件发送，用户凭验证码重置密码。"""
        code = _make_verification_code()
        _reset_codes[user.email] = {
            "code": code,
            "token": token,
            "expires_at": time.time() + CODE_TTL_SECONDS,
        }
        html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
          <h2 style="color:#4f46e5;">ShopDesk 重置密码</h2>
          <p>您好，您正在重置 ShopDesk 账号密码，请使用以下验证码完成重置：</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#4f46e5;background:#eef2ff;padding:16px;border-radius:8px;text-align:center;">
            {code}
          </div>
          <p style="color:#64748b;font-size:13px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
          <p style="color:#94a3b8;font-size:12px;">如非本人操作，请忽略此邮件，您的密码不会被修改。</p>
        </div>
        """
        sent = await send_email(user.email, "ShopDesk 重置密码验证码", html)
        if not sent:
            msg = (
                f"[重置密码] {user.email} 验证码：{code}  "
                f"(10分钟内有效；SMTP 发信失败，已回退日志)"
            )
            logger.info(msg)
            print(msg, flush=True)


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)
