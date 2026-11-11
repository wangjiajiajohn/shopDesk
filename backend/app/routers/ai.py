"""AI 能力路由：文本对话等大模型调用。"""
from __future__ import annotations

from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.services.ai.client import ai_client

router = APIRouter(prefix="/api/ai", tags=["AI"])


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1)
    model: Optional[str] = None
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0, le=8192)


class ChatResponse(BaseModel):
    content: str
    model: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """文本对话。前端传入 messages 数组，返回模型回复文本。"""
    if not settings.ai_configured:
        raise HTTPException(
            status_code=503,
            detail="AI 服务未配置：请在 backend/.env 填入 OPENAI_API_KEY",
        )

    model = req.model or settings.OPENAI_DEFAULT_MODEL
    try:
        content = await ai_client.chat(
            messages=[m.model_dump() for m in req.messages],
            model=model,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
    except httpx.HTTPStatusError as exc:  # type: ignore[name-defined]
        # 把上游错误原样透出（状态码 + 消息），方便前端定位鉴权/配额问题
        status = exc.response.status_code
        body = exc.response.text
        raise HTTPException(
            status_code=502,
            detail=f"AI 服务调用失败（{status}）: {body}",
        )
    except httpx.HTTPError as exc:  # type: ignore[name-defined]
        raise HTTPException(status_code=502, detail=f"AI 服务连接失败: {exc}")
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return ChatResponse(content=content, model=model)
