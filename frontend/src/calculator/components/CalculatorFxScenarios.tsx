import type { computeBreakEven } from '../breakEven';
import CalculatorAmount from './CalculatorAmount';

type Sale = NonNullable<NonNullable<ReturnType<typeof computeBreakEven>['result']>['sale']>;
export default function CalculatorFxScenarios({ sale, rate, cnyRate }: { sale: Sale | null; rate: string; cnyRate: number | null }) {
  const status = !sale ? '填写有效成本后显示情景' : sale.profit <= 0 ? '当前汇率下尚无正利润' : sale.fxDownsideProfit < 0 ? '汇率敏感：基础有利润，不利情景亏损' : '不利情景仍未亏损';
  return <section className="calculator-breakdown-section" aria-labelledby="calculator-fx-heading">
    <h2 id="calculator-fx-heading">汇率压力情景</h2>
    <p className="calculator-note">基础利润按顶部汇率计算；以下仅模拟人民币回款价值变化，不计入总成本或建议价。</p>
    <dl className="calculator-breakdown" aria-live="polite">
      <div><dt>回款减少 {rate || '—'}% 后利润</dt><dd><CalculatorAmount amount={sale?.fxDownsideProfit ?? null} cnyRate={cnyRate} /></dd></div>
      <div><dt>回款增加 {rate || '—'}% 后利润</dt><dd><CalculatorAmount amount={sale?.fxUpsideProfit ?? null} cnyRate={cnyRate} /></dd></div>
    </dl>
    <p className="calculator-note" role="status">{status}</p>
  </section>;
}
