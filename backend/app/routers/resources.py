"""店铺资料库：平台账号（加密）+ 证件/Logo 文件（受控访问）。"""
import mimetypes
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models import PlatformAccount, User
from ..schemas import (
    PlatformAccountCreate,
    PlatformAccountResponse,
    PlatformAccountUpdate,
    RevealRequest,
)
from ..security import decrypt_token, encrypt_token, mask_token
from ..users.auth import current_user

router = APIRouter(prefix="/api/resources", tags=["店铺资料库"])

# 敏感字段 → ORM 密文列
_SECRET_FIELDS = {
    "password": "password_encrypted",
    "secret": "secret_encrypted",
    "pin": "pin_encrypted",
}

# 文件下载白名单：category -> 根目录（只允许这两个根下的文件）
_FILE_ROOTS = {
    "registrant": settings.PRIVATE_FILES_DIR / "registrant",
    "company": settings.PRIVATE_FILES_DIR / "company",
    "shop-logos": settings.PUBLIC_RESOURCES_DIR / "shop-logos",
}


def _account_out(a: PlatformAccount) -> PlatformAccountResponse:
    """构造掩码出参，绝不带出密文列。"""
    return PlatformAccountResponse(
        id=a.id,
        platform=a.platform,
        purpose=a.purpose,
        account=a.account,
        contact=a.contact,
        url=a.url,
        note=a.note,
        sort_order=a.sort_order or 0,
        has_password=bool(a.password_encrypted),
        has_secret=bool(a.secret_encrypted),
        has_pin=bool(a.pin_encrypted),
        password_masked=mask_token(decrypt_token(a.password_encrypted)) if a.password_encrypted else "",
        secret_masked=mask_token(decrypt_token(a.secret_encrypted)) if a.secret_encrypted else "",
        pin_masked=mask_token(decrypt_token(a.pin_encrypted)) if a.pin_encrypted else "",
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


# ----------------- 平台账号 -----------------
@router.get("/accounts", response_model=List[PlatformAccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    result = await db.execute(
        select(PlatformAccount)
        .filter(PlatformAccount.user_id == str(user.id))
        .order_by(
            PlatformAccount.sort_order.asc(), PlatformAccount.created_at.asc()
        )
    )
    return [_account_out(a) for a in result.scalars().all()]


@router.post("/accounts", response_model=PlatformAccountResponse)
async def create_account(
    body: PlatformAccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    data = body.model_dump(exclude={"password", "secret", "pin"})
    account = PlatformAccount(**data, user_id=str(user.id))
    account.password_encrypted = encrypt_token(body.password or "")
    account.secret_encrypted = encrypt_token(body.secret or "")
    account.pin_encrypted = encrypt_token(body.pin or "")
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _account_out(account)


@router.put("/accounts/{account_id}", response_model=PlatformAccountResponse)
async def update_account(
    account_id: str,
    body: PlatformAccountUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    account = await db.get(PlatformAccount, account_id)
    if not account or account.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="账号不存在")

    # 普通字段直接更新
    for key in ("platform", "purpose", "account", "contact", "url", "note", "sort_order"):
        value = getattr(body, key)
        if value is not None:
            setattr(account, key, value)

    # 敏感字段：缺省不变；空串清空；非空替换
    for field, column in _SECRET_FIELDS.items():
        value = getattr(body, field)
        if value is None:
            continue
        setattr(account, column, encrypt_token(value) if value else None)

    await db.commit()
    await db.refresh(account)
    return _account_out(account)


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    account = await db.get(PlatformAccount, account_id)
    if not account or account.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="账号不存在")
    await db.delete(account)
    await db.commit()
    return {"ok": True, "message": "账号已删除"}


@router.post("/accounts/{account_id}/reveal")
async def reveal_account(
    account_id: str,
    body: RevealRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """解密单个敏感字段。"""
    account = await db.get(PlatformAccount, account_id)
    if not account or account.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="账号不存在")
    encrypted = getattr(account, _SECRET_FIELDS[body.field])
    if not encrypted:
        return {"field": body.field, "value": ""}
    try:
        return {"field": body.field, "value": decrypt_token(encrypted)}
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ----------------- 资料库文件 -----------------
_FILE_LABELS = {
    "registrant": "店铺注册人",
    "company": "企业信息",
    "shop-logos": "店铺 Logo",
}


@router.get("/files")
async def list_files():
    """列出资料库文件（不含 website-logos，图标由前端静态路径直接访问）。"""
    groups = []
    for category, root in _FILE_ROOTS.items():
        files = []
        if root.exists():
            for p in sorted(root.iterdir()):
                if not p.is_file() or p.name.startswith(".") or p.name == "SOURCES.md":
                    continue
                files.append({
                    "name": p.name,
                    "size": p.stat().st_size,
                    "mime": mimetypes.guess_type(p.name)[0] or "application/octet-stream",
                    "download_url": f"/api/resources/files/download?category={category}&name={p.name}",
                })
        groups.append({"category": category, "label": _FILE_LABELS[category], "files": files})
    return groups


@router.get("/files/download")
async def download_file(category: str, name: str):
    """受控下载：白名单目录 + 解析后路径校验，阻断 ../ 路径穿越。"""
    root = _FILE_ROOTS.get(category)
    if root is None:
        raise HTTPException(status_code=400, detail="非法文件分类")

    # 只允许纯文件名，拒绝任何带路径分隔符的输入
    if "/" in name or "\\" in name or name in ("", ".", ".."):
        raise HTTPException(status_code=400, detail="非法文件名")

    target = (root / name).resolve()
    root_resolved = root.resolve()
    if root_resolved not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        target,
        media_type=mimetypes.guess_type(target.name)[0] or "application/octet-stream",
        filename=target.name,
    )
