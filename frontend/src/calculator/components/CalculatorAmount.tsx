const money = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'MXN', currencyDisplay: 'code' }).format(amount);
const yuan = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);

export { money, yuan };

export default function CalculatorAmount({ amount, cnyRate }: { amount: number | null; cnyRate: number | null }) {
  if (amount === null) return <>—</>;
  const showYuan = cnyRate !== null && Number.isFinite(cnyRate) && cnyRate > 0;
  return <span className="calculator-money-pair">
    <span>{money(amount)}</span>
    {showYuan && <span className="calculator-yuan" aria-label={`人民币 ${yuan(amount / cnyRate)}`}>（{yuan(amount / cnyRate)}）</span>}
  </span>;
}

// Large result figures keep the unit subordinate and the numeric baselines aligned.
export function CalculatorFigure({ amount, currency = 'MXN', cnyRate }: { amount: number | null; currency?: 'MXN' | '人民币'; cnyRate?: number | null }) {
  return amount === null ? <>—</> : <span className="calculator-figure"><span>{new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}</span><small>{currency}</small>{currency === 'MXN' && cnyRate != null && Number.isFinite(cnyRate) && cnyRate > 0 && <small className="calculator-cny-reference">（{yuan(amount / cnyRate)}）</small>}</span>;
}
