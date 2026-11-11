import { computeBreakEven, type CalculatorOptions, type CalculatorPromotions, type CalculatorValues } from './breakEven';

export function computePricingPlan(values: CalculatorValues, fx: string, agencyFx: string, promotions: CalculatorPromotions, rates: CalculatorOptions['rates'], targetMarginPercent = 50, presetDiscount = 0.8) {
  if (!Number.isFinite(presetDiscount) || presetDiscount <= 0 || presetDiscount > 1) return { state: 'incomplete' as const, plan: null };
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent >= 100) return { state: 'incomplete' as const, plan: null };
  // This independent recommendation supplies its own discount and uses MXN prices.
  const inputs = { ...values, sale: '', discount: '0' };
  const options = { rates: { ...rates, sale: 1, discount: 1 }, discountMode: 'fixed' as const };
  const target = computeBreakEven(inputs, fx, true, agencyFx, promotions, { ...options, targetMargin: targetMarginPercent / 100 });
  if (!target.result) return { state: 'incomplete' as const, plan: null };
  if (target.result.breakEven === null) return { state: 'unreachable' as const, plan: null };
  const targetCents = Math.round(target.result.breakEven * 100);
  const retailCents = Math.ceil((targetCents / presetDiscount) - 1e-9);
  // Conservatively round the 8折 payment down to cents before verifying its margin.
  const finalCents = Math.floor(retailCents * presetDiscount + 1e-9);
  const finalPrice = finalCents / 100;
  const sale = computeBreakEven({ ...inputs, sale: finalPrice.toFixed(2) }, fx, true, agencyFx, promotions, options).result?.sale;
  if (!sale || sale.margin === null || sale.margin < targetMarginPercent - 1e-8) return { state: 'unreachable' as const, plan: null };
  return { state: 'ready' as const, plan: { targetPrice: targetCents / 100, retailPrice: retailCents / 100, finalPrice, profit: sale.profit, margin: sale.margin } };
}
