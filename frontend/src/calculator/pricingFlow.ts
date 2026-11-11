import { computeBreakEven, promotionDefaults, type CalculatorOptions, type CalculatorPromotions, type CalculatorValues } from './breakEven';
import { computePricingPlan } from './pricingPlan';

// Fix the base price first; subsequent spending must never silently reprice it.
export function computePricingFlow(values: CalculatorValues, fx: string, agencyFx: string, rates: CalculatorOptions['rates'], target: number, presetFold: number, promotions: CalculatorPromotions, _discountMode: 'fixed' | 'fold', extraShipping = '0', activityPrice?: string) {
  const preset = presetFold / 10;
  const pricing = computePricingPlan(values, fx, agencyFx, promotionDefaults, rates, target, preset);
  const baseValues = { ...values, sale: pricing.plan?.retailPrice.toFixed(2) ?? '', discount: '0' };
  const base = computeBreakEven(baseValues, fx, true, agencyFx, promotionDefaults, { rates: { ...rates, sale: 1, discount: 1 }, presetDiscount: preset });
  const extraValid = /^\d{1,9}(\.\d{1,2})?$/.test(extraShipping);
  const activity = activityPrice !== undefined;
  const hasActivityInput = activity && Boolean(activityPrice?.trim());
  const resolvedActivityPrice = activityPrice?.trim() || baseValues.sale;
  const activityPriceError = activity && activityPrice?.trim() && (!/^\d{1,9}(\.\d{1,2})?$/.test(resolvedActivityPrice) || Number(resolvedActivityPrice) <= 0) ? '请输入大于0的活动价，最多两位小数。' : undefined;
  const after = computeBreakEven({ ...values, discount: '0', sale: hasActivityInput ? resolvedActivityPrice : baseValues.sale, shipping: extraValid && /^\d{1,9}(\.\d{1,2})?$/.test(values.shipping) ? (Number(values.shipping) + Number(extraShipping)).toFixed(2) : 'invalid' }, fx, true, agencyFx, promotions, { rates: { ...rates, sale: 1 }, presetDiscount: hasActivityInput ? 1 : preset, discountMode: 'fixed' });
  if (activityPriceError) after.result = null;
  return { pricing, base, after, activity, hasActivityPrice: activity && Boolean(activityPrice?.trim()) && !activityPriceError, activityPriceError, extraShippingError: extraValid ? undefined : '请输入非负金额，最多两位小数。' };
}

export function computePromotionLimits(values: CalculatorValues, fx: string, agencyFx: string, rates: CalculatorOptions['rates'], target: number, presetFold: number, _discountMode: 'fixed' | 'fold', extraShipping = '0', floorMargin = 20, activityPrice?: string) {
  const none = { advertising: false, creator: false, external: false };
  const flow = computePricingFlow(values, fx, agencyFx, rates, target, presetFold, none, _discountMode, extraShipping, activityPrice);
  const price = flow.activity ? flow.after.result?.sale?.price : flow.pricing.plan?.retailPrice;
  return [floorMargin, 0].map(floor => {
    if (price == null || !flow.after.result?.sale) return { floor, creator: null, roi: null };
    const input = { ...values, discount: '0', sale: price.toFixed(2), shipping: (Number(values.shipping) + Number(extraShipping)).toFixed(2) };
    const options = { rates: { ...rates, sale: 1 }, presetDiscount: flow.hasActivityPrice ? 1 : presetFold / 10, discountMode: 'fixed' as const };
    const margin = (creator: number, advertisingRate: number) => computeBreakEven({ ...input, creator: creator.toFixed(2), roi: advertisingRate === 0 ? '0' : (116 / advertisingRate).toFixed(2) }, fx, true, agencyFx, { advertising: advertisingRate > 0, creator: true, external: false }, options).result?.sale?.margin ?? -Infinity;
    if (margin(0, 0) < floor - 1e-8) return { floor, creator: null, roi: null };
    // Search the actual supported two-decimal inputs; all other acquisition spends are off.
    let low = 0, high = 10000;
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (margin(mid / 100, 0) >= floor - 1e-8) low = mid; else high = mid - 1; }
    const creator = low / 100;
    const atRoi = (cents: number) => computeBreakEven({ ...input, creator: '0', roi: (cents / 100).toFixed(2) }, fx, true, agencyFx, { advertising: true, creator: false, external: false }, options).result?.sale?.margin ?? -Infinity;
    low = 1; high = 99999999999;
    if (atRoi(high) < floor - 1e-8) return { floor, creator, roi: null };
    while (low < high) { const mid = Math.floor((low + high) / 2); if (atRoi(mid) >= floor - 1e-8) high = mid; else low = mid + 1; }
    return { floor, creator, roi: low / 100 };
  });
}
