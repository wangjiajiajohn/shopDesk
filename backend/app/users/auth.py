"""认证策略（JWT）与 fastapi_users 实例。"""
from __future__ import annotations

import uuid

from fastapi_users import FastAPIUsers
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)

from app.config import settings
from app.models import User
from app.users.manager import get_user_manager

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=settings.SECRET_KEY, lifetime_seconds=7 * 24 * 3600)  # 7 天


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

# 已登录用户依赖（可选，未登录返回 None）
current_user_optional = fastapi_users.current_user(optional=True)
# 已登录用户依赖（强制）
current_user = fastapi_users.current_user(active=True)
