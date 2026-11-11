import type { ReactNode } from 'react';
import type { computeCalculatorScenarios } from '../calculatorScenarios';
import { CalculatorFigure, yuan } from './CalculatorAmount';

type Scenario = ReturnType<typeof computeCalculatorScenarios>[number];
type Props = { scenarios: Scenario[]; currency: 'MXN' | '人民币'; saleRate: number; commission: string; targetMargin: string; cnyRate: number | null };
export default function CalculatorScenarioComparison({ scenarios, currency, saleRate, commission, targetMargin, cnyRate }: Props) {
  const price = (amount: number | null | undefined) => amount == null || !Number.isFinite(saleRate) || saleRate <= 0 ? null : Math.ceil((amount / saleRate - 1e-9) * 100) / 100;
  const figure = (amount: number | null | undefined) => <CalculatorFigure amount={amount ?? null} />;
  const targetValid = targetMargin !== '' && Number.isFinite(Number(targetMargin)) && Number(targetMargin) >= 0 && Number(targetMargin) < 100;
  const rows: { label: string; className?: string; value: (scenario: Scenario) => ReactNode }[] = [
    { label: '建议标价（八折前）', className: 'calculator-scenario-recommendation', value: s => s.pricingPlan.state === 'unreachable' ? '无法达到目标' : <CalculatorFigure amount={price(s.pricingPlan.plan?.retailPrice)} currency={currency} /> },
    { label: '目标成交价（八折后）', value: s => <CalculatorFigure amount={price(s.pricingPlan.plan?.finalPrice)} currency={currency} /> },
    { label: '最低保本价格', value: s => s.result?.breakEven === null ? '无法保本' : <CalculatorFigure amount={price(s.result?.breakEven)} currency={currency} /> },
    { label: '用户到手价格', value: s => figure(s.result?.sale?.net) },
    { label: '总成本', value: s => figure(s.result?.sale?.totalCost) },
    { label: '风险预留合计', value: s => { const sale = s.result?.sale; return figure(sale ? sale.returnReserve + sale.remittance : null); } },
    { label: '利润', className: 'calculator-scenario-profit', value: s => figure(s.result?.sale?.profit) },
    { label: '总成本利润率', value: s => s.result?.sale?.margin != null ? `${s.result.sale.margin.toFixed(2)}%` : '待计算' },
    { label: '目标达成', value: s => { const sale = s.result?.sale; return !sale ? '填写真实售价后显示' : sale.margin === null ? '总成本无效' : !targetValid ? '目标无效' : sale.margin < Number(targetMargin) ? '低于目标' : '已达目标'; } },
    { label: '利润约合人民币', value: s => s.result?.sale && cnyRate !== null ? yuan(s.result.sale.profit / cnyRate) : '—' },
  ];
  return <section className="calculator-scenarios" aria-labelledby="calculator-scenarios-heading">
    <h2 id="calculator-scenarios-heading">三种口径对比</h2>
    <p className="calculator-note">风险预留＝退货＋回款手续费；汇率压力不计入基础成本；平台佣金为当前 {commission || '—'}%（默认 6%）。其他费用保持一致。</p>
    <div className="calculator-comparison-scroll" role="region" aria-label="三种口径数据表，可横向滚动" tabIndex={0}>
      <table className="calculator-comparison-table">
        <thead><tr><th scope="col">数据项</th>{scenarios.map(s => <th scope="col" key={s.label}>{s.risks ? '含风险预留' : '不含风险预留'}<br />{s.commission ? '含平台佣金' : '不含平台佣金'}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.label} className={row.className}><th scope="row">{row.label}</th>{scenarios.map(s => <td key={s.label}>{row.value(s)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="calculator-note">建议价按 {targetMargin || '—'}% 目标总成本利润率（利润÷全部成本）反推，不含广告及达人等推广费，再 × 1.25，配合预设 8 折回到目标成交价；保本价、到手价及利润使用预设八折、当前额外让利和推广费用。金额未计算时显示 —，请填写有效成本、汇率和真实售价。实际利润以结算为准。</p>
    <p className="calculator-note">下方费用明细对应第一列（含风险预留与平台佣金）。</p>
  </section>;
}
