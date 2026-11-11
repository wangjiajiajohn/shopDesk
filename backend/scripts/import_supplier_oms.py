"""手动运行：导入深圳源创 OMS 认领 SKU 清单。

用法（backend 目录下）：
PYTHONPATH=. ./venv/bin/python scripts/import_supplier_oms.py <claimedSkuList.xlsx> <supplier_media.json>
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal, Base, engine
from app.migrations import run_sqlite_migrations
from app.services.importers.supplier_oms import import_supplier_oms


async def main():
    if len(sys.argv) != 3:
        raise SystemExit("用法: import_supplier_oms.py <xlsx 路径> <media json 路径>")
    xlsx_path, media_path = sys.argv[1], sys.argv[2]

    # 与 FastAPI 启动保持一致：先迁移补列/空表重建，再 create_all 建新表
    changes = await run_sqlite_migrations()
    if changes:
        print("[migrations]", "; ".join(changes))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        report = await import_supplier_oms(db, xlsx_path, media_path)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
