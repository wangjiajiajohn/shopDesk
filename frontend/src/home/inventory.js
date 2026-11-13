// TikTok shop stock, not the warehouse system's physical inventory.
export function inventoryFor(products, orders, now = Date.now()) {
  const sales = new Map();
  const seenOrders = new Set();
  let missingDates = 0, unmatchedLines = 0;
  const rows = [];
  for (const product of products.filter(product => product.status === 'ACTIVATE')) {
    for (const sku of product.skus || []) {
      const key = `${product.shop_id}:${sku.id}`;
      if (!sku.id || sales.has(key)) continue;
      const warehouses = sku.inventory;
      const valid = Array.isArray(warehouses) && warehouses.length > 0 && warehouses.every(row => row.quantity !== null && row.quantity !== '' && Number.isInteger(Number(row.quantity)) && Number(row.quantity) >= 0);
      const stock = valid ? warehouses.reduce((sum, row) => sum + Number(row.quantity), 0) : null;
      const row = { key, productId: product.tiktok_product_id, productName: product.title, shopName: product.shop_name, skuId: sku.id, skuName: sku.seller_sku || sku.id, stock, sales7d: 0, orderIds: new Set(), syncedAt: product.synced_at };
      sales.set(key, row); rows.push(row);
    }
  }
  for (const order of orders) {
    const orderKey = `${order.shop_id}:${order.tiktok_order_id}`;
    if (seenOrders.has(orderKey) || ['UNPAID', 'CANCELLED'].includes(order.status)) continue;
    seenOrders.add(orderKey);
    const at = Number(order.paid_time || order.tiktok_create_time) * 1000;
    if (!at) { missingDates++; continue; }
    if (at < now - 7 * 86400000 || at > now) continue;
    const seenLines = new Set();
    for (const line of order.line_items || []) {
      if (line.id && seenLines.has(line.id)) continue;
      if (line.id) seenLines.add(line.id);
      const row = sales.get(`${order.shop_id}:${line.sku_id}`);
      if (!row) { unmatchedLines++; continue; }
      // TikTok normalized line_items are unit rows; accept quantity when present.
      const quantity = Number(line.quantity);
      row.sales7d += Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
      row.orderIds.add(orderKey);
    }
  }
  const result = rows.map(({ orderIds, ...row }) => ({ ...row, orders7d: orderIds.size, gap: row.stock == null ? null : Math.max(0, row.sales7d - row.stock) }));
  result.sort((a,b) => (b.gap || 0) - (a.gap || 0) || a.productName.localeCompare(b.productName) || a.skuName.localeCompare(b.skuName));
  return { rows: result, alerts: result.filter(row => row.gap > 0), unknownStock: result.filter(row => row.stock == null).length, missingDates, unmatchedLines, productCount: products.filter(product => product.status === 'ACTIVATE').length };
}
