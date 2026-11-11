export function convertQuickAmount(raw: string, fx: string, source: 'CNY' | 'MXN') {
  if (!raw.trim()) return { amount: null, error: '' };
  if (!/^\d{1,15}(\.\d{1,3})?$/.test(raw.trim())) return { amount: null, error: '请输入非负金额，最多三位小数。' };
  const rate = Number(fx);
  if (!/^\d+(\.\d{1,8})?$/.test(fx.trim()) || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) return { amount: null, error: '请先填写有效汇率。' };
  return { amount: source === 'CNY' ? Number(raw) * rate : Number(raw) / rate, error: '' };
}

// Direction changes only derive a display; the shared CNY→MXN string is untouched.
export function displayDirectionalRate(fx: string, source: 'CNY' | 'MXN') {
  if (!/^\d+(\.\d{1,8})?$/.test(fx.trim()) || !Number.isFinite(Number(fx)) || Number(fx) <= 0 || Number(fx) > 1_000_000) return '';
  return source === 'CNY' ? fx : (1 / Number(fx)).toFixed(3);
}

// Only an explicit edit is converted back to the existing canonical 8-decimal format.
export function canonicalRateFromEdit(raw: string, source: 'CNY' | 'MXN') {
  if (!/^\d+(\.\d{1,8})?$/.test(raw.trim()) || !Number.isFinite(Number(raw)) || Number(raw) <= 0) return { fx: null, error: '请输入有效的正汇率，最多八位小数。' };
  const rate = source === 'CNY' ? Number(raw) : 1 / Number(raw);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000 || rate < 0.00000001) return { fx: null, error: '换算后的人民币兑 MXN 汇率超出有效范围。' };
  return { fx: source === 'CNY' ? raw.trim() : rate.toFixed(8).replace(/\.?0+$/, ''), error: '' };
}
