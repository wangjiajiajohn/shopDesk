"""全局配置：从 backend/.env 读取，不硬编码任何密钥。"""
import base64
import os
from pathlib import Path

from dotenv import load_dotenv

# backend/ 目录（本文件位于 backend/app/config.py）
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


class Settings:
    # TikTok 应用凭证
    TIKTOK_APP_KEY: str = os.getenv("TIKTOK_APP_KEY", "")
    TIKTOK_APP_SECRET: str = os.getenv("TIKTOK_APP_SECRET", "")
    TIKTOK_SERVICE_ID: str = os.getenv("TIKTOK_SERVICE_ID", "")

    # 域名
    TIKTOK_API_BASE: str = os.getenv(
        "TIKTOK_API_BASE", "https://open-api.tiktokglobalshop.com"
    ).rstrip("/")
    TIKTOK_AUTH_BASE: str = os.getenv(
        "TIKTOK_AUTH_BASE", "https://auth.tiktok-shops.com"
    ).rstrip("/")
    TIKTOK_REDIRECT_URL: str = os.getenv(
        "TIKTOK_REDIRECT_URL", "http://localhost:8088/api/tiktok/auth/callback"
    )

    # token 加密钥匙路径
    TOKEN_KEY_PATH: str = os.getenv("SHOPDESK_TOKEN_KEY_PATH") or str(
        BACKEND_DIR / ".token_key"
    )

    @property
    def SECRET_KEY(self) -> str:
        """JWT 签名密钥：优先环境变量 JWT_SECRET，其次复用 .token_key，最后兜底。"""
        env = os.getenv("JWT_SECRET")
        if env:
            return env
        key_path = Path(self.TOKEN_KEY_PATH)
        if key_path.exists():
            raw = key_path.read_bytes()
            if len(raw) >= 32:
                return base64.urlsafe_b64encode(raw[:32]).decode()
        return "shopdesk-dev-jwt-secret-change-me"

    # 资料库文件目录
    PRIVATE_FILES_DIR: Path = BACKEND_DIR / "data" / "private"   # 证件（受控下载）
    PUBLIC_RESOURCES_DIR: Path = (
        BACKEND_DIR.parent / "frontend" / "public" / "resources"  # logo/图标（静态公开）
    )
    PUBLIC_UPLOAD_DIR: Path = BACKEND_DIR / "data" / "uploads"    # 商品图片等公开上传文件

    # OpenAI 兼容大模型（OpenAI 官方 / APIMart 等网关通用，改 BASE_URL 即可切换）
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv(
        "OPENAI_BASE_URL", "https://api.openai.com/v1"
    ).rstrip("/")
    OPENAI_DEFAULT_MODEL: str = os.getenv("OPENAI_DEFAULT_MODEL", "gpt-4o-mini")

    # 邮件发送（SMTP）
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USERNAME and self.SMTP_PASSWORD)

    @property
    def ai_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY not in (
            "", "请填入_openai_或_apimart_key"
        ))

    @property
    def is_configured(self) -> bool:
        """是否已填入真实应用凭证（未填时为占位符或空串）。"""
        placeholder = ("", "请填入_app_key", "请填入_app_secret")
        return (
            self.TIKTOK_APP_KEY not in placeholder
            and self.TIKTOK_APP_SECRET not in placeholder
        )


settings = Settings()
