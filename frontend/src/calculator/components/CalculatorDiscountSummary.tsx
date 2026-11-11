import { ChevronRight } from 'lucide-react';
import type { computePricingFlow } from '../pricingFlow';
import { CalculatorFigure } from './CalculatorAmount';

export default function CalculatorDiscountSummary({ flow }: { flow: ReturnType<typeof computePricingFlow> }) {
  const list = flow.pricing.plan?.retailPrice;
  const base = flow.base.result?.sale?.net;
  const final = flow.after.result?.sale?.net;
  const ready = list != null && base != null && final != null && list > 0;
  return <details className="calculator-decision-details calculator-discount-total">
    <summary><span><ChevronRight size={16} aria-hidden="true" />合计优惠金额</span><span><CalculatorFigure amount={ready ? list - final : null} />{ready && <small className="calculator-combined-fold">相当于标价 {(final / list * 10).toFixed(2)} 折（减 {(100 - final / list * 100).toFixed(2)}%）</small>}</span></summary>
    <dl className="calculator-decision-prices">
      <div><dt>预设优惠金额</dt><dd><CalculatorFigure amount={ready ? list - base : null} /></dd></div>
      <div><dt>额外优惠金额</dt><dd><CalculatorFigure amount={ready ? base - final : null} /></dd></div>
    </dl>
    <p>广告、达人佣金及运费计入成本，不包含在买家优惠金额中。</p>
  </details>;
}
