import type { ReactNode } from 'react';
import type { computePricingFlow } from '../pricingFlow';
import { CalculatorFigure } from './CalculatorAmount';
import CalculatorCostBreakdown from './CalculatorCostBreakdown';
import CalculatorRules from './CalculatorRules';
import CalculatorFxScenarios from './CalculatorFxScenarios';
import type { CalculatorPromotions } from '../breakEven';

type Props = { fxRiskRate: string; promotionInput?: ReactNode; onOpenCosts: () => void; cnyRate: number | null; flow: ReturnType<typeof computePricingFlow>; target: number; floor: number; onTargetChange: (value: number) => void; onFloorChange: (value: number) => void; presetInput: ReactNode; promotions: CalculatorPromotions };
export default function CalculatorDecisionResults({ fxRiskRate, promotionInput, onOpenCosts, cnyRate, flow, target, floor, onTargetChange, onFloorChange, presetInput, promotions }: Props) {
  const sale = flow.after.result?.sale;
  const margin = sale?.margin;
  const list = flow.pricing.plan?.retailPrice;
  const final = sale?.net;
  const ready = list != null && final != null && list > 0;
  const state = margin == null ? 'empty' : margin < floor - 1e-8 ? 'below' : margin < target - 1e-8 ? 'near' : 'met';
  const status = state === 'empty' ? '待计算' : state === 'below' ? '低于底线' : state === 'near' ? '未达目标' : '已达标';
  const gap = margin == null ? null : state === 'below' ? floor - margin : state === 'near' ? target - margin : Math.max(0, margin - target);
  const scale = 99;
  const position = (n: number) => `${Math.min(100, Math.max(0, n / scale * 100))}%`;
  const breakEven = flow.after.result?.breakEvenNet;
  const distance = final != null && breakEven != null ? final - breakEven : null;
  const figure = (n: number | null | undefined) => <CalculatorFigure amount={n ?? null} cnyRate={cnyRate} />;
  return <aside className="calculator-decision-results" aria-label="实时定价结果" data-state={state}>
    <div className="calculator-result-heading"><h2>预算利润率及折扣</h2><span className="calculator-result-badge">{status}</span></div>
    <div aria-live="polite" aria-atomic="true">
      <div className="calculator-margin-status"><p className="calculator-decision-margin">{margin == null ? '—' : `${margin.toFixed(2)}%`}</p><span className="calculator-result-badge calculator-mobile-status">{status}</span></div>
      <p className="calculator-margin-gap">{gap == null ? '填写成本后自动计算' : state === 'met' ? `守住 ${floor}% 底线，达到目标` : <>{state === 'below' ? `低于底线 ${floor}% 约 ` : state === 'near' ? `距目标 ${target}% 还差 ` : '已超过目标 '}<strong>{gap.toFixed(2)}</strong> 个百分点</>}</p>
    </div>
    <div className="calculator-profit-gauge calculator-profit-slider" role="group" aria-label="利润率范围设置，填充表示当前实际利润率" title="填充表示当前实际利润率">
      <div className="calculator-profit-track"><span style={{ width: position(margin ?? 0) }} /></div>
      <input type="range" aria-label="底线利润率" min="0" max="99" step="1" value={floor} aria-valuetext={`${floor}%`} onChange={e => onFloorChange(Math.min(target, Number(e.target.value)))} />
      <input type="range" aria-label="目标利润率" min="0" max="99" step="1" value={target} aria-valuetext={`${target}%`} onChange={e => onTargetChange(Math.max(floor, Number(e.target.value)))} />
      <div className="calculator-profit-labels" data-close={target - floor < 18}><span style={{ left: `clamp(var(--space-8), ${position(floor)}, calc(100% - var(--space-8)))` }}>底线 {floor}%</span><span style={{ left: `clamp(var(--space-8), ${position(target)}, calc(100% - var(--space-8)))` }}>目标 {target}%</span></div>

    </div>
    <div className="calculator-preset-setting">{presetInput}</div>
    <dl className="calculator-buyer-prices">
      <div><dt>销售价格（标价）</dt><dd>{figure(flow.pricing.plan?.retailPrice)}</dd></div>
      {flow.activity && <div><dt>活动价</dt><dd>{flow.hasActivityPrice ? figure(sale?.price) : '—'}</dd></div>}
      <div><dt>优惠金额 {ready && <small className="calculator-discount-equivalent">{(final / list * 10).toFixed(2)} 折（−{(100 - final / list * 100).toFixed(2)}%）</small>}</dt><dd>{ready ? <>− {figure(list - final)}</> : '—'}</dd></div>
    </dl>
    <dl className="calculator-buyer-prices">
      <div className="calculator-buyer-payment"><dt>买家实付<small>不包含快递费</small></dt><dd>{figure(final)}</dd></div>
    </dl>
    {promotionInput}
    <dl className="calculator-result-metrics">
      <div><dt>基础剩余利润</dt><dd>{figure(sale?.profit)}<small className="calculator-mobile-margin">剩余利润率 {margin == null ? '—' : `${margin.toFixed(2)}%`}</small></dd></div>
      <div><dt>{distance == null || distance >= 0 ? '高于保本价' : '低于保本价'}</dt><dd>{figure(distance == null ? null : Math.abs(distance))}</dd></div>
    </dl>
    <CalculatorFxScenarios sale={sale ?? null} rate={fxRiskRate} cnyRate={cnyRate} />
    <CalculatorCostBreakdown cnyRate={cnyRate} result={flow.after.result} promotions={promotions} />
    <details className="calculator-decision-details calculator-desktop-details"><summary>保本价与计算公式</summary>
      <p className="calculator-note">利润率＝利润÷全部成本；{floor}%为利润底线，0%为保本。</p>
      <dl className="calculator-decision-prices"><div><dt>保本成交价（0%）</dt><dd>{flow.after.result?.breakEven === null ? '当前条件无法保本' : figure(breakEven)}</dd></div><div><dt>当前销售方式的保本输入价</dt><dd>{figure(flow.after.result?.breakEven)}</dd></div></dl>
      <CalculatorRules />
    </details>
    <div className="calculator-mobile-rules"><CalculatorRules /></div>
  </aside>;
}
