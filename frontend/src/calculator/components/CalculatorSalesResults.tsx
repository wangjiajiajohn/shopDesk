import type { ReactNode } from 'react';

type Props = { discountInput: ReactNode; targetInput: ReactNode; comparison: ReactNode; children: ReactNode };
export default function CalculatorSalesResults({ discountInput, targetInput, comparison, children }: Props) {
  return <section className="calculator-sales" aria-label="销售价格与利润">
    <p className="calculator-note">预设八折已自动计入；以下优惠在八折后额外叠加。</p><div className="calculator-pricing-controls">{targetInput}{discountInput}</div>
    <div className="calculator-promotion-inputs">{children}</div>
    {comparison}
  </section>;
}
