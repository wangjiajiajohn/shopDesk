"""SQLite 轻量迁移。

SQLAlchemy 的 create_all 只能建新表、不会改既有表结构。本模块在启动时
（create_all 之前）执行幂等的 schema 补差：
- 既有表缺列 → ALTER TABLE ADD COLUMN
- 约束放宽（NOT NULL → 可空）SQLite 无法直接 ALTER；对确认无数据的表
  采用 DROP + create_all 重建（仅适用于零业务数据的早期表）。
"""
import shutil

from sqlalchemy import text
from .config import settings
from .database import engine

# 626456776@qq.com 的 user_id：现有数据全部归属到该账号
DEFAULT_OWNER_USER_ID = "e281155c-91c7-499d-b642-75b0881c04c8"

# 既有表需要补的列：table -> [(column, DDL fragment)]
_ADDED_COLUMNS = {
    "shop_orders": [
        ("rts_sla_time", "INTEGER"),
        ("tts_sla_time", "INTEGER"),
        ("cancel_order_sla_time", "INTEGER"),
    ],
    "shop_products": [
        ("source_product_id", "VARCHAR(36)"),
        ("listing_draft_id", "VARCHAR(36)"),
    ],
    "source_products": [
        ("supply_currency", "VARCHAR(10)"),
        ("customs_declaration", "JSON"),
        ("user_id", "VARCHAR(36)"),
        ("is_active", "BOOLEAN DEFAULT 1"),
        ("last_synced_at", "DATETIME"),
        ("composition", "TEXT"),
        ("size_chart", "JSON"),
        ("source_data", "JSON"),
        ("supply_price", "FLOAT"),
    ],
    # 数据归属：user_id 列
    "shops": [("user_id", "VARCHAR(36)")],
    "suppliers": [("user_id", "VARCHAR(36)")],
    "platform_accounts": [("user_id", "VARCHAR(36)"), ("shop_id", "VARCHAR(36)")],
    "registrant_profiles": [("shop_id", "VARCHAR(36)")],
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


async def _first_shops_by_user(conn) -> dict:
    rows = await conn.execute(text("SELECT id, user_id FROM shops ORDER BY created_at, id"))
    first = {}
    for shop_id, user_id in rows.fetchall():
        if user_id and user_id not in first:
            first[user_id] = shop_id
    return first


async def _backfill_shop_ids(conn, first_shops: dict, changes: list):
    """既有账号级资料归入该账号的首个店铺，不触碰参考商品的 user_id 归属。"""
    for table in ("platform_accounts", "registrant_profiles"):
        if not await _table_exists(conn, table):
            continue
        for user_id, shop_id in first_shops.items():
            result = await conn.execute(
                text(f"UPDATE {table} SET shop_id=:shop_id WHERE user_id=:user_id AND shop_id IS NULL"),
                {"shop_id": shop_id, "user_id": user_id},
            )
            if result.rowcount > 0:
                changes.append(f"{table}: {result.rowcount} 行归属到首个店铺")


async def _rebuild_registrant_profiles(conn, changes: list):
    """移除旧的 user_id 唯一约束，改为 shop_id 唯一，保留全部资料。"""
    indexes = (await conn.execute(text("PRAGMA index_list(registrant_profiles)"))).fetchall()
    has_unique_user = False
    for index in indexes:
        if not index[2]:
            continue
        columns = (await conn.execute(text(f'PRAGMA index_info("{index[1]}")'))).fetchall()
        if [column[2] for column in columns] == ["user_id"]:
            has_unique_user = True
            break
    if not has_unique_user:
        return

    missing_shop = (await conn.execute(
        text("SELECT COUNT(*) FROM registrant_profiles WHERE shop_id IS NULL")
    )).fetchone()[0]
    if missing_shop:
        changes.append("registrant_profiles 店铺归属重建跳过（存在无店铺资料）")
        return

    await conn.execute(text("ALTER TABLE registrant_profiles RENAME TO registrant_profiles_legacy"))
    await conn.execute(text("DROP INDEX IF EXISTS ix_registrant_profiles_user_id"))
    await conn.execute(text("""
        CREATE TABLE registrant_profiles (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES "user" (id),
            shop_id VARCHAR(36) NOT NULL UNIQUE REFERENCES shops (id),
            identity_fields JSON,
            tax_fields JSON,
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    await conn.execute(text("CREATE INDEX ix_registrant_profiles_user_id ON registrant_profiles (user_id)"))
    await conn.execute(text("CREATE INDEX ix_registrant_profiles_shop_id ON registrant_profiles (shop_id)"))
    await conn.execute(text("""
        INSERT INTO registrant_profiles
            (id, user_id, shop_id, identity_fields, tax_fields, created_at, updated_at)
        SELECT id, user_id, shop_id, identity_fields, tax_fields, created_at, updated_at
        FROM registrant_profiles_legacy
    """))
    await conn.execute(text("DROP TABLE registrant_profiles_legacy"))
    changes.append("registrant_profiles 改为 shop_id 唯一")


def _move_legacy_resource_files(shop_id: str) -> int:
    """将原全局资料迁移到店铺私有目录，Logo 同时移出公开静态目录。"""
    backend_dir = settings.PRIVATE_FILES_DIR.parent.parent
    sources = [
        ("registrant", settings.PRIVATE_FILES_DIR / "registrant"),
        ("company", settings.PRIVATE_FILES_DIR / "company"),
        ("shop-logos", settings.PUBLIC_RESOURCES_DIR / "shop-logos"),
        # 线上历史 Nginx 静态目录；本地不存在时会自动跳过。
        ("shop-logos", backend_dir.parent.parent / "frontend" / "shop" / "resources" / "shop-logos"),
    ]
    moved = 0
    for category, source in sources:
        if not source.is_dir():
            continue
        for path in source.iterdir():
            if not path.is_file():
                continue
            target = settings.PRIVATE_FILES_DIR / "shops" / shop_id / category / path.name
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(path), str(target))
            moved += 1
    return moved


async def _migrate_legacy_resource_files(conn, first_shops: dict, changes: list):
    rows = (await conn.execute(text(
        'SELECT s.id FROM shops s JOIN "user" u ON u.id = s.user_id '
        'WHERE u.email = :email ORDER BY s.created_at, s.id LIMIT 1'
    ), {"email": "626456776@qq.com"})).fetchall()
    if rows:
        shop_id = rows[0][0]
    elif len(first_shops) == 1:
        shop_id = next(iter(first_shops.values()))
    else:
        return
    moved = _move_legacy_resource_files(shop_id)
    if moved:
        changes.append(f"资料库文件: {moved} 个迁入店铺私有目录")


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

        first_shops = await _first_shops_by_user(conn) if await _table_exists(conn, "shops") else {}
        await _backfill_shop_ids(conn, first_shops, changes)
        if await _table_exists(conn, "registrant_profiles"):
            await _rebuild_registrant_profiles(conn, changes)
        if first_shops and await _table_exists(conn, "user"):
            await _migrate_legacy_resource_files(conn, first_shops, changes)
    return changes
