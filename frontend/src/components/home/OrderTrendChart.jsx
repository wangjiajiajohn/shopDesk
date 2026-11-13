import { useEffect, useRef, useState } from 'react';

export default function OrderTrendChart({ buckets, currency, rangeLabel, currentLabel, previousLabel }) {
  const root = useRef(null);
  const [width, setWidth] = useState(900);
  const [active, setActive] = useState(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(260, entries[0].contentRect.width)));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setActive(null), [buckets]);
  const left = 48, right = 30, top = 18, bottom = 36, height = 250;
  const plotWidth = Math.max(100, width - left - right), plotHeight = height - top - bottom;
  const maxGmv = Math.max(1, ...buckets.flatMap(bucket => [bucket.gmv, bucket.previousGmv]));
  const step = plotWidth / Math.max(1, buckets.length);
  const x = index => left + step * (index + .5), yGmv = value => top + plotHeight * (1 - value / maxGmv);
  const labelEvery = Math.max(1, Math.ceil(buckets.length / (width < 500 ? 6 : 12)));
  const money = value => value.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return <div className="hd-chart-panel">
    <div className="hd-chart-legend"><span><i className="hd-current-key" />{currentLabel} GMV（{currency}）</span><span><i className="hd-previous-key" />{previousLabel} GMV</span><span>{rangeLabel}</span><button className="hd-text-button" onClick={() => setTable(value => !value)} aria-expanded={table}>{table ? '收起数据表' : '查看数据表'}</button></div>
    <div className="hd-chart" ref={root}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${rangeLabel}，实线为所选周期GMV，虚线为上一周期GMV`}>
        {[0,1,2,3,4].map(tick => { const y = top + plotHeight * (1 - tick / 4); return <g key={tick}><line x1={left} x2={width-right} y1={y} y2={y} className="hd-grid-line" /><text x={left-8} y={y+4} textAnchor="end" className="hd-axis-label">{(maxGmv*tick/4).toLocaleString('es-MX', { maximumFractionDigits: maxGmv < 4 ? 2 : 0, notation: maxGmv > 99999 ? 'compact' : 'standard' })}</text></g>; })}
        {buckets.map((bucket,index) => <g key={bucket.key}>

          {index % labelEvery === 0 && <text x={x(index)} y={height-12} textAnchor="middle" className="hd-axis-label">{bucket.label}</text>}
        </g>)}
        <path d={buckets.map((bucket,index)=>bucket.future ? '' : `${index===0||buckets[index-1].future?'M':'L'}${x(index)},${yGmv(bucket.gmv)}`).join(' ')} className="hd-current-line" />
        <path d={buckets.map((bucket,index)=>bucket.future||bucket.previousMissing ? '' : `${index===0||buckets[index-1].future||buckets[index-1].previousMissing?'M':'L'}${x(index)},${yGmv(bucket.previousGmv)}`).join(' ')} className="hd-previous-line" />
        {buckets.map((bucket,index) => <rect key={bucket.key} x={left+step*index} y={top} width={step} height={plotHeight} fill="transparent" tabIndex="0" role="img" aria-label={`${bucket.label}，GMV ${money(bucket.gmv)} ${currency}，${bucket.orders}单，上期GMV ${money(bucket.previousGmv)} ${currency}${bucket.future ? '，尚未到来的时段' : ''}`} onMouseEnter={()=>setActive(bucket.future ? null : index)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(bucket.future ? null : index)} onBlur={()=>setActive(null)}><title>{`${bucket.label} GMV $${money(bucket.gmv)} · ${bucket.orders}单`}</title></rect>)}
      </svg>
      {active != null && buckets[active] && <div role="status" className="hd-chart-tooltip" style={{ left: `${Math.min(70, Math.max(4, x(active)/width*100))}%` }}>{buckets[active].label} · GMV ${money(buckets[active].gmv)} · {buckets[active].orders} 单<br/>{previousLabel} · {buckets[active].previousMissing ? '无对应日期' : `$${money(buckets[active].previousGmv)} · ${buckets[active].previousOrders} 单`}</div>}
    </div>
    {table && <div className="hd-table-scroll"><table className="hd-data-table"><caption>{rangeLabel}</caption><thead><tr><th>时段</th><th>GMV（{currency}）</th><th>订单数</th><th>上期 GMV</th><th>上期订单数</th></tr></thead><tbody>{buckets.map(bucket=><tr key={bucket.key}><th scope="row">{bucket.label}</th><td>{money(bucket.gmv)}</td><td>{bucket.orders}</td><td>{bucket.future || bucket.previousMissing ? '—' : money(bucket.previousGmv)}</td><td>{bucket.future || bucket.previousMissing ? '—' : bucket.previousOrders}</td></tr>)}</tbody></table></div>}
  </div>;
}
