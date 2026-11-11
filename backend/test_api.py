from starlette.testclient import TestClient
from backend.app.main import app

def test_all():
    client = TestClient(app)

    # 1. 健康检查
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("✓ 健康检查通过:", res.json())

    # 2. 市场列表
    res = client.get("/api/markets")
    assert res.status_code == 200
    markets = res.json()
    assert len(markets) >= 1
    print(f"✓ 市场列表通过 (当前 {len(markets)} 个市场):", markets[0]["country_code"], markets[0]["name"])

    # 3. 店铺列表
    res = client.get("/api/shops")
    assert res.status_code == 200
    shops = res.json()
    print(f"✓ 店铺列表通过 (当前 {len(shops)} 个店铺):", [s["shop_name"] for s in shops])

    # 4. 供应商列表
    res = client.get("/api/suppliers")
    assert res.status_code == 200
    suppliers = res.json()
    print(f"✓ 供应商列表通过 (当前 {len(suppliers)} 家):", [s["name"] for s in suppliers])

    # 5. 货源商品列表 (含阶梯价与体积重)；无 mock 种子，空列表是合法基线
    res = client.get("/api/source-products")
    assert res.status_code == 200
    products = res.json()
    assert isinstance(products, list)
    if not products:
        print("✓ 货源商品列表通过 (当前 0 款，等待真实录入)")
    for p in products:
        print(f"✓ 货源商品: {p['title']}")
        print(f"   阶梯价: 1件 ¥{p['price_tier_1']} | 2件 ¥{p['price_tier_2']} (-{p['tier_2_discount_percent']}%) | 3件 ¥{p['price_tier_3']} (-{p['tier_3_discount_percent']}%)")
        print(f"   物理参数: 实重 {p['weight_g']}g | 体积 {p['volume_cm3']}cm³ | 体积重 {p['volume_weight_g']}g | 抛货: {p['is_bulky']}")

    # 6. 动态新增店铺测试
    test_shop_payload = {
        "market_code": "MX",
        "shop_name": "Tienda Test MX (测试新店)",
        "tiktok_shop_id": "999988881111"
    }
    res = client.post("/api/shops", json=test_shop_payload)
    assert res.status_code == 200
    created_shop = res.json()
    print(f"✓ 动态绑定新店铺成功: ID={created_shop['id']}, Name={created_shop['shop_name']}")

    # 清理测试店铺
    client.delete(f"/api/shops/{created_shop['id']}")
    print("✓ 测试新店解绑清理完成")

    print("\n🎉 全部后端 API 自动化回归测试 100% 通过！")

if __name__ == "__main__":
    test_all()
