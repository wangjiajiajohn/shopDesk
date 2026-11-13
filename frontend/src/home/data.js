import * as api from '../api';

// Read the existing account-scoped online cache. Never silently truncate totals.
export async function loadOrders(shopId = 'ALL', extra = {}) {
  const first = await api.getShopOrders(shopId, { ...extra, page: 1, page_size: 100 });
  const pages = Math.ceil(first.total / 100);
  if (pages > 100) throw new Error('订单超过当前浏览器统计上限，请缩小店铺范围后重试。');
  const items = [...first.items];
  for (let page = 2; page <= pages; page++) {
    const result = await api.getShopOrders(shopId, { ...extra, page, page_size: 100 });
    if (result.total !== first.total) throw new Error('读取期间订单发生变化，请同步后重试。');
    items.push(...result.items);
  }
  if (new Set(items.map(row => `${row.shop_id}-${row.tiktok_order_id}`)).size !== first.total) throw new Error('订单快照分页不完整，请同步后重试。');
  return { ...first, items };
}
export async function loadMonitor(shopId = 'ALL') {
  const params = { page_size: 50, ...(shopId === 'ALL' ? {} : { shop_id: shopId }) };
  const first = await api.getOrderMonitor({ ...params, page: 1 });
  const pages = Math.ceil(first.total / 50);
  if (pages > 200) throw new Error('待履约订单较多，请缩小店铺范围后重试。');
  const items = [...first.items];
  for (let page = 2; page <= pages; page++) {
    const result = await api.getOrderMonitor({ ...params, page });
    if (result.total !== first.total) throw new Error('读取期间提醒发生变化，请重试同步。');
    items.push(...result.items);
  }
  if (new Set(items.map(row => `${row.shop_id}-${row.order_id}`)).size !== first.total) throw new Error('提醒分页不完整，请重试同步。');
  return { ...first, items };
}

export async function loadProducts(shops) {
  const products = [];
  for (const shop of shops) {
    const params = { status: 'ACTIVATE', page_size: 100 };
    const first = await api.getShopProducts(shop.id, { ...params, page: 1 });
    const pages = Math.ceil(first.total / 100);
    if (pages > 200) throw new Error('在售商品超过当前浏览器统计上限，请缩小店铺范围。');
    const items = [...first.items];
    for (let page = 2; page <= pages; page++) {
      const next = await api.getShopProducts(shop.id, { ...params, page });
      if (next.total !== first.total) throw new Error('商品读取期间发生变化，请重新同步。');
      items.push(...next.items);
    }
    if (new Set(items.map(item => item.tiktok_product_id)).size !== first.total) throw new Error('在售商品分页不完整，请重新同步。');
    products.push(...items.map(item => ({ ...item, shop_id: shop.id, shop_name: shop.shop_name })));
  }
  return products;
}
