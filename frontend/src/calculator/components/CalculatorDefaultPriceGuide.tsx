import { defaultPriceFormula } from '../breakEven';
import { yuan } from './CalculatorAmount';

export default function CalculatorDefaultPriceGuide({ fx }: { fx: string | null }) {
  const formula = defaultPriceFormula();
  const rate = fx === null ? null : Number(fx);
  const equivalent = (amount: number) => rate === null ? '人民币换算需有效汇率' : `约人民币 ${yuan(amount / rate)}`;
  return <section className="calculator-panel calculator-price-guide" aria-labelledby="calc-default-guide-heading">
    <h2 id="calc-default-guide-heading">默认配置 · 保本公式（比索，含 0.5% 回款手续费，不含汇率压力扣减）</h2>
    <p className="calculator-note"><strong>采购价不超过 {formula.threshold.toFixed(2)} 比索（{equivalent(formula.threshold)}）：保本价 ≈ 采购价 × {formula.lowerMultiplier.toFixed(3)} ＋ {formula.lowerFixed.toFixed(2)} 比索（{equivalent(formula.lowerFixed)}）。</strong></p>
    <p className="calculator-note"><strong>采购价超过 {formula.threshold.toFixed(2)} 比索（{equivalent(formula.threshold)}）：保本价 ≈ 采购价 × {formula.upperMultiplier.toFixed(3)} ＋ {formula.upperFixed.toFixed(2)} 比索（{equivalent(formula.upperFixed)}）。</strong></p>
  </section>;
}
