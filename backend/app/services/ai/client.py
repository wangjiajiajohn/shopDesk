"""OpenAI 兼容大模型客户端（官方 / APIMart 等网关通用）。

设计要点：
- 全部密钥只从 settings 读取，不进代码、不进日志、不回前端
- httpx AsyncClient 复用（FastAPI 生命周期内单例），超时 60s
- 调用失败抛 HTTP 异常，由路由层统一转成 502/前端可读错误
"""
from __future__ import annotations

import httpx

from app.config import settings


class AIClient:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=settings.OPENAI_BASE_URL,
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """发起对话补全，返回模型回复文本。"""
        client = self._get_client()
        payload: dict = {
            "model": model or settings.OPENAI_DEFAULT_MODEL,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"AI 响应结构异常: {data}") from exc

    async def respond(self, text: str, image_urls: list[str] | None = None,
                      model: str | None = None, max_output_tokens: int = 1000) -> dict:
        """Official Responses API; retain token usage for later queue accounting."""
        content = [{"type": "input_text", "text": text}]
        content.extend({"type": "input_image", "image_url": url, "detail": "auto"} for url in (image_urls or []))
        response = await self._get_client().post("/responses", json={
            "model": model or settings.OPENAI_DEFAULT_MODEL,
            "input": [{"role": "user", "content": content}],
            "max_output_tokens": max_output_tokens,
            "store": False,
        })
        response.raise_for_status()
        data = response.json()
        text_output = "\n".join(part["text"] for item in data.get("output", [])
                                if item.get("type") == "message"
                                for part in item.get("content", []) if part.get("type") == "output_text")
        if data.get("status") != "completed" or not text_output:
            raise RuntimeError("AI未返回完整结果，请检查输出长度或重试")
        return {"content": text_output, "model": data.get("model", model or settings.OPENAI_DEFAULT_MODEL),
                "usage": data.get("usage", {}), "response_id": data.get("id")}


# 单例：应用启动时创建，关闭时 aclose
ai_client = AIClient()
