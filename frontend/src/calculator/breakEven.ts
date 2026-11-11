export const costFields = [
  { id: 'purchase', label: '采购原价' }, { id: 'shipping', label: '商家承担运费 MXN' },
  { id: 'other', label: '其他成本 MXN' }, { id: 'agency', label: '单件代采费 MXN' },
] as const;
export const feeFields = [
  { id: 'commission', label: '平台佣金 %' }, { id: 'sfp', label: 'SFP %（每件封顶 40 MXN）' },
  { id: 'fixed', label: '每件销售费 MXN' }, { id: 'returnRate', label: '退货率 %' }, { id: 'remittanceRate', label: '回款手续费率 %' }, { id: 'fxRiskRate', label: '汇率压力幅度 %' },
] as const;
export type CalculatorValues = Record<typeof costFields[number]['id'] | typeof feeFields[number]['id'] | 'sale' | 'discount' | 'buyerShipping' | 'platformShipping' | 'roi' | 'creator' | 'external', string>;
export const calculatorDefaults: CalculatorValues = { purchase: '', shipping: '0', other: '0', agency: '', commission: '6', sfp: '8', fixed: '6', creator: '0', external: '0', sale: '', discount: '0', buyerShipping: '59', platformShipping: '0', roi: '0', returnRate: '10', remittanceRate: '0.5', fxRiskRate: '5' };
export type CalculatorPromotions = { creator: boolean; advertising: boolean; external: boolean };
export const promotionDefaults: CalculatorPromotions = { creator: false, advertising: false, external: false };
export type CalculatorMoneyField = 'purchase' | 'agency' | 'other' | 'shipping' | 'platformShipping' | 'buyerShipping' | 'fixed' | 'sale' | 'discount';
export type CalculatorOptions = { rates?: Partial<Record<CalculatorMoneyField, number>>; discountMode?: 'fixed' | 'fold'; targetMargin?: number; presetDiscount?: number };
// Valid-RFC estimate: remove included 16% IVA before applying both withholdings.
const taxRate = (0.025 + 0.16 * 0.5) / 1.16;
export function computeBreakEven(values: CalculatorValues, fx: string, useAgency: boolean, agencyFx = '1', promotions: CalculatorPromotions = promotionDefaults, options: CalculatorOptions = {}) {
  const errors: Record<string, string> = {};
  const numbers: Record<string, number> = {};
  const targetMargin = options.targetMargin ?? 0;
  if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin >= 1) errors.targetMargin = '目标利润率须在 0%（含）到 100%（不含）之间。';
  if (promotions.creator && promotions.external) errors.promotions = '达人与外部流量须选择一种佣金来源，避免重复扣费。';
  let missing = false;
  for (const { id } of [...costFields, ...feeFields, { id: 'buyerShipping' } as const, { id: 'platformShipping' } as const, { id: 'creator' } as const, { id: 'external' } as const]) {
    if ((id === 'creator' || id === 'external') && !promotions[id]) { numbers[id] = 0; continue; }
    if (id === 'agency' && !useAgency) { numbers.agency = 0; continue; }
    const raw = values[id].trim();
    if (!raw) {
      if (id === 'fxRiskRate') errors.fxRiskRate = '请输入汇率压力幅度，不模拟波动时填 0。';
      if (id === 'remittanceRate') errors.remittanceRate = '请输入回款手续费率，无手续费时填 0。';
      if (id === 'returnRate') errors.returnRate = '请输入退货率，不预留损失时填 0。';
      if (id === 'buyerShipping') errors.buyerShipping = '请输入预计买家运费，无需预留时填 0。';
      missing = true; continue;
    }
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) { errors[id] = '请输入非负金额或比例，最多两位小数。'; continue; }
    numbers[id] = Number(raw);
    const conversion = options.rates?.[id as CalculatorMoneyField] ?? 1;
    if (!Number.isFinite(conversion) || conversion <= 0 || conversion > 1_000_000) errors.fx = '请输入有效的正汇率。';
    if (['shipping', 'other', 'fixed', 'buyerShipping', 'platformShipping'].includes(id)) numbers[id] *= conversion;
    if (['commission', 'sfp', 'creator', 'external', 'returnRate', 'remittanceRate', 'fxRiskRate'].includes(id) && numbers[id] > 100) errors[id] = '比例须在 0–100% 之间。';
  }
  if (numbers.purchase === 0) errors.purchase = '采购原价须大于 0。';
  const rate = Number(fx);
  if (!fx.trim()) missing = true;
  else if (!/^\d+(\.\d{1,8})?$/.test(fx.trim()) || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) errors.fx = '请输入有效的正汇率，最多八位小数。';
  const agencyRate = Number(agencyFx);
  if (useAgency) {
    if (!agencyFx.trim()) missing = true;
    else if (!/^\d+(\.\d{1,8})?$/.test(agencyFx.trim()) || !Number.isFinite(agencyRate) || agencyRate <= 0 || agencyRate > 1_000_000) errors.agencyFx = '请输入有效的正汇率，最多八位小数。';
  }
  numbers.advertising = 0;
  if (promotions.advertising) {
    const roi = values.roi.trim();
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(roi)) errors.roi = '请输入非负广告 ROI，最多两位小数；不投广告填 0。';
    else numbers.advertising = Number(roi) === 0 ? 0 : 116 / Number(roi);
  }
  const r = (numbers.commission + numbers.creator + numbers.advertising) / 100 + numbers.external / 116 + taxRate + numbers.returnRate / 100;
  const saleRaw = values.sale.trim();
  if (saleRaw && (!/^\d{1,9}(\.\d{1,2})?$/.test(saleRaw) || Number(saleRaw) <= 0)) errors.sale = '商品原价须大于 0，最多两位小数。';
  const discountRaw = values.discount.trim() || '0';
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(discountRaw)) errors.discount = '优惠金额须为非负数，最多两位小数。';
  const fold = options.discountMode === 'fold';
  if (fold && !values.discount.trim()) errors.discount = '请输入折扣，10 折为无优惠。';
  if (fold && Number(discountRaw) > 10) errors.discount = '折扣须在 0–10 折之间，例如 8 表示八折。';
  const saleRate = options.rates?.sale ?? 1;
  const discountRate = options.rates?.discount ?? 1;
  if (![saleRate, discountRate].every(value => Number.isFinite(value) && value > 0 && value <= 1_000_000)) errors.fx = '请输入有效的正汇率。';
  const presetDiscount = options.presetDiscount ?? 1;
  if (!Number.isFinite(presetDiscount) || presetDiscount <= 0 || presetDiscount > 1) errors.discount = '预设折扣无效。';
  const netFactor = presetDiscount * (fold ? Number(discountRaw) / 10 : 1);
  const fixedDiscount = fold ? 0 : Number(discountRaw) * discountRate;
  const salePrice = Number(saleRaw) * saleRate;
  const netAt = (price: number) => price * netFactor - fixedDiscount;
  const discount = saleRaw && !errors.sale ? salePrice - netAt(salePrice) : fixedDiscount;
  if (!fold && saleRaw && !errors.sale && !errors.discount && fixedDiscount > salePrice * presetDiscount) errors.sale = '商品原价不能低于优惠金额，请调整原价或优惠。';
  // An optional sale-price error does not hide a valid break-even result.
  if (missing || Object.keys(errors).some(key => key !== 'sale')) return { errors, result: null };
  const converted = numbers.purchase * rate;
  const agencyConverted = useAgency ? numbers.agency * agencyRate : 0;
  const cost = converted + numbers.shipping + numbers.other + agencyConverted + numbers.fixed;
  const s = numbers.sfp / 100;
  // Solve for net revenue, then add the merchant-funded discount to the required list price.
  const shippingCommission = numbers.buyerShipping * numbers.commission / 100;
  const remittanceRate = numbers.remittanceRate / 100;
  const fxRiskRate = numbers.fxRiskRate / 100;
  // FX scenarios do not change base costs or pricing.
  const payoutLossRate = remittanceRate;
  const settlementRate = (numbers.commission + numbers.creator) / 100 + numbers.external / 116 + taxRate;
  // Procurement, advertising and the return reserve are expenses, not payout deductions.
  const payoutAt = (price: number) => Math.max(0, netAt(price) * (1 - settlementRate) - Math.min(netAt(price) * s, 40) - numbers.fixed - shippingCommission);
  const remittanceAt = (price: number) => payoutAt(price) * remittanceRate;
  const fxRiskAt = (price: number) => (payoutAt(price) - remittanceAt(price)) * fxRiskRate;
  const required = cost + shippingCommission - (numbers.fixed + shippingCommission) * payoutLossRate;
  const revenueMargin = targetMargin / (1 + targetMargin);
  const solveRate = r + (1 - settlementRate) * payoutLossRate + revenueMargin;
  const solveSfp = s * (1 - payoutLossRate);
  const uncapped = 1 - solveRate - solveSfp > 0 ? required / (1 - solveRate - solveSfp) : Infinity;
  const netExact = solveRate >= 1 ? Infinity : s * uncapped <= 40 ? uncapped : (required + 40 * (1 - payoutLossRate)) / (1 - solveRate);
  const exact = netFactor > 0 ? (netExact + fixedDiscount) / netFactor : Infinity;
  let breakEven = Math.ceil((exact - 1e-9) * 100) / 100;
  const profitAt = (price: number) => {
    const net = netAt(price);
    return net * (1 - r) - Math.min(net * s, 40) - cost - shippingCommission - remittanceAt(price);
  };
  if (profitAt(breakEven) - netAt(breakEven) * revenueMargin < -1e-8) breakEven = Math.round((breakEven + 0.01) * 100) / 100;
  const feesAt = (price: number) => {
    const net = netAt(price);
    const taxBase = net / 1.16;
    const isr = taxBase * 0.025;
    const iva = taxBase * 0.16 * 0.5;
    return {
      isr, iva,
      returnReserve: net * numbers.returnRate / 100,
      remittanceBase: payoutAt(price),
      remittance: remittanceAt(price),
      fxRisk: fxRiskAt(price),
      sfp: Math.min(net * s, 40),
      creator: net * numbers.creator / 100,
      external: taxBase * numbers.external / 100,
      tax: isr + iva,
      advertising: net * numbers.advertising / 100,
      commission: (net + numbers.buyerShipping) * numbers.commission / 100,
    };
  };
  const sale = saleRaw && !errors.sale ? salePrice : null;
  return { errors, result: { promotions: { ...promotions }, converted, agencyConverted, cost, breakEven: Number.isFinite(breakEven) ? breakEven : null, exact, advertisingRate: numbers.advertising,
    shipping: numbers.shipping, platformShipping: numbers.platformShipping, buyerShipping: numbers.buyerShipping, other: numbers.other, fixed: numbers.fixed,
    breakEvenNet: Number.isFinite(breakEven) ? netAt(breakEven) : null, discount, shippingCommission,
    capped: (netAt(breakEven)) * s >= 40, sfpAtBreakEven: Number.isFinite(breakEven) ? Math.min((netAt(breakEven)) * s, 40) : null,
    breakEvenFees: Number.isFinite(breakEven) ? feesAt(breakEven) : null,
    sale: sale === null ? null : { price: sale, net: netAt(sale), totalCost: netAt(sale) - profitAt(sale), profit: profitAt(sale),
      margin: netAt(sale) - profitAt(sale) <= 0 ? null : profitAt(sale) / (netAt(sale) - profitAt(sale)) * 100,
      ...feesAt(sale),
      fxDownsideProfit: profitAt(sale) - fxRiskAt(sale),
      fxUpsideProfit: profitAt(sale) + fxRiskAt(sale),
    },
  } };
}


// Default guide uses the same rates and payout basis as the calculator.
export function defaultPriceFormula() {
  const settlementRate = Number(calculatorDefaults.commission) / 100 + taxRate;
  const fee = Number(calculatorDefaults.remittanceRate) / 100;
  const retainedPayout = 1 - fee;
  const sfp = Number(calculatorDefaults.sfp) / 100;
  const retained = (1 - settlementRate) * retainedPayout - Number(calculatorDefaults.returnRate) / 100;
  const fixed = (Number(calculatorDefaults.fixed) + Number(calculatorDefaults.buyerShipping) * Number(calculatorDefaults.commission) / 100) * retainedPayout;
  const lower = retained - sfp * retainedPayout;
  const capPrice = 40 / sfp;
  return {
    threshold: capPrice * lower - fixed,
    lowerMultiplier: 1 / lower, lowerFixed: fixed / lower,
    upperMultiplier: 1 / retained, upperFixed: (fixed + 40 * retainedPayout) / retained,
  };
}
