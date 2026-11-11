import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Store,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  ShoppingCart,
  ClipboardList
} from 'lucide-react';
import * as api from '../api';

const fmtMxn = (v) => (v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`);

export default function HomeView({ shops, products, markets, showToast, onNavigateTab, onOpenAddShop }) {
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const primaryShop = shops[0];
  // MXN → CNY：市场配置 exchange_rate_cny 语义为 1 CNY 可兑多少 MXN，故人民币 = 比索 / 汇率
  const rate = markets[0]?.exchange_rate_cny;

  const loadSummary = async () => {
    if (!primaryShop) return;
    setLoadingSummary(true);
    try {
      setSummary(await api.getOrderSummary(primaryShop.id));
    } catch (err) {
      showToast(`经营数据加载失败: ${err.message}`, '✕');
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => { loadSummary(); /* eslint-disable-next-line */ }, [primaryShop?.id]);

  const handleSync = async () => {
    if (!primaryShop || syncing) return;
    setSyncing(true);
    try {
      const r = await api.syncShopOrders(primaryShop.id, 7);
      showToast(`订单同步完成：拉取 ${r.fetched} 单（新增 ${r.created} / 更新 ${r.updated}）`);
      await loadSummary();
    } catch (err) {
      showToast(`TikTok 订单同步失败: ${err.message}`, '✕');
    } finally {
      setSyncing(false);
    }
};

  const steps = [
    {
      step: '第 1 步',
      title: '按国家绑定店铺',
      desc: '预置墨西哥站 (MXN/西语)，随时绑定 2个、3个、4个或更多店铺',
      actionText: '管理店铺',
      done: shops.length > 0,
      badgeText: `已激活 ${shops.length} 店`,
      onClick: () => onNavigateTab('shops')
    },
    {
      step: '第 2 步',
      title: '录入货源商品与阶梯价',
      desc: '录入供货商与 1件/2件/3件采购价，自动计算体积重防亏损',
      actionText: '货源管理',
      done: products.length > 0,
      badgeText: `已有 ${products.length} 款`,
      onClick: () => onNavigateTab('sourcing')
    },
    {
      step: '第 3 步',
      title: 'apimart AI生图与多店分发',
      desc: '自动换墨西哥生活背景与拉美面孔模特，每张图≤3次质检重试，差异化一键推店',
      actionText: '体验生图分发',
      done: false,
      badgeText: '核心增效',
      onClick: () => onNavigateTab('ai-media')
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* 欢迎头图 */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-medium text-indigo-200 mb-2">
            <span>🇲🇽 墨西哥 TikTok 跨境专项版</span>
            <span>·</span>
            <span>一人操盘多店</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">欢迎进入 ShopDesk 跨境运营工作台</h1>
          <p className="text-indigo-200 text-xs mt-1 max-w-xl leading-relaxed">
            打通「货源阶梯成本 ➔ 墨西哥定价 ➔ apimart AI换景换人生图 ➔ 多店错开刊登 ➔ 一件代发推仓履约」全链路。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAddShop}
            className="px-4 py-2.5 bg-white text-indigo-950 font-bold text-xs rounded-xl hover:bg-indigo-50 shadow-sm transition flex items-center gap-1.5"
          >
            <Store className="w-4 h-4 text-indigo-600" />
            <span>+ 绑定新店铺</span>
          </button>
          <button
            onClick={() => onNavigateTab('sourcing')}
            className="px-4 py-2.5 bg-indigo-700/80 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl border border-indigo-500/50 transition flex items-center gap-1.5"
          >
            <Package className="w-4 h-4" />
            <span>录入货源商品</span>
          </button>
        </div>
      </div>

      {/* 初始化三部曲进度卡 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">店铺启动核心三部曲</h2>
            <p className="text-xs text-slate-500 mt-0.5">循序渐进搭建您的多店矩阵，从选国绑店到阶梯测算与AI生图刊登</p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold">
            当前进度: {shops.length > 0 && products.length > 0 ? '2/3 步已就绪' : '1/3 步'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((st, i) => (
            <div 
              key={i} 
              className={`p-4 rounded-xl border transition cursor-pointer ${
                st.done 
                  ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300' 
                  : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
              }`}
              onClick={st.onClick}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 font-mono">{st.step}</span>
                {st.done ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {st.badgeText}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {st.badgeText}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-slate-900 text-sm">{st.title}</h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed min-h-[36px]">{st.desc}</p>
              
              <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-indigo-600">
                <span>{st.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 经营快报：TikTok 订单实时同步，按墨西哥城自然日聚合，GMV 排除未支付/已取消订单 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">经营快报</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              墨西哥城时区 {summary?.date || ''} 当日数据 · 同步于 {summary?.synced_at ? new Date(summary.synced_at).toLocaleString('zh-CN') : '—'}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || !primaryShop}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '正在同步订单...' : '同步最新订单'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* 今日 GMV */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>今日全店 GMV</span>
              <DollarSign className="w-4 h-4 text-indigo-500" />
            </div>
            {loadingSummary && !summary ? (
              <div className="text-2xl font-black text-slate-300 mt-2 text-sm">加载中...</div>
            ) : summary ? (
              <>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  {fmtMxn(summary.today_gmv)} <span className="text-xs font-normal text-slate-400">{summary.currency || 'MXN'}</span>
                </div>
                <div className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                  {summary.gmv_change_pct !== null && summary.gmv_change_pct !== undefined ? (
                    <span className={`font-bold flex items-center gap-0.5 ${summary.gmv_change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {summary.gmv_change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      环比 {summary.gmv_change_pct >= 0 ? '+' : ''}{summary.gmv_change_pct}%
                    </span>
                  ) : (
                    <span className="text-slate-400">昨日无成交</span>
                  )}
                  {rate && summary.today_gmv > 0 && (
                    <span className="text-slate-400">≈ ¥{(summary.today_gmv / rate).toLocaleString('zh-CN', { maximumFractionDigits: 0 })} RMB</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-2xl font-black text-slate-300 mt-2">— <span className="text-xs font-normal text-slate-400">暂无数据</span></div>
            )}
          </div>

          {/* 今日成交订单 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>今日成交订单</span>
              <ShoppingCart className="w-4 h-4 text-emerald-500" />
            </div>
            {summary ? (
              <>
                <div className="text-2xl font-black text-emerald-600 mt-2">
                  {summary.today_paid_order_count} <span className="text-xs font-normal text-slate-400">单</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">/ 共 {summary.today_total_order_count} 单</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">客单价 {fmtMxn(summary.today_avg_order_value)} MXN</div>
              </>
            ) : (
              <div className="text-2xl font-black text-slate-300 mt-2">— <span className="text-xs font-normal text-slate-400">暂无数据</span></div>
            )}
          </div>

          {/* 已绑定活跃店铺 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>已绑定活跃店铺</span>
              <Store className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-purple-700 mt-2">{shops.length} <span className="text-xs font-normal text-slate-400">个</span></div>
            <div className="text-[11px] text-slate-500 mt-1">墨西哥站 · 动态分发池</div>
          </div>

          {/* 待履约订单（真实运营待办） */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>待履约订单</span>
              <ClipboardList className="w-4 h-4 text-amber-500" />
            </div>
            {summary ? (
              <>
                <div className={`text-2xl font-black mt-2 ${summary.awaiting_fulfillment_count > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {summary.awaiting_fulfillment_count} <span className="text-xs font-normal text-slate-400">单</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">待发货 / 待揽收，需及时处理</div>
              </>
            ) : (
              <div className="text-2xl font-black text-slate-300 mt-2">— <span className="text-xs font-normal text-slate-400">暂无数据</span></div>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          口径说明：GMV 按买家实付额（payment.total_amount）统计，不含未支付与已取消订单；净利润需接入货源采购成本后另行计算。
        </p>
      </div>
    </div>
  );
}
