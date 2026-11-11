import { Minus, Plus } from 'lucide-react';
export default function CalculatorDiscountStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const valid = /^\d+(\.\d+)?$/.test(value) && Number(value) > 0 && Number(value) <= 10;
  const adjust = (delta: number) => onChange((Math.min(10, Math.max(.1, (valid ? Number(value) : 8) + delta))).toFixed(2).replace(/\.?0+$/, ''));
  return <div className="calculator-discount-stepper-row">
    <label htmlFor="calc-preset-fold">日常商品折扣</label>
    <div className="calculator-discount-stepper">
      <button type="button" aria-label="减少商品折扣0.5折" disabled={valid && Number(value) <= .1} onClick={() => adjust(-.5)}><Minus size={16} aria-hidden="true" /></button>
      <input id="calc-preset-fold" aria-label="日常商品折扣" inputMode="decimal" value={value} aria-invalid={!valid} aria-describedby={!valid ? 'calc-preset-fold-error' : undefined} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); adjust(e.key === 'ArrowUp' ? .5 : -.5); } }} />
      <span>折</span><button type="button" aria-label="增加商品折扣0.5折" disabled={valid && Number(value) >= 10} onClick={() => adjust(.5)}><Plus size={16} aria-hidden="true" /></button>
    </div>
    {!valid && <p id="calc-preset-fold-error" className="calculator-error">请输入大于0、最多10的折扣。</p>}
  </div>;
}
