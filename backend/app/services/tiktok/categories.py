"""TikTok 官方类目字典服务：拉取 zh-CN 类目树、本地缓存、按在用商品构建中文树。

接口 GET /product/202309/categories 返回区域全量扁平节点（MX 约 2290 个），
category_id/parent_id 是语言无关的官方数字 ID，locale 仅改变 local_name 文案。
"""
from datetime import datetime
from typing import Dict, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import TikTokCategory
from app.services.tiktok.client import signed_request

ZH_LOCALE = "zh-CN"
_PATH_SEP = " / "
_MAX_DEPTH_GUARD = 20


async def fetch_categories(access_token: str, shop_cipher: str, locale: str = ZH_LOCALE) -> list:
    """拉取区域全量类目节点（扁平，含 id/parent_id/local_name/is_leaf）。"""
    data = await signed_request(
        "GET",
        "/product/202309/categories",
        access_token,
        query={"locale": locale},
        shop_cipher=shop_cipher,
    )
    nodes = data.get("categories", [])
    if not isinstance(nodes, list) or not nodes:
        from app.services.tiktok.client import TikTokAPIError
        raise TikTokAPIError("类目接口返回为空，无法构建类目字典")
    return nodes


async def upsert_category_dict(
    db: AsyncSession, region: str, nodes: list, locale: str = ZH_LOCALE
) -> dict:
    """按 (region, category_id) upsert 类目字典；不删除本次未出现的孤儿节点。"""
    existing = (await db.execute(
        select(TikTokCategory).where(TikTokCategory.region == region)
    )).scalars().all()
    existing_map = {row.category_id: row for row in existing}

    now = datetime.utcnow()
    created = 0
    updated = 0
    for raw in nodes:
        cid = str(raw.get("id") or "").strip()
        if not cid:
            continue
        name = raw.get("local_name") or cid
        raw_parent = raw.get("parent_id")
        parent_id = str(raw_parent) if raw_parent not in (None, "") else None
        is_leaf = bool(raw.get("is_leaf"))

        row = existing_map.get(cid)
        if row is None:
            db.add(TikTokCategory(
                region=region, category_id=cid, parent_id=parent_id,
                local_name=name, is_leaf=is_leaf, locale=locale, synced_at=now,
            ))
            created += 1
        elif row.local_name != name or row.parent_id != parent_id or row.is_leaf != is_leaf:
            row.local_name = name
            row.parent_id = parent_id
            row.is_leaf = is_leaf
            row.synced_at = now
            updated += 1

    await db.commit()
    return {"total": len(nodes), "created": created, "updated": updated, "synced_at": now}


async def get_category_dict(db: AsyncSession, region: str) -> Dict[str, TikTokCategory]:
    """返回区域类目字典 {category_id: 行对象}；未同步时为空 dict。"""
    rows = (await db.execute(
        select(TikTokCategory).where(TikTokCategory.region == region)
    )).scalars().all()
    return {row.category_id: row for row in rows}


def build_inuse_tree(category_dict: Dict[str, TikTokCategory], leaf_counts: Dict[str, int]) -> list:
    """从店铺在用叶子（{叶子id: 商品数}）沿官方 parent_id 重建中文层级树。

    中间节点计数=整棵子树商品数；节点名取 zh-CN 字典；字典缺失的 id 兜底用 id 本身命名。
    """
    nodes: Dict[str, dict] = {}

    def ensure(cid: str) -> dict:
        node = nodes.get(cid)
        if node is not None:
            return node
        meta = category_dict.get(cid)
        node = {
            "category_id": cid,
            "name": meta.local_name if meta else cid,
            "parent_id": meta.parent_id if meta else None,
            "product_count": 0,
            "children": {},
        }
        nodes[cid] = node
        return node

    # 每个在用叶子沿祖先链向上，计数累加到链上全部节点
    for leaf_id, count in leaf_counts.items():
        chain = []
        cur = leaf_id
        for _ in range(_MAX_DEPTH_GUARD):
            if cur not in category_dict:
                break
            chain.append(cur)
            parent = category_dict[cur].parent_id
            if not parent or parent == "0" or parent not in category_dict or parent == cur:
                break
            cur = parent
        if not chain:
            chain = [leaf_id]  # 字典缺失兜底：孤立节点挂根
        for cid in chain:
            ensure(cid)["product_count"] += count

    roots = []
    for cid, node in nodes.items():
        pid = node["parent_id"]
        if pid and pid in nodes and pid != cid:
            nodes[pid]["children"][cid] = node
        else:
            roots.append(node)

    def emit(node: dict, ancestor_names: list) -> dict:
        path = _PATH_SEP.join(ancestor_names + [node["name"]])
        kids = sorted(node["children"].values(), key=lambda x: (-x["product_count"], x["name"]))
        return {
            "name": node["name"],
            "path": path,
            "product_count": node["product_count"],
            "category_id": node["category_id"],
            "children": [emit(child, ancestor_names + [node["name"]]) for child in kids],
        }

    roots.sort(key=lambda x: (-x["product_count"], x["name"]))
    return [emit(root, []) for root in roots]


def collect_subtree_leaf_ids(category_dict: Dict[str, TikTokCategory], category_id: str) -> Set[str]:
    """收集某节点（含自身）整棵子树下的全部叶子官方 ID，用于子树筛选。"""
    if category_id not in category_dict:
        return {category_id}  # 字典缺失兜底：仅精确匹配自身

    children_map: Dict[str, list] = {}
    for cid, row in category_dict.items():
        if row.parent_id:
            children_map.setdefault(row.parent_id, []).append(cid)

    leaves: Set[str] = set()
    stack = [category_id]
    while stack:
        cur = stack.pop()
        kids = children_map.get(cur, [])
        meta = category_dict.get(cur)
        if not kids or (meta is not None and meta.is_leaf):
            leaves.add(cur)
        stack.extend(kids)
    return leaves


def build_full_tree(category_dict: Dict[str, TikTokCategory]) -> list:
    """把 region 全量字典节点按 parent_id 组装成完整树（用于创建商品时的类目选择）。

    输出精简结构 category_id/name/is_leaf/children，按中文名排序；
    parent_id 为 "0"/空/父节点缺失的节点视为根。
    """
    children_map: Dict[str, list] = {}
    roots: list = []
    for cid, row in category_dict.items():
        pid = row.parent_id
        if pid and pid != "0" and pid in category_dict and pid != cid:
            children_map.setdefault(pid, []).append(cid)
        else:
            roots.append(cid)

    def emit(cid: str) -> dict:
        row = category_dict[cid]
        kids = sorted(
            children_map.get(cid, []),
            key=lambda child: (not category_dict[child].is_leaf, category_dict[child].local_name),
        )
        return {
            "category_id": cid,
            "name": row.local_name,
            "is_leaf": row.is_leaf,
            "children": [emit(child) for child in kids],
        }

    roots.sort(key=lambda cid: category_dict[cid].local_name)
    return [emit(cid) for cid in roots]
