export const TIME_ZONE = 'America/Mexico_City';
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
export function mexicoParts(timestamp = Date.now()) {
  return Object.fromEntries(dateParts.formatToParts(new Date(timestamp)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}
export function mexicoDate(timestamp = Date.now()) {
  const p = mexicoParts(timestamp); return `${p.year}-${p.month}-${p.day}`;
}
const dayDate = key => new Date(`${key}T12:00:00Z`);
const keyOf = date => date.toISOString().slice(0, 10);
export function addDays(key, count) { const date = dayDate(key); date.setUTCDate(date.getUTCDate() + count); return keyOf(date); }
export function periodFor(anchor, grain) {
  const date = dayDate(anchor);
  let start = anchor, end = anchor;
  if (grain === 'week') { start = addDays(anchor, -((date.getUTCDay() + 6) % 7)); end = addDays(start, 6); }
  if (grain === 'month') { start = `${anchor.slice(0, 7)}-01`; end = keyOf(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12))); }
  return { start, end };
}
export function shiftPeriod(anchor, grain, direction) {
  const { start } = periodFor(anchor, grain);
  if (grain !== 'month') return addDays(start, direction * (grain === 'week' ? 7 : 1));
  const date = dayDate(start); date.setUTCMonth(date.getUTCMonth() + direction); return keyOf(date);
}
export function percentage(value, previous) { return previous > 0 ? (value - previous) / previous * 100 : null; }
export function statsFor(orders, anchor, grain, now = Date.now()) {
  const period = periodFor(anchor, grain);
  const previous = periodFor(shiftPeriod(anchor, grain, -1), grain);
  const today = mexicoDate(now), thisHour = Number(mexicoParts(now).hour);
  const buckets = [];
  if (grain === 'day') {
    for (let hour = 0; hour < 24; hour++) buckets.push({ key: `${anchor}-${hour}`, label: `${hour}时`, date: anchor, hour, gmv: 0, orders: 0, future: anchor === today && hour > thisHour });
  } else {
    for (let day = period.start; day <= period.end; day = addDays(day, 1)) {
      const dayIndex = (dayDate(day).getUTCDay() + 6) % 7;
      buckets.push({ key: day, date: day, label: grain === 'week' ? `${['周一','周二','周三','周四','周五','周六','周日'][dayIndex]} ${day.slice(5).replace('-', '/')}` : String(Number(day.slice(8))), gmv: 0, orders: 0, future: day > today });
    }
  }
  const ongoing = today >= period.start && today <= period.end;
  const dayOffset = Math.round((dayDate(today) - dayDate(period.start)) / 86400000);
  const comparisonEnd = ongoing ? addDays(previous.start, dayOffset) : previous.end;
  const localTime = timestamp => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp));
  const cutoffTime = localTime(now);
  for (const [index, bucket] of buckets.entries()) {
    bucket.previousDate = grain === 'day' ? previous.start : addDays(previous.start, index);
    bucket.previousGmv = 0; bucket.previousOrders = 0;
    bucket.previousMissing = bucket.previousDate > previous.end;
  }
  let gmv = 0, count = 0, previousGmv = 0, previousCount = 0, missingDates = 0;
  const currencies = new Set();
  for (const order of orders) {
    if (['UNPAID', 'CANCELLED'].includes(order.status)) continue;
    if (!order.tiktok_create_time) { missingDates++; continue; }
    if (order.tiktok_create_time * 1000 > now) continue;
    const p = mexicoParts(order.tiktok_create_time * 1000), date = `${p.year}-${p.month}-${p.day}`;
    const amount = Number(order.total_amount || 0);
    if (date >= previous.start && date <= period.end && order.currency) currencies.add(order.currency);
    if (date >= previous.start && date <= previous.end && (!ongoing || date < comparisonEnd || (date === comparisonEnd && localTime(order.tiktok_create_time * 1000) <= cutoffTime))) {
      previousGmv += amount; previousCount++;
      const bucket = grain === 'day' ? buckets[Number(p.hour)] : buckets.find(item => item.previousDate === date);
      if (bucket) { bucket.previousGmv += amount; bucket.previousOrders++; }
    }
    if (date < period.start || date > period.end) continue;
    gmv += amount; count++;
    const bucket = grain === 'day' ? buckets[Number(p.hour)] : buckets.find(item => item.date === date);
    if (bucket && !bucket.future) { bucket.gmv += amount; bucket.orders++; }
  }
  const average = count ? gmv / count : 0, previousAverage = previousCount ? previousGmv / previousCount : 0;
  return { ...period, previous, ongoing, gmv, orders: count, average, previousGmv, previousOrders: previousCount, currencies: [...currencies], missingDates, buckets,
    changes: { gmv: percentage(gmv, previousGmv), orders: percentage(count, previousCount), average: percentage(average, previousAverage) } };
}

export function deadlineBucket(seconds) {
  if (seconds < 0) return 'overdue';
  if (seconds < 6 * 3600) return 'under6';
  return 'six24';
}
export function alertRemaining(item) {
  return item.risk === 'cancellation' && item.cancel_remaining_seconds != null ? item.cancel_remaining_seconds : item.remaining_seconds;
}
export function shippingAlerts(monitor, orders, nowSeconds = Date.now() / 1000, horizonSeconds = 86400) {
  const lookup = new Map(orders.map(order => [`${order.shop_id}-${order.tiktok_order_id}`, order]));
  const items = (monitor?.items || []).flatMap(item => {
    const stageRemaining = item.deadline ? item.deadline - nowSeconds : null;
    const cancelRemaining = item.cancel_deadline ? item.cancel_deadline - nowSeconds : null;
    const cancellation = cancelRemaining != null && cancelRemaining <= 86400;
    if (!cancellation && (stageRemaining == null || stageRemaining > horizonSeconds)) return [];
    const remaining = cancellation ? cancelRemaining : stageRemaining;
    const order = lookup.get(`${item.shop_id}-${item.order_id}`);
    const names = new Map();
    for (const line of order?.line_items || []) {
      const name = line.product_name || '商品'; names.set(name, (names.get(name) || 0) + (Number(line.quantity) || 1));
    }
    const itemsText = names.size ? [...names].map(([name, quantity]) => `${name} ×${quantity}`).join('；') : item.product_name;
    return [{ ...item, itemsText, remaining_seconds: stageRemaining, cancel_remaining_seconds: cancelRemaining, risk: cancellation ? 'cancellation' : stageRemaining < 0 ? 'overdue' : 'due_soon', remaining, bucket: deadlineBucket(remaining), urgent: remaining < 21600 }];
  });
  return items.sort((a, b) => a.remaining - b.remaining || a.order_id.localeCompare(b.order_id));
}

export function matchesDeadlineFilter(seconds, filter) {
  if (seconds == null) return false;
  if (filter === "under24") return seconds >= 0 && seconds < 86400;
  if (filter === "under48") return seconds >= 0 && seconds < 172800;
  if (filter === "overdue") return seconds < 0;
  return deadlineBucket(seconds) === filter;
}
