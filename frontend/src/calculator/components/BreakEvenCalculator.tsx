import { useCalculatorMobile } from '../useCalculatorMobile';
import CalculatorPromotionStage from './CalculatorPromotionStage';
import CalculatorCostSidebar from './CalculatorCostSidebar';
import { yuan } from './CalculatorAmount';
import CalculatorTabs from './CalculatorTabs';
import CalculatorDiscountStepper from './CalculatorDiscountStepper';
import CalculatorCommissionSelect from './CalculatorCommissionSelect';
import '../calculator-decision.css';
import { useState } from 'react';
import { computePricingFlow, computePromotionLimits } from '../pricingFlow';
import { calculatorDefaults, type CalculatorMoneyField, type CalculatorPromotions, type CalculatorValues } from '../breakEven';
import { useCalculatorExchangeRate } from '../useCalculatorExchangeRate';
import CalculatorField, { type AmountCurrency } from './CalculatorField';
import CalculatorDecisionResults from './CalculatorDecisionResults';
import CalculatorCompactRate from './CalculatorCompactRate';

const initialCurrencies: Record<CalculatorMoneyField, AmountCurrency> = { purchase: 'MXN', agency: 'MXN', other: 'MXN', shipping: 'MXN', platformShipping: 'MXN', buyerShipping: 'MXN', fixed: 'MXN', sale: 'MXN', discount: 'MXN' };
export default function BreakEvenCalculator() {
  const mobile = useCalculatorMobile();
  const [costSettingsOpen, setCostSettingsOpen] = useState(false);
  const [values, setValues] = useState<CalculatorValues>({ ...calculatorDefaults, agency: '0' });
  const [currencies, setCurrencies] = useState(initialCurrencies);
  const [commissionSource, setCommissionSource] = useState<'creator' | 'external'>('creator');
  const promotions: CalculatorPromotions = { advertising: true, creator: commissionSource === 'creator', external: commissionSource === 'external' };
  const [concessionMode, setConcessionMode] = useState<'daily' | 'activity'>('daily');
  const [activityPrice, setActivityPrice] = useState('');
  const activeActivityPrice = concessionMode === 'activity' ? activityPrice : undefined;

  const [presetFold, setPresetFold] = useState('8');
  const [extraShipping, setExtraShipping] = useState('0');
  const [targetMargin, setTargetMargin] = useState('50');
  const [floorMargin, setFloorMargin] = useState(20);
  const validTargetMargin = /^\d+(\.\d+)?$/.test(targetMargin) && Number(targetMargin) < 100;
  const exchangeRate = useCalculatorExchangeRate('CNY');
  const { fx } = exchangeRate;
  const validFx = /^\d+(\.\d{1,8})?$/.test(fx.trim()) && Number(fx) > 0 && Number(fx) <= 1_000_000;
  const rates = Object.fromEntries(Object.entries(currencies).map(([key, currency]) => [key, currency === 'CNY' ? validFx ? Number(fx) : NaN : 1])) as Record<CalculatorMoneyField, number>;
  const flow = computePricingFlow({ ...values, discount: '0' }, currencies.purchase === 'CNY' ? fx : '1', currencies.agency === 'CNY' ? fx : '1', rates, validTargetMargin ? Number(targetMargin) : NaN, /^\d+(\.\d+)?$/.test(presetFold) ? Number(presetFold) : NaN, promotions, 'fixed', extraShipping, activeActivityPrice);
  const limits = computePromotionLimits({ ...values, discount: '0' }, currencies.purchase === 'CNY' ? fx : '1', currencies.agency === 'CNY' ? fx : '1', rates, validTargetMargin ? Number(targetMargin) : NaN, Number(presetFold), 'fixed', extraShipping, floorMargin, activeActivityPrice);
  const errors = { ...flow.base.errors, ...flow.after.errors };
  const setValue = (id: keyof CalculatorValues, value: string) => setValues(current => ({ ...current, [id]: value }));
  const amountInput = (id: CalculatorMoneyField, label: string) => <CalculatorField id={id} label={label} value={values[id]} error={errors[id]} currency={currencies[id]} onChange={value => setValue(id, value)} onCurrencyChange={currency => setCurrencies(current => ({ ...current, [id]: currency }))} />;
  const ratioInput = (id: keyof CalculatorValues, label: string, hint?: string) => <CalculatorField id={id} label={label} value={values[id]} error={errors[id]} hint={hint} suffix={id === 'roi' ? undefined : '%'} onChange={value => setValue(id, value)} />;
  const promotionFields = <>
<p className="calculator-note">以下费用不参与初始定价，不抬高售价；仅从已定售价的利润中扣除，并更新剩余利润率。填 0 表示不计该项费用。</p>
        <div id="calculator-concessions">
        <div className="calculator-fields">{ratioInput('roi', '广告 ROI', '0表示不投广告；与佣金同时填写时每单同时扣费')}<div className="calculator-commission-choice"><div className="calculator-commission-channel"><label htmlFor="flow-commission-source-currency-trigger">佣金计费渠道</label><CalculatorCommissionSelect id="flow-commission-source" label="佣金计费渠道" value={commissionSource} onChange={setCommissionSource} /></div>{ratioInput(commissionSource, commissionSource === 'creator' ? '达人佣金率' : '外部流量佣金率')}</div>
          <CalculatorField id="extra-shipping" label={`新增商家运费（${currencies.shipping}）`} value={extraShipping} error={flow.extraShippingError} hint="仅填写额外承担部分，不重复计入上方基础运费。" onChange={setExtraShipping} />
        </div>
        <details className="calculator-method"><summary>查看推广极限 · 保留{floorMargin}% / 保本0%</summary>
          <p>以下分别按只用达人、只用广告计算，包含当前活动优惠及新增运费；不叠加当前推广输入。两项不能同时各自用满。</p>
          <dl className="calculator-breakdown">{limits.map(limit => <div key={limit.floor}><dt>{limit.floor === 0 ? '保本 0%' : `保留 ${floorMargin}% 利润率`}</dt><dd>达人最高 {limit.creator == null ? '—' : `${limit.creator.toFixed(2)}%`}<br />广告 ROI 最低 {limit.roi == null ? '—' : `${limit.roi.toFixed(2)} 倍`}</dd></div>)}</dl>
          <p>无可行结果显示 —。ROI 是成交额÷广告费；计算器另计16%广告税费。上限向下、ROI下限向上保留两位小数，并重新计算联动费用。</p>
        </details>
        </div>
  </>;
  const mobilePromotionFields = <>
    <div className="calculator-fields calculator-promotion-primary">
      {ratioInput('roi', '广告 ROI')}
      {ratioInput(commissionSource, commissionSource === 'creator' ? '达人佣金率' : '外部流量佣金率')}
    </div>
    <div className="calculator-promotion-options">
      <div className="calculator-fields">
        <div className="calculator-commission-channel"><label htmlFor="mobile-commission-source-currency-trigger">佣金计费渠道</label><CalculatorCommissionSelect id="mobile-commission-source" label="佣金计费渠道" value={commissionSource} onChange={setCommissionSource} /></div>
        <CalculatorField id="extra-shipping" label={`新增商家运费（${currencies.shipping}）`} value={extraShipping} error={flow.extraShippingError} hint="仅填写额外承担部分。" onChange={setExtraShipping} />
      </div>
      <p className="calculator-note">0 表示不计；广告与佣金同时填写时会同时扣费。</p>
        <details className="calculator-method"><summary>查看推广极限 · 保留{floorMargin}% / 保本0%</summary>
          <p>以下分别按只用达人、只用广告计算，包含当前活动优惠及新增运费；不叠加当前推广输入。两项不能同时各自用满。</p>
          <dl className="calculator-breakdown">{limits.map(limit => <div key={limit.floor}><dt>{limit.floor === 0 ? '保本 0%' : `保留 ${floorMargin}% 利润率`}</dt><dd>达人最高 {limit.creator == null ? '—' : `${limit.creator.toFixed(2)}%`}<br />广告 ROI 最低 {limit.roi == null ? '—' : `${limit.roi.toFixed(2)} 倍`}</dd></div>)}</dl>
          <p>无可行结果显示 —。ROI 是成交额÷广告费；计算器另计16%广告税费。上限向下、ROI下限向上保留两位小数，并重新计算联动费用。</p>
        </details>
    </div>
  </>;
  return <section className="page-content calculator-page calculator-decision-page" aria-labelledby="calculator-heading">
    <header className="calculator-page-title"><div className="calculator-title-row"><h1 id="calculator-heading">定价与利润</h1><CalculatorCompactRate rate={exchangeRate} error={errors.fx ?? errors.agencyFx} /></div></header>
    <div className="calculator-decision-layout"><CalculatorCostSidebar canFinish={values.purchase.trim() !== '' && !errors.purchase} open={costSettingsOpen} setOpen={setCostSettingsOpen} mobileSettings={<CalculatorCompactRate rate={exchangeRate} error={errors.fx ?? errors.agencyFx} />}>
      <section className="calculator-panel" aria-labelledby="calc-cost-heading"><h2 id="calc-cost-heading"><span className="calculator-step">1</span>成本</h2>
        <div className="calculator-fields">{amountInput('purchase', '采购成本')}</div>
        <details className="calculator-more" open={Object.keys(errors).some(key => ['agency','other','commission','sfp','fixed','fxRiskRate','remittanceRate','returnRate'].includes(key)) || undefined}><summary>更多成本项</summary>
          <div className="calculator-fields">{amountInput('agency', '代采费')}{amountInput('other', '其他成本')}{ratioInput('commission', '平台佣金')}{ratioInput('sfp', 'SFP 服务费', '每件封顶40 MXN')}{amountInput('fixed', '每件销售费')}{ratioInput('fxRiskRate', '汇率压力幅度', '仅用于压力情景，不扣基础利润、不抬高定价')}{ratioInput('remittanceRate', '回款手续费率')}{ratioInput('returnRate', '退款不退货率')}</div>
          <p className="calculator-note">ISR、IVA自动估算；汇率压力仅作情景对照，其余费用收起后仍计入。</p>
        </details>
      </section>
      <section className="calculator-panel" aria-labelledby="calc-shipping-heading"><h2 id="calc-shipping-heading"><span className="calculator-step">2</span>运费分担</h2>
        <div className="calculator-fields">{amountInput('buyerShipping', '买家运费')}</div>
        <details className="calculator-more" open={!!(errors.shipping || errors.platformShipping) || undefined}><summary>商家 / 平台运费</summary><div className="calculator-fields">{amountInput('shipping', '商家运费')}{amountInput('platformShipping', '平台运费')}</div></details>
      </section>
      {!mobile && <section className="calculator-panel" aria-labelledby="calc-concession-heading"><h2 id="calc-concession-heading"><span className="calculator-step">3</span>推广成本</h2>{promotionFields}</section>}
    </CalculatorCostSidebar>
      <CalculatorDecisionResults fxRiskRate={values.fxRiskRate} promotionInput={mobile ? <CalculatorPromotionStage enabled={flow.pricing.plan != null}>{mobilePromotionFields}</CalculatorPromotionStage> : undefined} onOpenCosts={() => setCostSettingsOpen(true)} cnyRate={validFx ? Number(fx) : null} flow={flow} target={Number(targetMargin)} floor={floorMargin} onTargetChange={value => setTargetMargin(String(value))} onFloorChange={setFloorMargin} promotions={promotions} presetInput={<>
        <CalculatorTabs id="calculator-concession-mode" label="销售方式" value={concessionMode} options={[["daily", "日常商品折扣"], ["activity", "设置活动价"]]} onChange={setConcessionMode}>
          {concessionMode === 'activity' ? <CalculatorField id="activity-price" label="活动报名价" value={activityPrice} suffix="MXN" error={flow.activityPriceError ?? flow.after.errors.sale} hint={`日常商品折后价 ${flow.base.result?.sale?.net.toFixed(2) ?? '—'} MXN${validFx && flow.base.result?.sale ? `（${yuan(flow.base.result.sale.net / Number(fx))}）` : ''}；留空沿用日常折后价，填写后不再打商品折扣。`} onChange={setActivityPrice} /> : <CalculatorDiscountStepper value={presetFold} onChange={setPresetFold} />}
        </CalculatorTabs>
      </>} />
    </div>
  </section>;
}
