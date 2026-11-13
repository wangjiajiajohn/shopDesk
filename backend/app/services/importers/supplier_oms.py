"""深圳源创 OMS 认领 SKU 清单导入器。

输入：
- xlsx: OMS 导出的 claimedSkuList，列为
  商品编码/商品SKU/商品名称/商品条码/分销价/货币单位/共享库存/专享库存/商品链接/短描述/详细描述
- media_json: 从 OMS 商品页采集的补充数据 [{sku, name, weight, img}]
  （Excel 本身不含图片与重量列）

供应商系统无 SPU 层、全部平铺 SKU，导入时按命名规律归并：
- 中文名按 '-' 切分：末段=尺码，倒数第二段=颜色，其余回拼=SPU 款族名
- 拼音 slug 取相同数量的前导段作为 SPU sku_code
全流程 upsert，按 sku_code 幂等，可重复执行。
"""
import json
from datetime import datetime
from typing import Any, Dict, List

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import ProductAsset, SourceProduct, SourceProductSku, Supplier

OMS_PRODUCT_URL = "https://dragonsupply.jfwms.net/web/product/all"
DEFAULT_SUPPLIER_NAME = "深圳源创"


def _parse_int(value: Any) -> int:
    """OMS 空值用 '--' 占位，库存可能是 float/int/字符串。"""
    if value in (None, "", "--"):
        return 0
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def parse_zh_name(zh_name: str) -> Dict[str, Any]:
    """连体衣-针织-粉-S → 款族=连体衣-针织, 颜色=粉, 尺码=S；
    芒果胸贴-黑-A → 款族=芒果胸贴, 颜色=黑, 尺码=A。"""
    parts = [p.strip() for p in zh_name.split("-") if p.strip()]
    if len(parts) < 3:
        raise ValueError(f"商品名称无法解析出颜色/尺码: {zh_name}")
    size = parts[-1]
    color = parts[-2]
    family_parts = parts[:-2]
    return {
        "family_title": "-".join(family_parts),
        "category": family_parts[0],
        "color": color,
        "size": size,
        "family_segment_count": len(family_parts),
    }


def parse_slug_family(slug: str, family_segment_count: int) -> str:
    """liantiyi-zhenzhi-fen-S 按款族段数取前缀 liantiyi-zhenzhi。"""
    segments = slug.split("-")
    if len(segments) < family_segment_count + 2:
        raise ValueError(f"拼音 SKU 段数异常: {slug}")
    return "-".join(segments[:family_segment_count])


async def _get_or_create_supplier(db: AsyncSession, name: str) -> Supplier:
    existing = (
        await db.execute(select(Supplier).where(Supplier.name == name))
    ).scalar_one_or_none()
    if existing:
        return existing
    supplier = Supplier(
        name=name,
        platform_url="https://dragonsupply.jfwms.net",
        notes="深圳源创 OMS（jfwms），MXN 一口价分销，认领 SKU 清单导入",
    )
    db.add(supplier)
    await db.flush()
    return supplier


async def _get_or_create_spu(db: AsyncSession, spu_code: str, payload: Dict[str, Any]) -> SourceProduct:
    spu = (
        await db.execute(select(SourceProduct).where(SourceProduct.sku_code == spu_code))
    ).scalar_one_or_none()
    if spu is None:
        spu = SourceProduct(sku_code=spu_code, **payload)
        db.add(spu)
        await db.flush()
        return spu, True
    for key, value in payload.items():
        setattr(spu, key, value)
    return spu, False


async def import_supplier_oms(
    db: AsyncSession,
    xlsx_path: str,
    media_json_path: str,
    supplier_name: str = DEFAULT_SUPPLIER_NAME,
) -> Dict[str, Any]:
    """执行导入并返回核对报告。"""
    with open(media_json_path, encoding="utf-8") as f:
        media_rows = json.load(f)
    media_by_sku = {m["sku"]: m for m in media_rows}

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    supplier = await _get_or_create_supplier(db, supplier_name)

    # 按款族聚合的中间结构
    families: Dict[str, Dict[str, Any]] = {}
    parse_errors: List[str] = []

    for row in rows:
        (
            supplier_product_code,
            slug,
            zh_name,
            _barcode,
            price,
            currency,
            shared_stock,
            _exclusive_stock,
            _link,
            _short_desc,
            _detail_desc,
        ) = row
        if not slug or not zh_name:
            continue
        try:
            parsed = parse_zh_name(str(zh_name))
            spu_code = parse_slug_family(str(slug), parsed["family_segment_count"])
        except ValueError as exc:
            parse_errors.append(str(exc))
            continue

        media = media_by_sku.get(str(slug), {})
        family = families.setdefault(spu_code, {
            "title": parsed["family_title"],
            "category": parsed["category"],
            "currency": currency,
            "skus": [],
            "colors": set(),
            "sizes": set(),
        })
        family["skus"].append({
            "sku_code": str(slug),
            "supplier_product_code": str(supplier_product_code) if supplier_product_code else None,
            "zh_name": str(zh_name),
            "color": parsed["color"],
            "size": parsed["size"],
            "price": float(price) if price not in (None, "") else None,
            "currency": currency,
            "stock": _parse_int(shared_stock),
            "image_url": media.get("img", ""),
            "weight_g": _parse_int(media.get("weight")),
        })
        family["colors"].add(parsed["color"])
        family["sizes"].add(parsed["size"])

    stats = {"spu_created": 0, "spu_updated": 0, "sku_created": 0, "sku_updated": 0,
             "asset_created": 0, "asset_updated": 0, "spu_deactivated": 0}
    spu_reports: List[Dict[str, Any]] = []
    sync_at = datetime.utcnow()
    seen_spu_ids: set = set()

    for spu_code, family in families.items():
        skus = family["skus"]
        weights = [s["weight_g"] for s in skus if s["weight_g"]]
        image_urls = [s["image_url"] for s in skus if s["image_url"]]
        spu_payload = {
            "supplier_id": supplier.id,
            "title": family["title"],
            "category_name": family["category"],
            "source_url": OMS_PRODUCT_URL,
            "main_image": image_urls[0] if image_urls else None,
            "supply_currency": family["currency"],
            "weight_g": max(weights) if weights else 200,
            "stock_quantity": sum(s["stock"] for s in skus),
            "specs": [
                {"name": "颜色", "values": sorted(family["colors"])},
                {"name": "尺码", "values": sorted(family["sizes"])},
            ],
        }
        spu, created = await _get_or_create_spu(db, spu_code, spu_payload)
        # 本批次出现即在架；同步时间用于排查"上次还在、这次消失"
        spu.is_active = True
        spu.last_synced_at = sync_at
        seen_spu_ids.add(spu.id)
        stats["spu_created" if created else "spu_updated"] += 1

        for order, item in enumerate(skus):
            existing_sku = (
                await db.execute(
                    select(SourceProductSku).where(SourceProductSku.sku_code == item["sku_code"])
                )
            ).scalar_one_or_none()
            attributes = [
                {"name": "颜色", "value": item["color"]},
                {"name": "尺码", "value": item["size"]},
            ]
            if existing_sku is None:
                sku = SourceProductSku(
                    source_product_id=spu.id,
                    sku_code=item["sku_code"],
                    attributes=attributes,
                    supplier_sku_code=item["supplier_product_code"],
                    supply_price=item["price"],
                    currency=item["currency"],
                    stock_quantity=item["stock"],
                    sort_order=order,
                )
                db.add(sku)
                await db.flush()
                stats["sku_created"] += 1
            else:
                sku = existing_sku
                sku.source_product_id = spu.id
                sku.attributes = attributes
                sku.supplier_sku_code = item["supplier_product_code"]
                sku.supply_price = item["price"]
                sku.currency = item["currency"]
                sku.stock_quantity = item["stock"]
                sku.sort_order = order
                stats["sku_updated"] += 1

            if item["image_url"]:
                existing_asset = (
                    await db.execute(
                        select(ProductAsset).where(
                            ProductAsset.source_product_id == spu.id,
                            ProductAsset.sku_code == item["sku_code"],
                            ProductAsset.role == "sku",
                        )
                    )
                ).scalar_one_or_none()
                if existing_asset is None:
                    asset = ProductAsset(
                        source_product_id=spu.id,
                        role="sku",
                        source_type="supplier_raw",
                        sku_code=item["sku_code"],
                        local_url=item["image_url"],
                        sort_order=order,
                    )
                    db.add(asset)
                    await db.flush()
                    stats["asset_created"] += 1
                else:
                    asset = existing_asset
                    asset.local_url = item["image_url"]
                    stats["asset_updated"] += 1
                sku.image_asset_id = asset.id

        spu_reports.append({
            "spu_code": spu_code,
            "title": family["title"],
            "sku_count": len(skus),
            "colors": sorted(family["colors"]),
            "sizes": sorted(family["sizes"]),
            "price_set": sorted({s["price"] for s in skus if s["price"] is not None}),
            "currency": family["currency"],
            "stock_total": sum(s["stock"] for s in skus),
            "image_count": len(image_urls),
            "weight_g": max(weights) if weights else None,
        })

    # 本周快照里消失的 SPU 不删除：置为无在架（无库存标签），预销售清单引用仍保留
    existing_spus = (
        await db.execute(select(SourceProduct).where(SourceProduct.supplier_id == supplier.id))
    ).scalars().all()
    for spu in existing_spus:
        if spu.id not in seen_spu_ids and spu.is_active:
            spu.is_active = False
            spu.last_synced_at = sync_at
            stats["spu_deactivated"] += 1

    await db.commit()

    total_skus = sum(len(f["skus"]) for f in families.values())
    priced = sum(1 for f in families.values() for s in f["skus"] if s["price"] is not None)
    imaged = sum(1 for f in families.values() for s in f["skus"] if s["image_url"])
    in_stock = sum(1 for f in families.values() for s in f["skus"] if s["stock"] > 0)
    return {
        "supplier": supplier_name,
        "excel_rows": len(rows),
        "spu_count": len(families),
        "sku_count": total_skus,
        "stats": stats,
        "coverage": {
            "price": f"{priced}/{total_skus}",
            "image": f"{imaged}/{total_skus}",
            "stock": f"{in_stock}/{total_skus}",
        },
        "parse_errors": parse_errors,
        "spus": spu_reports,
    }
