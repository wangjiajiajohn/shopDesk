import { computeBreakEven, type CalculatorOptions, type CalculatorPromotions, type CalculatorValues } from './breakEven';
import { computePricingPlan } from './pricingPlan';

export function computeCalculatorScenarios(values: CalculatorValues, fx: string, agencyFx: string, promotions: CalculatorPromotions, options: CalculatorOptions, targetMargin: number) {
  return [
    { label: '含风险预留与平台佣金', risks: true, commission: true },
    { label: '不含风险预留与平台佣金', risks: false, commission: false },
    { label: '不含风险预留，含平台佣金', risks: false, commission: true },
  ].map(scenario => {
    const inputs = { ...values, ...(!scenario.risks ? { returnRate: '0', fxRiskRate: '0', remittanceRate: '0' } : {}), ...(!scenario.commission ? { commission: '0' } : {}) };
    return { ...scenario, result: computeBreakEven(inputs, fx, true, agencyFx, promotions, options).result,
      pricingPlan: computePricingPlan(inputs, fx, agencyFx, { advertising: false, creator: false, external: false }, options.rates, targetMargin) };
  });
}
