"""AI 能力路由：文本对话等大模型调用。"""
from __future__ import annotations

from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.config import settings
from app.users.auth import current_user
from app.services.ai.client import ai_client

router = APIRouter(prefix="/api/ai", tags=["AI"], dependencies=[Depends(current_user)])


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


class ResponseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    image_urls: List[str] = Field(default_factory=list, max_length=10)
    max_output_tokens: int = Field(1000, ge=16, le=8192)


@router.get("/status")
async def ai_status():
    return {"configured": settings.ai_configured, "provider": "openai" if settings.OPENAI_BASE_URL == "https://api.openai.com/v1" else "compatible",
            "model": settings.OPENAI_DEFAULT_MODEL, "connection_verified": False}


@router.post("/responses")
async def respond(req: ResponseRequest):
    if not settings.ai_configured:
        raise HTTPException(status_code=503, detail="尚未配置AI密钥")
    if any(not url.startswith("https://") for url in req.image_urls):
        raise HTTPException(status_code=422, detail="图片必须使用可访问的HTTPS地址")
    try:
        return await ai_client.respond(req.text, req.image_urls, max_output_tokens=req.max_output_tokens)
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        message = {401: "AI密钥无效，请检查服务器配置", 403: "AI服务拒绝访问，请检查项目权限和服务可用性", 429: "AI额度或请求速率受限，请检查API控制台"}.get(status, "AI服务请求失败，请稍后重试")
        raise HTTPException(status_code=502, detail=message) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="无法连接AI服务，请检查服务器网络") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
