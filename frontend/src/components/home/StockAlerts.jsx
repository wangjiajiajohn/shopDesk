import { useLayoutEffect, useRef } from 'react';

export default function StockAlerts({ stats, error, loading }) {
  const listRef = useRef(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = [...list.children].slice(0, 2);
    const measure = () => { list.style.maxHeight = `${rows.reduce((height, row) => height + row.getBoundingClientRect().height, 0)}px`; };
    const observer = new ResizeObserver(measure);
    rows.forEach(row => observer.observe(row)); measure();
    return () => observer.disconnect();
  }, [stats?.alerts.length]);
  if (!stats) return <p role={error ? 'alert' : 'status'} className={error ? 'hd-error' : 'hd-empty'}>{error || (loading ? '正在读取在售商品库存与订单…' : '库存数据尚未读取，请同步。')}</p>;
  return <>
    {error && <p role="alert" className="hd-error">更新失败，以下保留上次数据：{error}</p>}
    <p className="hd-rule">按在售商品的每个SKU比较：可售库存少于近7天销售件数即提醒，缺口大的优先。</p>
    {stats.alerts.length ? <ol ref={listRef} className="hd-alert-list" tabIndex={0} aria-label="库存不足SKU列表，可滚动查看更多">{stats.alerts.map((row, index) => <li key={row.key}>
      <span className="hd-order-number" aria-hidden="true">{index+1}</span>
      <div className="hd-alert-item-copy"><strong title={row.productName}>{row.productName}</strong><p>{row.shopName} · SKU {row.skuName}</p><p>可售库存 {row.stock} · 近7天销量 {row.sales7d} 件 · 成交订单 {row.orders7d} 单</p></div>
      <span className={`hd-time-pill ${row.gap > 15 ? 'is-urgent' : ''}`}>缺 {row.gap} 件</span>
    </li>)}</ol> : <p className="hd-empty">当前没有库存低于近7天销量的SKU。</p>}
    {stats.unknownStock > 0 && <p className="hd-rule">{stats.unknownStock}个SKU库存未取得，未按0处理，也未纳入缺口计算。</p>}
    {stats.missingDates > 0 && <p className="hd-rule">{stats.missingDates}笔订单缺少时间，未纳入7天统计。</p>}
  </>;
}
