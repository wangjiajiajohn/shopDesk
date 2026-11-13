// 参考商品数据集：来源为墨西哥 TikTok 选品采集快照，数据按账号隔离存于后端
import { request } from './api';
import { parseMaterialNumberQuery } from './materialNumbers';
export { materialNumberLabel } from './materialNumbers';

// 图片仍走静态文件（素材共享），路径必须是 images/ 或 previews/ 下的哈希文件名
export const REFERENCE_ROOT = 'product-references/mx-20261107/';

// 拼接参考图片地址
export function referenceAsset(path) {
  if (!/^(images|previews)\/[a-f0-9]{64}\.(webp|png|jpe?g|gif)$/.test(path)) return '';
  return `${import.meta.env.BASE_URL}${REFERENCE_ROOT}${path}`;
}

// 从后端 API 获取参考商品索引（按当前登录账号隔离）
export async function loadReferenceIndex(signal) {
  const index = await request('/reference-products/index', { signal });
  if (!index || !Array.isArray(index.items) || !Array.isArray(index.categories)) {
    throw new Error('参考商品目录格式不正确');
  }
  return index;
}

// 合并 7 天与 28 天两套排名：同类目只留一条，28 天排名优先
function mergePlacements(primary, secondary) {
  const seen = new Set();
  const out = [];
  for (const p of [...primary, ...secondary]) {
    if (!p || !p.category || seen.has(p.category)) continue;
    seen.add(p.category);
    out.push(p);
  }
  return out;
}

// 统一成一品一条：7 天与 28 天排名合并、商品按 ID 去重、两个周期销量并列保留
export function selectReferencePage(index, filters) {
  const query = (filters.query || '').trim().normalize('NFKC').toLowerCase();
  const numberQuery = parseMaterialNumberQuery(query);
  const seenIds = new Set();
  const unified = [];

  for (const item of index.items) {
    if (seenIds.has(item.id)) continue; // 去重：同一商品只保留一条
    seenIds.add(item.id);

    const sales28 = item.sales28 ?? null;
    const sales7 = item.sales7 ?? null;
    const primary28 = sales28 != null;
    const sales28Text = sales28 == null ? '未取得' : (item.sales28Display || sales28.toLocaleString('zh-CN'));
    const sales7Text = sales7 == null ? '未取得' : sales7.toLocaleString('zh-CN');

    unified.push({
      ...item,
      displayPlacements: mergePlacements(item.placements28 || [], item.placements || []),
      sales28,
      sales7,
      sales28Text,
      sales7Text,
      displayPeriod: primary28 ? 28 : 7,
      displaySales: primary28 ? sales28 : sales7,
      displaySalesText: primary28 ? sales28Text : sales7Text,
    });
  }

  const filtered = unified
    .filter((item) => {
      // 类目筛选：优先用官方树解析出的 FastMoss 名集合（filters.categories），
      // 兼容旧的单字符串 filters.category；细分收窄时 category 覆盖 categories。
      const catList = filters.category
        ? [filters.category]
        : (Array.isArray(filters.categories) && filters.categories.length ? filters.categories : []);
      const inCategory = catList.length === 0
        || item.displayPlacements.some((p) => catList.includes(p.category))
        || catList.includes(item.archiveCategory);
      const inQuery = !query || (numberQuery !== null ? item.materialNumber === numberQuery : (item.searchText || '').normalize('NFKC').toLowerCase().includes(query));
      return inCategory && inQuery;
    })
    .sort((a, b) => {
      // 先按同口径的 28 天销量排；无 28 天数据的排后，再按 7 天销量
      const a28 = a.sales28 ?? -Infinity;
      const b28 = b.sales28 ?? -Infinity;
      if (a28 !== b28) return b28 - a28;
      return (b.sales7 ?? -Infinity) - (a.sales7 ?? -Infinity);
    });

  const size = [12, 15, 24].includes(filters.pageSize) ? filters.pageSize : 15;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(filters.page) || 1));
  return { items: filtered.slice((page - 1) * size, page * size), total: filtered.length, pages, page };
}

const detailCache = new Map();

// 并发拉取本页商品详情（最多 4 并发），已读过的走内存缓存
export async function loadReferencePage(items, signal) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const position = next++;
      const item = items[position];
      const id = item.id;
      if (!/^\d{19}$/.test(id)) throw new Error('参考商品编号无效');
      let product = detailCache.get(id);
      if (!product) {
        product = await request(`/reference-products/${id}`, { signal });
        if (product.id !== id || typeof product.title !== 'string' || !Array.isArray(product.images)) {
          throw new Error('参考商品资料不完整');
        }
        detailCache.set(id, product);
      }
      results[position] = {
        ...product,
        materialNumber: item.materialNumber ?? product.materialNumber,
        sales7: item.sales7 ?? product.sales7 ?? null,
        sales28: item.sales28 ?? null,
        sales7Text: item.sales7Text,
        sales28Text: item.sales28Text,
        displayPeriod: item.displayPeriod ?? 7,
        displaySales: item.displaySales === undefined ? product.sales7 : item.displaySales,
        displaySalesText: item.displaySalesText,
        displayPlacements: item.displayPlacements ?? product.placements,
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return results;
}
