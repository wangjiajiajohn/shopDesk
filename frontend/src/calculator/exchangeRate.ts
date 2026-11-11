import { isNative, nativeCall } from './repository';
export type PurchaseCurrency = 'CNY' | 'USD' | 'MXN';
export type ExchangeQuote = { base: string; quote: string; rate: number; date: string; fetchedAt: string };
export function parseExchangeQuote(value: unknown, base: string): ExchangeQuote {
  const item = value as Partial<ExchangeQuote> | null;
  if (!item || item.base?.toUpperCase() !== base || item.quote?.toUpperCase() !== 'MXN' || typeof item.rate !== 'number' || !Number.isFinite(item.rate) || item.rate <= 0 || item.rate > 1_000_000 || !/^\d{4}-\d{2}-\d{2}$/.test(item.date ?? '') || !Number.isFinite(Date.parse(item.date!))) throw new Error('汇率服务返回了无效数据。');
  return { base, quote: 'MXN', rate: item.rate, date: item.date!, fetchedAt: new Date().toISOString() };
}
export async function fetchExchangeRate(base: Exclude<PurchaseCurrency, 'MXN'>, signal?: AbortSignal) {
  let value: unknown;
  if (isNative()) value = await nativeCall('exchangeRate', base);
  else {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/mxn`, { signal: signal ?? AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('自动汇率暂时不可用。');
    value = await response.json();
  }
  return parseExchangeQuote(value, base);
}
