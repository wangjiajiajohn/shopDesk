import json
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import ProductCreationConfig, SourceProduct, User
from ..users.auth import current_user

router = APIRouter(prefix="/api/product-creation-configs", tags=["商品创建设置"])

class SaveConfig(BaseModel):
    expected_revision: int = Field(ge=0)
    config: dict[str, Any]

    @model_validator(mode='after')
    def validate_config(self):
        if len(json.dumps(self.config, ensure_ascii=False)) > 500_000:
            raise ValueError('设置内容过大')
        for key in ('stock', 'weight', 'depth', 'height', 'width'):
            v = self.config.get(key)
            if not isinstance(v, int) or isinstance(v, bool) or v < (0 if key == 'stock' else 1):
                raise ValueError(f'{key}必须是有效整数')
        if not isinstance(self.config.get('supplementalRequirements', ''), str):
            raise ValueError('补充要求必须是文字')
        functions = self.config.get('selectedFunctions', [])
        if not isinstance(functions, list) or any(not isinstance(v, str) for v in functions):
            raise ValueError('功能选择无效')
        schemes = self.config.get('schemes')
        if not isinstance(schemes, list) or not schemes:
            raise ValueError('至少保留一套方案')
        ids = set()
        for scheme in schemes:
            if not isinstance(scheme, dict) or not isinstance(scheme.get('id'), str) or not scheme['id'] or scheme['id'] in ids:
                raise ValueError('方案标识无效或重复')
            ids.add(scheme['id'])
        return self

async def verify_product(db, owner, product_id):
    exists = (await db.execute(select(SourceProduct.id).where(SourceProduct.id == product_id, SourceProduct.user_id == owner))).scalar_one_or_none()
    if not exists:
        raise HTTPException(404, '商品不存在')

def response(row):
    return {'config': row.data if row else None, 'revision': row.revision if row else 0}

@router.get('/{product_id}')
async def read_config(product_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    owner = str(user.id)
    await verify_product(db, owner, product_id)
    return response(await db.get(ProductCreationConfig, (owner, product_id)))

@router.put('/{product_id}')
async def save_config(product_id: str, payload: SaveConfig, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    owner = str(user.id)
    await db.execute(text('BEGIN IMMEDIATE'))
    await verify_product(db, owner, product_id)
    row = await db.get(ProductCreationConfig, (owner, product_id))
    if (row.revision if row else 0) != payload.expected_revision:
        await db.rollback()
        raise HTTPException(409, '设置已在另一台设备更新。本次内容未覆盖服务器，请先重新读取再核对。')
    data = {**payload.config, 'savedAt': datetime.now(timezone.utc).isoformat()}
    if row:
        row.data = data
        row.revision += 1
    else:
        row = ProductCreationConfig(user_id=owner, source_product_id=product_id, data=data, revision=1)
        db.add(row)
    await db.commit()
    return response(row)
