import type { ReactNode } from 'react';
import CalculatorTabs from './CalculatorTabs';
const modes = [['fixed', '固定优惠'], ['fold', '折扣']] as const;
type Mode = typeof modes[number][0];
export default function CalculatorDiscountTabs({ mode, onChange, children, compact = false }: { compact?: boolean; mode: Mode; onChange: (mode: Mode) => void; children: ReactNode }) {
  return <section className={`calculator-discount${compact ? ' calculator-discount-inline' : ' calculator-panel'}`} aria-labelledby="calc-discount-heading">
    <h2 id="calc-discount-heading">{compact ? <>额外让利<small className="calculator-optional">（商家优惠）</small></> : '活动价格'}</h2>
    <CalculatorTabs id="calc-discount" label="额外让利方式" value={mode} options={modes} onChange={onChange}>{children}</CalculatorTabs>
  </section>;
}
