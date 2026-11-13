"""计算器相关接口（访客统计等）"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/calculator", tags=["calculator"])

# 默认访客统计（后续可接入数据库或真实埋点）
DEFAULT_VISITORS = {
    "today": 1,
    "total": 666,
}


@router.post("/visitors")
async def calculator_visitors():
    """计算器访客统计（POST 兼容 Movae 前端调用方式）"""
    return DEFAULT_VISITORS
