import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { mexicoDate, periodFor, shiftPeriod, statsFor } from '../../home/stats';
import OrderTrendChart from './OrderTrendChart';

export default function OrderStats({ orders, loading, error, currency = 'MXN', now }) {
  const [grain, setGrain] = useState('day');
  const [anchor, setAnchor] = useState(() => mexicoDate());
  const today = mexicoDate(now);
  const stats = useMemo(() => orders ? statsFor(orders, anchor, grain, now) : null, [orders, anchor, grain, now]);
  const previousLabel = stats?.ongoing ? { day: '昨日', week: '上周', month: '上月' }[grain] : { day: '前一日', week: '上一周', month: '上一月' }[grain];
  const currentLabel = { day: '所选日', week: '所选周', month: '所选月' }[grain];
  const nextAnchor = shiftPeriod(anchor, grain, 1);
  const range = periodFor(anchor, grain);
  const rangeLabel = grain === 'day' ? `${anchor} · 按小时` : grain === 'week' ? `${range.start} — ${range.end} · 按天` : `${anchor.slice(0,4)}年${Number(anchor.slice(5,7))}月 · 按天`;
  const mixedCurrency = stats?.currencies.length > 1;
  const actualCurrency = stats?.currencies[0] || currency;
  const money = value => value == null || mixedCurrency ? '—' : `$${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
  const cards = [
    { label:'GMV', value:money(stats?.gmv), unit:actualCurrency, change:stats?.changes.gmv },
    { label:'成交订单', value:stats && !mixedCurrency ? stats.orders.toLocaleString('zh-CN') : '—', unit:'单', change:stats?.changes.orders },
    { label:'客单价', value:money(stats?.average), unit:actualCurrency, change:stats?.changes.average },
    { label:`${previousLabel}同期 GMV`, value:money(stats?.previousGmv), unit:actualCurrency, detail:stats ? `${stats.previousOrders} 单` : '尚未读取' },
  ];
  return <section className="hd-stats" aria-labelledby="hd-stats-title">
    <div className="hd-heading-row"><h2 id="hd-stats-title">订单与 GMV</h2><div className="hd-period-toolbar">
      <div className="hd-segment" aria-label="统计粒度">{[['day','日'],['week','周'],['month','月']].map(([key,label])=><button key={key} className={grain===key ? 'is-selected' : ''} aria-pressed={grain===key} onClick={()=>setGrain(key)}>{label}</button>)}</div>
      <button className="hd-icon-button" aria-label="上一周期" onClick={()=>setAnchor(shiftPeriod(anchor,grain,-1))}><ChevronLeft size={18}/></button>
      <input type="date" aria-label="选择统计日期（墨西哥城）" value={anchor} max={today} onClick={event=>{try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard entry remains available. */ }}} onChange={event=>{if(/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)&&event.target.value<=today){setAnchor(event.target.value);setGrain('day');}}} />
      <button className="hd-icon-button" aria-label="下一周期" disabled={nextAnchor>today} onClick={()=>setAnchor(nextAnchor)}><ChevronRight size={18}/></button>
    </div></div>
    {error && <p className="hd-error" role="alert">订单数据读取失败：{error}。请使用右上角同步重试。</p>}
    {mixedCurrency && <p className="hd-error" role="alert">所选店铺包含不同币种，请筛选同币种店铺后查看汇总。</p>}
    <div className="hd-metrics" aria-busy={loading}>{cards.map(card=><article className="hd-metric" key={card.label}><h3>{card.label}</h3><div className="hd-metric-value">{loading && !stats ? <span className="hd-loading-value">读取中…</span> : card.value}<span>{card.unit}</span></div>{card.detail ? <p className="hd-muted">{card.detail}</p> : <p className={`hd-comparison ${card.change>0?'is-up':card.change<0?'is-down':''}`}>{previousLabel}对比 {card.change == null || mixedCurrency ? '—' : `${card.change>0?'+':''}${card.change.toFixed(1)}%`}</p>}</article>)}</div>
    {stats && !mixedCurrency ? <OrderTrendChart buckets={stats.buckets} currency={actualCurrency} rangeLabel={rangeLabel} currentLabel={currentLabel} previousLabel={previousLabel}/> : <div className="hd-chart-panel hd-empty">{loading ? '正在读取线上订单趋势…' : '读取订单数据后显示趋势'}</div>}
    <p className="hd-footnote">口径：GMV 按买家实付额（payment.total_amount）统计，不含未支付与已取消订单，按订单创建时间归入墨西哥城周期。净利润需要接入货源采购成本后再计算。</p>
    <p className="hd-footnote">来源：线上已同步订单快照{orders ? `，共 ${orders.length} 单` : ''}。历史无记录不代表平台无成交；未结束的周期按相同日期进度及当地时刻对比；历史完整周期按整段对比。月份天数不同时，缺失日期不补零。{stats?.missingDates ? ` ${stats.missingDates} 单缺少创建时间，未计入周期。` : ''}</p>
  </section>;
}
