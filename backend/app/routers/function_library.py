from datetime import datetime
from typing import List, Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import ProductFunctionLibrary, User
from ..users.auth import current_user
from ..function_library import merge_run

router = APIRouter(prefix="/api/product-functions", tags=["商品功能词库"])

class Evidence(BaseModel):
    url: HttpUrl
    title: str = Field(min_length=1, max_length=500)
    excerpt: str = Field(min_length=1, max_length=2000)
    platform: Literal['FastMoss', '出海匠', 'TikTok']
    materialNumber: int | None = Field(default=None, gt=0)
    imageAsset: str | None = Field(default=None, pattern=r'^images/[a-zA-Z0-9_.-]+$')
    evidenceType: Literal['text', 'image_text', 'visual_structure'] = 'text'
    visualExpression: str | None = Field(default=None, max_length=1500)

class Term(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r".*\S.*")
    aliases: List[str] = Field(default_factory=list, max_length=30)
    sources: List[Evidence] = Field(min_length=1, max_length=100)

class LearningRun(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=200, pattern=r".*\S.*")
    market: str = Field(min_length=1, max_length=100)
    requirements: str = Field(max_length=5000)
    completedAt: datetime
    terms: List[Term] = Field(max_length=500)

@router.get("")
async def read_library(db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    row = await db.get(ProductFunctionLibrary, str(user.id))
    return row.data if row else {"terms": [], "runs": []}

@router.post("/runs")
async def apply_run(run: LearningRun, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)):
    # SQLite transaction serializes merge writers, so simultaneous runs cannot drop terms.
    from sqlalchemy import text
    await db.execute(text("BEGIN IMMEDIATE"))
    row = await db.get(ProductFunctionLibrary, str(user.id))
    if not row:
        row = ProductFunctionLibrary(user_id=str(user.id), data={"terms": [], "runs": []})
        db.add(row)
    row.data = merge_run(row.data, run.model_dump(mode="json"))
    await db.commit()
    return row.data
