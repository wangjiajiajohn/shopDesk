import { ArrowRight, AlertTriangle } from 'lucide-react';

const control = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50';

export default function OrderMonitor({ data, error, loading, hasShops, selectedShopId = 'ALL', onOpenOrder }) {
  const counts = data?.counts;
  const urgent = counts ? counts.overdue + counts.due_soon + counts.cancellation : null;
  return <section aria-label="订单提醒" className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2"><AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-800" />订单提醒</h2>
        <p className="text-sm text-slate-700 mt-1" aria-live="polite">{!hasShops ? '绑定并授权店铺后开启订单监控' : loading && !data ? '正在读取提醒…' : error ? '提醒读取失败，请使用右上角同步' : `${urgent ?? '—'} 单需优先处理 · ${counts?.unknown ?? '—'} 单截止时间待核对`}</p>
      </div>
      <button className={control} onClick={() => onOpenOrder(selectedShopId, null, true)} disabled={!hasShops}><span className="inline-flex items-center gap-1">查看提醒<ArrowRight aria-hidden="true" className="h-4 w-4" /></span></button>
    </div>
  </section>;
}
