"""邮件发送服务（SMTP，QQ 邮箱等通用）。"""
from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import aiosmtplib

from app.config import settings

logger = logging.getLogger("shopdesk.email")


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """异步发送 HTML 邮件。成功返回 True，失败返回 False（不抛异常）。"""
    if not settings.smtp_configured:
        logger.warning("SMTP 未配置，跳过真实发信")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USERNAME
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_PORT == 465,  # 465 隐式 SSL，587 走 STARTTLS
            start_tls=settings.SMTP_PORT == 587,
        )
        logger.info(f"邮件已发送至 {to}：{subject}")
        print(f"[邮件] 已发送至 {to}：{subject}", flush=True)
        return True
    except Exception as exc:
        logger.error(f"邮件发送失败（{to}）: {exc}")
        print(f"[邮件] 发送失败（{to}）: {exc}", flush=True)
        return False
