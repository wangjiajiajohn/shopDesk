import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import ReturnAlerts from './ReturnAlerts';
import StockAlerts from './StockAlerts';
import { matchesDeadlineFilter, shippingAlerts } from '../../home/stats';

const formatTime = seconds => seconds ? new Date(seconds * 1000).toLocaleString('zh-CN', { timeZone: 'America/Mexico_City', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '未取得';
const formatRemaining = seconds => { const minutes = Math.ceil(Math.abs(seconds) / 60); return `${seconds < 0 ? '已超时' : '剩'} ${Math.floor(minutes / 60)}h ${minutes % 60}m`; };
const FILTERS = [['all', '全部'], ['overdue', '已超时'], ['under24', '不足24小时'], ['under48', '不足48小时']];

export default function HomeAlerts({ returns, returnsError, stockStats, stockError, monitor, orders, loading, error, now, snapshot, syncing, onSync, canSync, scopeKey, selectedShopId, onOpenOrder }) {
  const [expanded, setExpanded] = useState('shipping');
  const listRef = useRef(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => { setExpanded('shipping'); setFilter('all'); }, [scopeKey]);
  const items = shippingAlerts(monitor, orders || [], now / 1000);
  const previewItems = shippingAlerts(monitor, orders || [], now / 1000, 172800);
  const bucketCounts = Object.fromEntries(FILTERS.map(([key]) => [key, key === 'all' ? items.length : previewItems.filter(item => matchesDeadlineFilter(item.remaining, key)).length]));
  const overdue = bucketCounts.overdue, urgent = items.filter(item => item.urgent).length;
  const groups = [
    { key: 'shipping', name: '待发货', available: !!monitor && !error, count: monitor && !error ? (monitor.total ?? monitor.items.length) : null, urgent, overdue },
    { key: 'returns', name: '待处理退货', available: !!returns, count: returns ? returns.total : null },
    { key: 'stock', name: '库存不足', available: !!stockStats, count: stockStats ? stockStats.alerts.length : null, urgent: stockStats?.alerts.filter(row => row.gap > 15).length || 0 },
    { key: 'reviews', name: '未处理负面评价', available: false, count: null },
  ];
  const totalAlerts = (error ? 0 : items.length) + (stockStats?.alerts.length || 0) + (returns?.total || 0);
  const filtered = filter === 'all' ? items : previewItems.filter(item => matchesDeadlineFilter(item.remaining, filter));
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = 0;
    const rows = [...list.children].slice(0, 2);
    const measure = () => { list.style.maxHeight = `${rows.reduce((height, row) => height + row.getBoundingClientRect().height, 0)}px`; };
    const observer = new ResizeObserver(measure);
    rows.forEach(row => observer.observe(row)); measure();
    return () => observer.disconnect();
  }, [expanded, filter, filtered.length]);
  const toggle = key => { setExpanded(current => current === key ? null : key); setFilter('all'); };
  return <section className="hd-alerts" aria-labelledby="hd-alert-title">
    <div className="hd-heading-row">
      <div className="hd-heading"><h1 id="hd-alert-title">监控提醒</h1>{totalAlerts > 0 && <span className="hd-total">{totalAlerts} 项待处理</span>}</div>
      <div className="hd-snapshot"><span>店铺快照 {snapshot}（墨西哥城）<span className="hd-expand-hint"> · 点击数字展开明细</span></span><button className="hd-button hd-primary" onClick={onSync} disabled={syncing || !canSync}><RefreshCw aria-hidden="true" size={15} className={syncing ? 'hd-spin' : ''} />{syncing ? '同步中…' : '同步'}</button></div>
    </div>
    <div className="hd-alert-panel">
      <div className="hd-alert-summary">
        {groups.map(group => {
          const note = group.key === 'shipping' ? group.available && items.length > 0 ? `${items.length}单不足24小时` : '' : group.urgent > 0 ? `${group.urgent}项紧急` : '';
          const level = group.urgent || (['shipping', 'stock'].includes(group.key) && group.count > 0) ? 'hot' : group.count > 0 ? 'warm' : 'neutral';
          return <button key={group.key} className={`hd-alert-tag hd-${level} ${expanded === group.key ? 'is-selected' : ''}`} aria-expanded={expanded === group.key} aria-controls={`hd-detail-${group.key}`} onClick={() => toggle(group.key)}>
            <span className="hd-alert-count">{group.count ?? '—'}</span>
            <span className="hd-alert-name">{group.name}</span>
            {note && <span className="hd-alert-note">{note}<span className="hd-pulse" aria-hidden="true" /></span>}
          </button>;
        })}
      </div>
      {expanded && <div className="hd-alert-detail" id={`hd-detail-${expanded}`}>
        {expanded === 'returns' ? <ReturnAlerts data={returns} error={returnsError} orders={orders} loading={loading}/> : expanded === 'stock' ? <StockAlerts stats={stockStats} error={stockError} loading={loading}/> : expanded !== 'shipping' ? <div className="hd-unavailable"><strong>{expanded === 'reviews' ? '评价监控尚未接入' : '库存监控尚未接入'}</strong><p>{expanded === 'reviews' ? '接入后按1–3星且尚未回复筛选，优先显示等待最久的评价。' : '接入后按SKU比较可售库存与近7天销量，优先显示缺口最大的SKU。'}</p><p>当前无法判断是否存在提醒，不以0条代替未知。</p></div> : error || !monitor ? <p role="status">{error || '正在读取线上订单快照…'}</p> : <>
          <p className="hd-rule">平台截止时间保持原值，提前24小时提醒。待备货与待揽收分别按对应截止判断，临近自动取消单独标记。不足48小时包含不足24小时的订单，供提前查看。</p>
          <div className="hd-filter-toolbar"><div className="hd-filters" role="tablist" aria-label="按剩余时间筛选">{FILTERS.map(([key, label]) => <button key={key} className={`hd-filter ${filter === key ? 'is-selected' : ''}`} role="tab" id={`hd-tab-${key}`} aria-selected={filter === key} aria-controls="hd-shipping-results" tabIndex={filter === key ? 0 : -1} onKeyDown={event => { const index = FILTERS.findIndex(([value]) => value === key); const next = event.key === 'ArrowRight' ? (index + 1) % FILTERS.length : event.key === 'ArrowLeft' ? (index + FILTERS.length - 1) % FILTERS.length : event.key === 'Home' ? 0 : event.key === 'End' ? FILTERS.length - 1 : null; if (next !== null) { event.preventDefault(); setFilter(FILTERS[next][0]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus(); } }} onClick={() => setFilter(key)}>{label}<span>（{bucketCounts[key]}）</span></button>)}</div><a className="hd-button hd-primary" href="https://yuanchuanghulian.topwms.com/order/index" target="_blank" rel="noopener noreferrer" aria-label="去处理订单（新标签页打开仓库订单页面）">去处理</a></div>
          <div id="hd-shipping-results" role="tabpanel" aria-labelledby={`hd-tab-${filter}`}>
          {filtered.length ? <ol ref={listRef} className="hd-alert-list" tabIndex={0} aria-label="订单提醒列表，可滚动查看更多">{filtered.map((item, index) => <li key={`${item.shop_id}-${item.order_id}`}>
            <span className="hd-order-number" aria-hidden="true">{index + 1}</span><div className="hd-alert-item-copy"><strong title={`订单 ${item.order_id} · ${item.itemsText}`}>订单 {item.order_id} · {item.itemsText}</strong><p>{item.shop_name} · {item.stage === 'preparing' ? '备货' : '揽收'}截止 {formatTime(item.deadline)}</p>{item.cancel_deadline && <p>自动取消截止 {formatTime(item.cancel_deadline)}{item.risk === 'cancellation' ? ' · 自动取消风险' : ''}</p>}{item.stale && <p>快照超过30分钟，请同步核对。</p>}</div>
            <div className="hd-order-actions"><span className={`hd-time-pill ${item.urgent ? 'is-urgent' : ''}`}>{formatRemaining(item.remaining)}</span></div>
          </li>)}</ol> : <p className="hd-empty">暂无该档订单，无需处理</p>}


          </div>
          {monitor.counts.unknown > 0 && <p className="hd-rule">另有 {monitor.counts.unknown} 单缺少平台截止时间，需进入订单列表核对。</p>}
        </>}
      </div>}
    </div>
  </section>;
}
