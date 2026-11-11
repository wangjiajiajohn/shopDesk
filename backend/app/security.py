"""Token 静态加密（仅依赖 Python 标准库）。

方案：本地 32 字节随机钥匙文件 + HMAC-SHA256 生成密钥流做流加密（CTR 思路）。
密文格式：v1:<base64(nonce(16B) + ciphertext)>
说明：避免引入 cryptography 依赖（当前环境 pip 不稳定）。
产品化多租户阶段应升级为 KMS / Fernet，并把钥匙移出本机。
"""
import base64
import hmac
import os
from pathlib import Path

from app.config import settings

_VERSION = "v1"
_NONCE_BYTES = 16


def _load_or_create_key() -> bytes:
    key_path = Path(settings.TOKEN_KEY_PATH)
    if key_path.exists():
        key = key_path.read_bytes()
        if len(key) >= 32:
            return key
    # 自动生成新钥匙，权限收紧为仅当前用户可读写
    key = os.urandom(32)
    key_path.write_bytes(key)
    os.chmod(key_path, 0o600)
    return key


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    """用 HMAC-SHA256 作为伪随机函数生成 length 字节密钥流。"""
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(
            key, nonce + counter.to_bytes(8, "big"), digestmod="sha256"
        ).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def encrypt_token(plaintext: str) -> str:
    if not plaintext:
        return ""
    key = _load_or_create_key()
    nonce = os.urandom(_NONCE_BYTES)
    data = plaintext.encode("utf-8")
    stream = _keystream(key, nonce, len(data))
    cipher = bytes(a ^ b for a, b in zip(data, stream))
    return _VERSION + ":" + base64.b64encode(nonce + cipher).decode("ascii")


def decrypt_token(payload: str) -> str:
    if not payload:
        return ""
    try:
        version, blob = payload.split(":", 1)
        if version != _VERSION:
            raise ValueError(f"不支持的密文版本: {version}")
        raw = base64.b64decode(blob)
        nonce, cipher = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
        key = _load_or_create_key()
        stream = _keystream(key, nonce, len(cipher))
        data = bytes(a ^ b for a, b in zip(cipher, stream))
        return data.decode("utf-8")
    except Exception as exc:  # 解密失败不应让整个接口崩掉
        raise ValueError("Token 解密失败，钥匙文件可能被替换或删除") from exc


def mask_token(token: str) -> str:
    """前端展示用脱敏：只留头尾。"""
    if not token:
        return ""
    if len(token) <= 10:
        return token[:2] + "***"
    return f"{token[:6]}...{token[-4:]}"
