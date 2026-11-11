#!/bin/bash
# ShopDesk 一键启动脚本 (同时启动后端 FastAPI 与前端 Vite React)

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================="
echo "🚀 启动 ShopDesk TikTok 跨境电商工作台..."
echo "=========================================="

# 1. 检查端口占用
lsof -ti:8088 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 2. 启动后端 FastAPI (端口 8088)
echo "📦 正在启动后端 FastAPI 服务 (端口 8088)..."
PYTHONPATH="$DIR" "$DIR/backend/venv/bin/uvicorn" backend.app.main:app --host 127.0.0.1 --port 8088 > /dev/null 2>&1 &
BACKEND_PID=$!

# 等待后端就绪
sleep 1.5

# 3. 启动前端 Vite (端口 5173)
echo "💻 正在启动前端 React 工作台 (端口 5173)..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "🎉 ShopDesk 启动成功！"
echo "🌐 前端工作台界面: http://localhost:5173"
echo "🔌 后端交互式接口: http://localhost:8088/docs"
echo "=========================================="
echo "按 Ctrl + C 可终止所有服务。"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT
wait
