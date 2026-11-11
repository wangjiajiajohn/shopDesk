"""用户数据库后端（fastapi-users SQLAlchemy 集成）。"""
from __future__ import annotations

from fastapi import Depends
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User


async def get_user_db(session=Depends(get_db)):
    yield SQLAlchemyUserDatabase(session, User)
