"""导入参考商品静态数据到数据库（归属指定用户）。

用法: python import_reference_products.py <user_email>
"""
import sys
import json
import sqlite3
import os
from pathlib import Path

DB_PATH = "shopdesk.db"
REF_DIR = Path("../frontend/public/product-references/mx-20261107")


def main():
    if len(sys.argv) < 2:
        print("用法: python import_reference_products.py <user_email>")
        sys.exit(1)
    email = sys.argv[1]

    if not REF_DIR.exists():
        print(f"参考商品目录不存在: {REF_DIR}")
        sys.exit(1)

    c = sqlite3.connect(DB_PATH)
    row = c.execute("SELECT id FROM user WHERE email=?", (email,)).fetchone()
    if not row:
        print(f"用户不存在: {email}")
        sys.exit(1)
    user_id = row[0]

    # 建表
    c.executescript("""
    CREATE TABLE IF NOT EXISTS reference_datasets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        market TEXT NOT NULL,
        captured_at TEXT,
        categories TEXT DEFAULT '[]',
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS reference_products (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        index_data TEXT DEFAULT '{}',
        detail_data TEXT DEFAULT '{}',
        created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ref_ds_user ON reference_datasets(user_id);
    CREATE INDEX IF NOT EXISTS idx_ref_prod_user ON reference_products(user_id);
    CREATE INDEX IF NOT EXISTS idx_ref_prod_ds ON reference_products(dataset_id);
    """)

    # 读取 index.json
    with open(REF_DIR / "index.json", "r", encoding="utf-8") as f:
        index = json.load(f)

    # 创建 dataset
    import uuid
    from datetime import datetime
    ds_id = str(uuid.uuid4())
    c.execute(
        "INSERT INTO reference_datasets (id, user_id, dataset_id, market, captured_at, categories, created_at) VALUES (?,?,?,?,?,?,?)",
        (ds_id, user_id, index["datasetId"], index["market"], index.get("capturedAt"),
         json.dumps(index["categories"], ensure_ascii=False), datetime.utcnow().isoformat())
    )

    # 导入商品
    count = 0
    seen_ids = set()
    for item in index["items"]:
        pid = item["id"]
        if pid in seen_ids:
            continue
        seen_ids.add(pid)

        # 读取详情
        detail = {}
        detail_path = REF_DIR / "products" / f"{pid}.json"
        if detail_path.exists():
            with open(detail_path, "r", encoding="utf-8") as f:
                detail = json.load(f)

        c.execute(
            "INSERT INTO reference_products (id, user_id, dataset_id, product_id, index_data, detail_data, created_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), user_id, ds_id, pid,
             json.dumps(item, ensure_ascii=False),
             json.dumps(detail, ensure_ascii=False),
             datetime.utcnow().isoformat())
        )
        count += 1

    c.commit()
    print(f"✓ 已为用户 {email} 导入 {count} 个参考商品")
    print(f"  dataset: {index['datasetId']} ({index['market']})")
    print(f"  categories: {len(index['categories'])} 个")


if __name__ == "__main__":
    main()
