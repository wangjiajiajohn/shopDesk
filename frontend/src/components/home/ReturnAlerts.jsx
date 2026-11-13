import { useLayoutEffect, useRef } from 'react';
export default function ReturnAlerts({ data, error, orders, loading }) {
  const list = useRef(null);
  useLayoutEffect(() => {
    if (!list.current) return;
    const el = list.current, rows = [...el.children].slice(0, 2);
    const measure = () => { el.style.maxHeight = `${rows.reduce((n, row) => n + row.getBoundingClientRect().height, 0)}px`; };
    const observer = new ResizeObserver(measure); rows.forEach(row => observer.observe(row)); measure();
    return () => observer.disconnect();
  }, [data]);
  if (!data) return <p className={error ? 'hd-error' : 'hd-empty'} role={error ? 'alert' : 'status'}>{error || (loading ? '正在读取退货退款…' : '退货数据尚未读取')}</p>;
  const time = value => value ? new Date(value * 1000).toLocaleString('zh-CN', {timeZone:'America/Mexico_City', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '未取得';
  return <>
    {error && <p className="hd-error" role="alert">更新失败，保留上次数据：{error}</p>}
    <p className="hd-rule">显示待审核的退货退款、换货补发申请，以及买家已寄回待跟进的退货；已完成、取消及等待买家的记录不计入。</p>
    {data.total ? <ol ref={list} className="hd-alert-list" tabIndex={0} aria-label="待处理退货列表，可滚动查看更多">{data.items.map((item, i) => {
      const order = orders.find(row => row.shop_id === item.shop_id && row.tiktok_order_id === item.order_id);
      const name = order?.line_items?.map(line => line.product_name).filter(Boolean).join('；');
      return <li key={`${item.shop_id}-${item.return_id}`}><span className="hd-order-number">{i+1}</span><div className="hd-alert-item-copy"><strong>订单 {item.order_id}{name ? ` · ${name}` : ''}</strong><p>{item.shop_name} · 售后单 {item.return_id}</p><p>申请时间 {time(item.created_at)}（墨西哥城）</p></div><span className="hd-time-pill">{item.status_label}</span></li>;
    })}</ol> : <p className="hd-empty">暂无待处理退货退款，无需处理。</p>}
    <p className="hd-rule">TikTok售后快照 · {new Date(data.snapshot_at).toLocaleString('zh-CN', {timeZone:'America/Mexico_City', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}（墨西哥城）</p>
  </>;
}
