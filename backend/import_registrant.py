"""导入店铺注册人资料到指定用户。"""
import sys
import sqlite3
import json
import uuid
from datetime import datetime

DB_PATH = "shopdesk.db"

# 从 frontend/src/data/registrant.js 提取的硬编码数据
IDENTITY_FIELDS = [
    ["姓名", "MARIO LEONARDO MARTINEZ ESPINOZA"],
    ["名字", "MARIO LEONARDO"],
    ["父姓 / 母姓", "MARTINEZ / ESPINOZA"],
    ["出生日期", "1995-06-27"],
    ["性别（证件记载）", "H"],
    ["CURP", "MAEM950627HNLRSR07"],
    ["选民编号", "MRESMR95062719H700"],
    ["证件签发 / 有效年份", "2018 / 2028"],
    ["登记年份", "2013 02"],
    ["州 / 市 / 地区 / 分区", "19 / 006 / 0001 / 2209"],
    ["地址", "CHIHUAHUA 126, FRACCIONAMIENTO SAN ANDRES, CIUDAD APODACA, NUEVO LEON, 66640"],
]

TAX_FIELDS = [
    ["RFC", "MAEM950627D17"],
    ["idCIF", "21060017842"],
    ["文件名称", "CONSTANCIA DE SITUACIÓN FISCAL"],
    ["签发地点 / 日期", "APODACA, NUEVO LEON · 2022-07-12"],
    ["登记状态（文件记载）", "ACTIVO"],
    ["开始经营 / 状态变更日期", "2014-03-20"],
    ["经济活动 / 比例", "Asalariado（受薪人员） / 100%"],
    ["税制", "Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios"],
    ["税制起始日期", "2014-03-20"],
    ["申报义务", "Declaración anual de ISR. Personas Físicas."],
    ["文件记载截止时间", "次年 4 月 30 日前"],
    ["义务起始日期", "2016-01-01"],
    ["街道类型 / 名称 / 门牌号", "CALLE / CHIHUAHUA / 126"],
    ["社区 / 城市 / 州 / 邮编", "FRACCIONAMIENTO SAN ANDRES / APODACA / NUEVO LEON / 66640"],
    ["交叉街道", "FRONTERA NORTE / CHIHUAHUA"],
    ["商业名称、室号、电话、税务邮箱", "文件未填写"],
]


def main():
    if len(sys.argv) < 2:
        print("用法: python import_registrant.py <user_email>")
        sys.exit(1)
    email = sys.argv[1]

    c = sqlite3.connect(DB_PATH)
    row = c.execute("SELECT id FROM user WHERE email=?", (email,)).fetchone()
    if not row:
        print(f"用户不存在: {email}")
        sys.exit(1)
    user_id = row[0]

    c.executescript("""
    CREATE TABLE IF NOT EXISTS registrant_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        identity_fields TEXT DEFAULT '[]',
        tax_fields TEXT DEFAULT '[]',
        created_at TEXT,
        updated_at TEXT
    );
    """)

    c.execute("DELETE FROM registrant_profiles WHERE user_id=?", (user_id,))
    now = datetime.utcnow().isoformat()
    c.execute(
        "INSERT INTO registrant_profiles (id, user_id, identity_fields, tax_fields, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (str(uuid.uuid4()), user_id,
         json.dumps(IDENTITY_FIELDS, ensure_ascii=False),
         json.dumps(TAX_FIELDS, ensure_ascii=False),
         now, now)
    )
    c.commit()
    print(f"✓ 已为用户 {email} 导入注册人资料（身份 {len(IDENTITY_FIELDS)} 项，税务 {len(TAX_FIELDS)} 项）")


if __name__ == "__main__":
    main()
