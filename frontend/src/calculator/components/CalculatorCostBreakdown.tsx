import type { CalculatorPromotions, computeBreakEven } from '../breakEven';
import CalculatorAmount, { money } from './CalculatorAmount';

type Result = NonNullable<ReturnType<typeof computeBreakEven>['result']>;
export default function CalculatorCostBreakdown({ result, promotions, cnyRate }: { cnyRate?: number | null; result: Result | null; promotions: CalculatorPromotions }) {
  const sale = result?.sale;
  const visible = ([, value]: [string, number | null | undefined]) => value == null || value !== 0;
  const platformRows: [string, number | null | undefined][] = [
    ['SFP 服务费', sale?.sfp],
    ['平台佣金', sale?.commission], ['ISR＋IVA（估算）', sale?.tax],
  ];
  const share = (fee: number | null | undefined) => fee != null && sale && sale.net > 0 ? `（占成交额 ${(fee / sale.net * 100).toFixed(2)}%）` : '（占比 —）';
  const commissionTaxTotal = sale ? sale.sfp + sale.commission + sale.tax : null;
  const platformTotal = commissionTaxTotal != null && result ? result.fixed + commissionTaxTotal : null;
  const amount = (value: number | null | undefined) => cnyRate !== undefined ? <CalculatorAmount amount={value ?? null} cnyRate={cnyRate} /> : value != null ? money(value) : '—';
  const rows: [string, number | null | undefined][] = [
    ['采购成本', result?.converted], ['代采费', result?.agencyConverted], ['其他成本', result?.other], ['商家运费', result?.shipping],
    ['平台扣除', platformTotal], ['退货损失预留', sale?.returnReserve], ['回款手续费预留', sale?.remittance],
    ...(promotions.creator ? [['达人佣金（估算）', sale?.creator] as [string, number | undefined]] : []),
    ...(promotions.advertising ? [['广告费（含税）', sale?.advertising] as [string, number | undefined]] : []),
    ...(promotions.external ? [['外部流量佣金', sale?.external] as [string, number | undefined]] : []),
  ];
  return <section className="calculator-breakdown-section" aria-labelledby="calc-breakdown-heading">
    <h2 id="calc-breakdown-heading">总成本明细</h2>
    <dl className="calculator-breakdown">
      {rows.filter(visible).map(([label, value]) => label === '平台扣除' ? <div className="calculator-platform-costs" key={label}>
        <dt>{label}</dt><dd>{amount(value)}
          <dl className="calculator-platform-items">
            {result?.fixed !== 0 && <div><dt>固定销售费</dt><dd>{amount(result?.fixed)}</dd></div>}
            {commissionTaxTotal !== 0 && <div className="calculator-platform-costs"><dt>佣金及税费</dt><dd>{amount(commissionTaxTotal)}
              <dl className="calculator-platform-items">{platformRows.filter(visible).map(([name, fee]) => <div key={name}><dt>{name}<span className="calculator-fee-share">{share(fee)}</span></dt><dd>{amount(fee)}</dd></div>)}</dl>
            </dd></div>}
          </dl>
        </dd>
      </div> : <div key={label}><dt>{label}</dt><dd>{amount(value)}</dd></div>)}
      <div className="calculator-total-cost"><dt>总成本合计</dt><dd>{cnyRate !== undefined ? <CalculatorAmount amount={sale?.totalCost ?? null} cnyRate={cnyRate} /> : sale ? money(sale.totalCost) : '—'}</dd></div>
    </dl>
    <p className="calculator-note">各币种统一折算为 MXN；各项显示四舍五入，合计按原始金额计算。</p>
  </section>;
}
