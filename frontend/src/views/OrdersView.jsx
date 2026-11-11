import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw, Search, PackageSearch, CloudOff,
  Clock, ImageOff, ChevronLeft, ChevronRight,
} from 'lucide-react';
import * as api from '../api';

// 待履约合并视图（运营最关心的待办）
const AWAITING_GROUP = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION'];

const FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 'AWAITING', label: '待履约' },
  { key: 'IN_TRANSIT', label: '运输中' },
  { key: 'DELIVERED', label: '已送达' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'UNPAID', label: '未支付' },
  { key: 'CANCELLED', label: '已取消' },
];

const SYNC_DAYS = [7, 30, 90];

// 后端分页单位是订单（不是明细行），同一订单的多个 SKU 行天然同页
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const fmtMoney = (v, currency = 'MXN') =>
  v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${currency}`;

const fmtMxTime = (sec) =>
  sec
    ? new Date(sec * 1000).toLocaleString('zh-CN', {
        timeZone: 'America/Mexico_City', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export default function OrdersView({ shops, showToast }) {
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [orders, setOrders] = useState([]);            // 当前页订单（服务端分页）
  const [total, setTotal] = useState(0);               // 筛选后的服务端总数
  const [statusCounts, setStatusCounts] = useState({}); // 全店铺状态分布（不受筛选影响）
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  // 请求序号：快速翻页/输入时只接受最后一次响应，防止旧响应覆盖新数据
  const reqSeq = useRef(0);

  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0].id);
  }, [shops, shopId]);

  // 搜索输入防抖，避免每个按键都打后端
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // 换店 / 切状态 / 搜索词变化时回到第一页
  useEffect(() => { setPage(1); }, [shopId, filter, debouncedQuery]);

  // 请求驱动的分页加载：状态筛选与关键词全部下沉后端
  useEffect(() => {
    if (!shopId) return undefined;
    const seq = ++reqSeq.current;
    setLoading(true);

    const params = { page, page_size: PAGE_SIZE };
    if (filter !== 'ALL') {
      params.status = filter === 'AWAITING' ? AWAITING_GROUP.join(',') : filter;
    }
    if (debouncedQuery) params.keyword = debouncedQuery;

    api.getShopOrders(shopId, params)
      .then((res) => {
        if (seq !== reqSeq.current) return; // 过期响应直接丢弃
        const items = res.items || [];
        setOrders(items);
        setTotal(res.total || 0);
        setStatusCounts(res.status_counts || {});
        // 页码越界回退（如同步后订单变少）：服务端还有数据但当前页为空，跳到真实末页
        const lastPage = Math.max(1, Math.ceil((res.total || 0) / PAGE_SIZE));
        if (items.length === 0 && res.total > 0 && page > lastPage) setPage(lastPage);
      })
      .catch((err) => {
        if (seq === reqSeq.current) showToast(`订单加载失败: ${err.message}`, '✕');
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false);
      });
    return () => { /* seq 失效由 reqSeq 比对完成 */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, page, filter, debouncedQuery, reloadTick]);

  const handleSync = async () => {
    if (!shopId || syncing) return;
    setSyncing(true);
    try {
      const r = await api.syncShopOrders(shopId, days);
      showToast(`订单同步完成：近 ${r.range_days} 天拉取 ${r.fetched} 单（新增 ${r.created} / 更新 ${r.updated}）`);
      setReloadTick((t) => t + 1);
    } catch (err) {
      showToast(`TikTok 订单同步失败: ${err.message}`, '✕');
    } finally {
      setSyncing(false);
    }
  };

  // 当前页订单拆成 SKU 行：同订单多明细时订单级字段仅首行显示
  const pageRows = useMemo(() => orders.flatMap((o) => {
    const items = o.line_items && o.line_items.length ? o.line_items : [null];
    return items.map((li, idx) => ({
      key: `${o.id}-${li?.id ?? 'empty'}-${idx}`,
      order: o,
      li,
      isFirst: idx === 0,
    }));
  }), [orders]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const hasActiveFilter = filter !== 'ALL' || !!debouncedQuery;

  if (shops.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-lg mx-auto my-12 space-y-3">
        <CloudOff className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="text-sm font-bold text-slate-800">还没有已绑定的 TikTok 店铺</h2>
        <p className="text-xs text-slate-500">请先在「市场与店铺管理」绑定店铺并完成授权，才能同步线上订单。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🚚 订单推仓履约</span>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-200">
              Open API 实时同步
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            按墨西哥城时区展示线上订单与 SKU 明细；不含买家隐私信息
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.shop_name} ({s.tiktok_shop_id})</option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            title="同步时间范围"
          >
            {SYNC_DAYS.map((d) => (
              <option key={d} value={d}>近 {d} 天</option>
            ))}
          </select>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '正在同步...' : '同步订单'}
          </button>
        </div>
      </div>

      {/* 筛选与搜索：tab 计数来自服务端全量 status_counts，不受当前筛选/搜索影响；sticky 吸顶常驻 */}
      <div className="sticky top-0 z-20 bg-white p-3 rounded-xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const count = f.key === 'AWAITING'
              ? AWAITING_GROUP.reduce((sum, st) => sum + (statusCounts[st] || 0), 0)
              : f.key === 'ALL'
                ? Object.values(statusCounts).reduce((sum, n) => sum + n, 0)
                : (statusCounts[f.key] || 0);
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                  filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
                <span className={`text-[10px] px-1 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-white text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索订单号 / 商品名 / 商家 SKU"
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* 订单表：每个 SKU 明细一行；同一订单多明细时，订单号/创建时间/付款金额仅首行展示，续行底色区分 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
            <tr>
              <th className="p-3.5 w-24">SKU 图</th>
              <th className="p-3.5">订单 ID</th>
              <th className="p-3.5">商品名</th>
              <th className="p-3.5">SKU</th>
              <th className="p-3.5">创建时间 (墨西哥)</th>
              <th className="p-3.5 text-right">付款金额</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-slate-400">加载中...</td></tr>
            ) : total === 0 ? (
              <tr>
                <td colSpan="6" className="p-10 text-center text-slate-400">
                  <PackageSearch className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  {hasActiveFilter ? '没有匹配的订单，换个关键词或清除筛选试试' : '本地还没有订单，选择时间范围后点击「同步订单」'}
                </td>
              </tr>
            ) : (
              pageRows.map(({ key, order: o, li, isFirst }) => (
                <tr key={key} className={`transition hover:bg-slate-50/80 ${isFirst ? '' : 'bg-slate-50/40'}`}>
                  <td className="p-3.5">
                    {li?.image_url ? (
                      <img
                        src={li.image_url}
                        alt={li.product_name || 'SKU 图片'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 min-w-[64px] rounded-md object-contain border border-slate-200 bg-slate-50 shrink-0 p-0.5"
                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div
                      className="w-16 h-16 min-w-[64px] rounded-md border border-slate-200 bg-slate-50 items-center justify-center text-slate-300 shrink-0"
                      style={{ display: li?.image_url ? 'none' : 'flex' }}
                    >
                      <ImageOff className="w-4 h-4" />
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {isFirst ? o.tiktok_order_id : ''}
                  </td>
                  <td className="p-3.5 max-w-[320px]">
                    <div className="line-clamp-2 text-slate-800 font-medium">{li?.product_name || '—'}</div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">{li?.seller_sku || '—'}</td>
                  <td className="p-3.5 text-slate-500 whitespace-nowrap">
                    {isFirst ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {fmtMxTime(o.tiktok_create_time)}
                      </span>
                    ) : ''}
                  </td>
                  <td className="p-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                    {isFirst ? fmtMoney(o.total_amount, o.currency) : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页：服务端真分页，每页 20 单；无数据时不展示；白卡化后 sticky 吸底，避免滚过的表格行透出 */}
      {total > 0 && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-white rounded-xl border border-slate-200 shadow-md px-4 py-3">
          <span>
            共 <b className="text-slate-800">{total}</b> 个订单，每页 {PAGE_SIZE} 个，第 {safePage} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1 || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white flex items-center gap-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> 上一页
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                disabled={loading}
                className={`w-8 h-8 rounded-lg font-medium transition ${
                  n === safePage ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white flex items-center gap-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一页 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
