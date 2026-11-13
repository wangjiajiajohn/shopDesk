const STATUS = { UNPAID: '未支付', ON_HOLD: '暂挂中', AWAITING_SHIPMENT: '待准备发货', PARTIALLY_SHIPPING: '部分发货', AWAITING_COLLECTION: '待物流揽收', IN_TRANSIT: '运输中', DELIVERED: '已送达', COMPLETED: '已完成', CANCELLED: '已取消' };
const RISK = { cancellation: '自动取消风险', overdue: '已过截止', due_soon: '24小时内到期', unknown: '截止待同步', on_track: '未到预警时间' };
const time = value => value ? new Date(value * 1000).toLocaleString('zh-CN', { timeZone: 'America/Mexico_City', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '未取得';
const remaining = seconds => {
  if (seconds == null) return '剩余时间未知';
  const mins = Math.ceil(Math.abs(seconds) / 60);
  const hours = Math.floor(mins / 60);
  return `${seconds <= 0 ? '已超时' : '剩余'} ${hours}小时${mins % 60}分`;
};
export default function OrderFulfillment({ order }) {
  const m = order.monitor;
  return <div className="space-y-1 min-w-56 text-xs text-slate-700">
    <div className="font-semibold text-slate-900">{STATUS[order.status] || order.status}</div>
    {m && <>
      <div className={['overdue', 'cancellation'].includes(m.risk) ? 'text-rose-800 font-semibold' : m.risk === 'due_soon' ? 'text-amber-900 font-semibold' : 'text-slate-700'}>{RISK[m.risk]} · {remaining(m.remaining_seconds)}</div>
      <div>{m.stage === 'preparing' ? '备货' : '揽收'}截止：{time(m.deadline)}</div>
      {m.cancel_deadline && <div>自动取消：{time(m.cancel_deadline)}<br />{remaining(m.cancel_remaining_seconds)}</div>}
      {m.stale && <div className="text-amber-900">快照超过30分钟，请同步核对</div>}
    </>}
  </div>;
}
