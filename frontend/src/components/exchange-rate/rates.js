export const RATE_SOURCE = 'Frankfurter / ECB';
export function normalizeRates(data, currency) {
  if (!Array.isArray(data)) throw new Error('汇率数据格式异常');
  const dates = new Map();
  for (const row of data) {
    if (row.base !== 'CNY' || row.quote !== currency || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    dates.set(row.date, { date: row.date, rate: row.rate });
  }
  const rows = [...dates.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if (!rows.length) throw new Error('该币种暂无可用参考汇率');
  return rows;
}
export function ratePoints(rows, width, height, padding = 5) {
  const values = rows.map(row=>row.rate), low = Math.min(...values), high = Math.max(...values), span = high-low;
  return rows.map((row,i)=>({ ...row, x: padding + i / Math.max(1, rows.length-1) * (width-padding*2), y: span ? padding + (high-row.rate)/span*(height-padding*2) : height/2 }));
}
