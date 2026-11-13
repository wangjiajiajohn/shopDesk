"""SQLite 轻量迁移。

SQLAlchemy 的 create_all 只能建新表、不会改既有表结构。本模块在启动时
（create_all 之前）执行幂等的 schema 补差：
- 既有表缺列 → ALTER TABLE ADD COLUMN
- 约束放宽（NOT NULL → 可空）SQLite 无法直接 ALTER；对确认无数据的表
  采用 DROP + create_all 重建（仅适用于零业务数据的早期表）。
"""
from sqlalchemy import text
from .database import engine

# 626456776@qq.com 的 user_id：现有数据全部归属到该账号
DEFAULT_OWNER_USER_ID = "e281155c-91c7-499d-b642-75b0881c04c8"

# 既有表需要补的列：table -> [(column, DDL fragment)]
_ADDED_COLUMNS = {
    "shop_orders": [("rts_sla_time", "INTEGER"), ("tts_sla_time", "INTEGER"), ("cancel_order_sla_time", "INTEGER")],
    "shop_products": [
        ("source_product_id", "VARCHAR(36)"),
        ("listing_draft_id", "VARCHAR(36)"),
    ],
    "source_products": [
        ("supply_currency", "VARCHAR(10)"),
        ("customs_declaration", "JSON"),
    ],
    # 数据归属：user_id 列
    "shops": [("user_id", "VARCHAR(36)")],
    "suppliers": [("user_id", "VARCHAR(36)")],
    "source_products": [("user_id", "VARCHAR(36)")],
    "platform_accounts": [("user_id", "VARCHAR(36)")],
}

# 需要回填 user_id 的表（加列后把 NULL 行设为默认归属人）
_BACKFILL_USER_ID_TABLES = ["shops", "suppliers", "source_products", "platform_accounts"]

# 零数据早期表：旧 schema 带 NOT NULL 约束需要放宽时，确认空表后重建
_REBUILD_IF_EMPTY = {
    # table -> 旧 schema 中仍为 NOT NULL、新模型已放宽的列
    "source_products": ["price_tier_1", "price_tier_2", "price_tier_3"],
}


async def _existing_columns(conn, table: str) -> set:
    rows = await conn.execute(text(f"PRAGMA table_info({table})"))
    return {row[1] for row in rows.fetchall()}


async def _table_exists(conn, table: str) -> bool:
    rows = await conn.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:t"),
        {"t": table},
    )
    return rows.fetchone() is not None


async def run_sqlite_migrations() -> list:
    """启动时执行，返回本次实际发生的变更描述列表。"""
    changes = []
    async with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            if not await _table_exists(conn, table):
                continue  # 新表由 create_all 按最新模型直接建
            existing = await _existing_columns(conn, table)
            for column, ddl_type in columns:
                if column not in existing:
                    await conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}")
                    )
                    changes.append(f"{table}.{column} added")

        for table, not_null_cols in _REBUILD_IF_EMPTY.items():
            if not await _table_exists(conn, table):
                continue
            info = await conn.execute(text(f"PRAGMA table_info({table})"))
            cols = {row[1]: row for row in info.fetchall()}
            strict_cols = [c for c in not_null_cols if c in cols and cols[c][3] == 1]
            if not strict_cols:
                continue
            count_row = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            if count_row.fetchone()[0] != 0:
                # 有数据就不动，交由后续正式迁移处理
                changes.append(f"{table} NOT NULL relaxation skipped (has data)")
                continue
            await conn.execute(text(f"DROP TABLE {table}"))
            changes.append(f"{table} dropped for NOT NULL relaxation (was empty)")

        # 回填 user_id：把历史无主数据归属到默认账号
        for table in _BACKFILL_USER_ID_TABLES:
            if not await _table_exists(conn, table):
                continue
            existing = await _existing_columns(conn, table)
            if "user_id" not in existing:
                continue
            result = await conn.execute(
                text(f"UPDATE {table} SET user_id = :uid WHERE user_id IS NULL"),
                {"uid": DEFAULT_OWNER_USER_ID},
            )
            if result.rowcount > 0:
                changes.append(f"{table}: {result.rowcount} 行归属到默认用户")
    return changes
