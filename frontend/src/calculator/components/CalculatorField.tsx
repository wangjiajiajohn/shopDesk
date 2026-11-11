import CalculatorCurrencySelect, { type AmountCurrency } from './CalculatorCurrencySelect';
export type { AmountCurrency } from './CalculatorCurrencySelect';
import type { CalculatorValues } from '../breakEven';

type Props = {
  id: keyof CalculatorValues | 'target-margin' | 'preset-fold' | 'extra-shipping' | 'activity-price'; label: string; value: string; onChange: (value: string) => void;
  error?: string; hint?: string; suffix?: string; currency?: AmountCurrency;
  onCurrencyChange?: (currency: AmountCurrency) => void;
};

export default function CalculatorField({ id, label, value, onChange, error, hint, suffix, currency, onCurrencyChange }: Props) {
  return <div className="calculator-field">
    <label htmlFor={`calc-${id}`}>{label}</label>
    <div className={`calculator-input-group${error ? ' has-error' : ''}`}>
      <input id={`calc-${id}`} type="text" inputMode="decimal" autoComplete="off" value={value} placeholder="请输入" onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `calc-error-${id}` : hint ? `calc-hint-${id}` : undefined} />
      {currency && onCurrencyChange ? <CalculatorCurrencySelect id={`calc-${id}`} label={label} value={currency} onChange={onCurrencyChange} /> : suffix ? <span className="calculator-input-suffix">{suffix}</span> : null}
    </div>
    {hint && <small id={`calc-hint-${id}`} className="calculator-note">{hint}</small>}
    {error && <small id={`calc-error-${id}`} className="calculator-error">{error}</small>}
  </div>;
}
