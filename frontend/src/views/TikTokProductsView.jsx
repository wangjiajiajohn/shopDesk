import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, PackageSearch, CloudOff, ImageOff, ZoomIn, X, ChevronLeft, ChevronRight, ChevronDown, FolderTree, Folder, Tag } from 'lucide-react';
import * as api from '../api';

const PAGE_SIZE = 10;

// 统计类目树的叶子节点数
const countLeaves = (nodes) =>
  nodes.reduce((sum, n) => sum + (n.children?.length ? countLeaves(n.children) : 1), 0);

// 类目树形下拉：三层缩进 + 展开收起，点中间节点筛整棵子树、点叶子精确筛选
function CategoryTreeSelect({ tree, value, selectedLabel, onChange }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());   // 默认全展开，只记录手动收起的节点
  const wrapRef = useRef(null);
  const leafCount = countLeaves(tree);

  // 点击组件外部关闭面板
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggleCollapse = (nodeId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderNodes = (nodes, depth = 0) => nodes.map((node) => {
    const hasKids = node.children?.length > 0;
    const isCollapsed = collapsed.has(node.category_id);
    const active = value === node.category_id;
    return (
      <div key={node.category_id}>
        <div
          role="button"
          tabIndex={0}
          title={hasKids ? `点击筛选整棵子树：${node.path}（${node.product_count} 个商品）` : `点击只看该类目：${node.path}（${node.product_count} 个商品）`}
          onClick={() => { onChange(node.category_id, node.name); setOpen(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(node.category_id, node.name); setOpen(false); } }}
          className={`flex items-center gap-1 pr-2 py-1.5 rounded-lg cursor-pointer transition ${
            active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: depth * 16 + 4 }}
        >
          {hasKids ? (
            <button
              type="button"
              aria-label={isCollapsed ? '展开' : '收起'}
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.category_id); }}
              className="p-0.5 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-[22px] shrink-0" />
          )}
          {hasKids
            ? <Folder className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-indigo-500' : 'text-amber-500'}`} />
            : <Tag className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-indigo-500' : 'text-violet-500'}`} />}
          <span className="flex-1 truncate text-xs font-medium">{node.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
            active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
          }`}>{node.product_count}</span>
        </div>
        {hasKids && !isCollapsed && renderNodes(node.children, depth + 1)}
      </div>
    );
  });

  return (
    <div ref={wrapRef} className="relative flex-1 sm:w-60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className={`flex-1 text-left truncate ${selectedLabel ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
          {selectedLabel || `全部类目（${leafCount} 类）`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 w-72 max-w-[80vw] max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => { onChange('', ''); setOpen(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onChange('', ''); setOpen(false); } }}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition ${
              !value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FolderTree className={`w-3.5 h-3.5 ${!value ? 'text-indigo-500' : 'text-slate-400'}`} />
            <span className="flex-1 text-xs font-semibold">全部类目</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">{leafCount} 类</span>
          </div>
          <div className="my-1 border-t border-slate-100" />
          {tree.length === 0
            ? <div className="px-2 py-4 text-center text-xs text-slate-400">暂无类目数据</div>
            : renderNodes(tree)}
        </div>
      )}
    </div>
  );
}

// TikTok 商品状态 → 中文与徽章配色
const STATUS_META = {
  ACTIVATE: { label: '在售', cls: 'bg-emerald-100 text-emerald-700' },
  DRAFT: { label: '草稿', cls: 'bg-slate-100 text-slate-600' },
  PENDING: { label: '审核中', cls: 'bg-blue-100 text-blue-700' },
  FAILED: { label: '审核失败', cls: 'bg-rose-100 text-rose-700' },
  SELLER_DEACTIVATED: { label: '卖家下架', cls: 'bg-amber-100 text-amber-700' },
  PLATFORM_DEACTIVATED: { label: '平台下架', cls: 'bg-rose-100 text-rose-700' },
  FREEZE: { label: '冻结', cls: 'bg-rose-100 text-rose-700' },
  DELETED: { label: '已删除', cls: 'bg-slate-200 text-slate-500' },
};

const FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 'ACTIVATE', label: '在售' },
  { key: 'DRAFT', label: '草稿' },
  { key: 'SELLER_DEACTIVATED', label: '卖家下架' },
  { key: 'DELETED', label: '已删除' },
];

const fmtTs = (sec) => (sec ? new Date(sec * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtPrice = (p) => (p === null || p === undefined ? '—' : p.toLocaleString('es-MX', { maximumFractionDigits: 2 }));

export default function TikTokProductsView({ shops, showToast }) {
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [pageData, setPageData] = useState({ items: [], total: 0, status_counts: {}, category_tree: [] });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [catSyncing, setCatSyncing] = useState(false);
  const [filter, setFilter] = useState('ACTIVATE');   // 默认只看在售
  const [categoryId, setCategoryId] = useState('');        // 选中的官方类目 ID，'' = 全部
  const [categoryName, setCategoryName] = useState('');    // 选中节点中文展示名
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [syncedAt, setSyncedAt] = useState(null);
  const [preview, setPreview] = useState(null);   // 大图预览的商品对象

  const totalPages = Math.max(1, Math.ceil(pageData.total / PAGE_SIZE));
  const products = pageData.items;
  const statusCount = pageData.status_counts || {};
  const categoryTree = pageData.category_tree || [];

  // 大图预览：ESC 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPreview(null); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [preview]);

  // 店铺列表异步变化时兜底选中第一家
  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0].id);
  }, [shops, shopId]);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (filter !== 'ALL') params.status = filter;
      if (categoryId) params.category_id = categoryId;
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
      const data = await api.getShopProducts(shopId, params);
      setPageData(data);
      if (data.items[0]?.synced_at) setSyncedAt(data.items[0].synced_at);
      // 筛选后页码可能越界（如在末页删除商品），自动回退到最后一个有效页
      if (data.total > 0 && page > Math.ceil(data.total / PAGE_SIZE)) {
        setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
      }
    } catch (err) {
      showToast(`商品加载失败: ${err.message}`, '✕');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [shopId, filter, categoryId, debouncedQuery, page]);

  // 搜索输入防抖 350ms，避免每个字符都打一次接口
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // 切换店铺/状态/类目时回到第一页
  const changeFilter = (key) => { setFilter(key); setPage(1); };
  const changeCategory = (id, name) => { setCategoryId(id); setCategoryName(name); setPage(1); };
  const changeShop = (val) => { setShopId(val); setPage(1); setCategoryId(''); setCategoryName(''); };

  // 手动刷新 zh-CN 官方类目字典（同区域多店铺共享）
  const handleSyncCategories = async () => {
    if (!shopId) return;
    setCatSyncing(true);
    try {
      const r = await api.syncShopCategories(shopId);
      showToast(`类目字典已更新：${r.locale} 共 ${r.total} 个节点（新增 ${r.created} / 更新 ${r.updated}）`);
      await load();
    } catch (err) {
      showToast(`类目字典更新失败: ${err.message}`, '✕');
    } finally {
      setCatSyncing(false);
    }
  };

  const handleSync = async () => {
    if (!shopId) return;
    setSyncing(true);
    try {
      const r = await api.syncShopProducts(shopId, 'ALL');
      const imgText = r.image_fetched ? `，补全主图 ${r.image_fetched} 张` : '';
      const errText = r.image_errors ? `，${r.image_errors} 张主图失败` : '';
      showToast(`同步完成：拉取 ${r.fetched} 个（新增 ${r.created} / 更新 ${r.updated}）${imgText}${errText}`);
      await load();
    } catch (err) {
      showToast(`TikTok 同步失败: ${err.message}`, '✕');
    } finally {
      setSyncing(false);
    }
  };

  if (shops.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center max-w-lg mx-auto my-12 space-y-3">
        <CloudOff className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="text-sm font-bold text-slate-800">还没有已绑定的 TikTok 店铺</h2>
        <p className="text-xs text-slate-500">请先在「市场与店铺管理」绑定店铺并完成授权，才能同步线上商品。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🛍️ TikTok 店铺商品</span>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-200">
              Open API 实时同步
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            从 TikTok Shop 拉取线上商品快照并本地落库，含 SKU 价格区间与多仓库存
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <select
            value={shopId}
            onChange={(e) => changeShop(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.shop_name} ({s.tiktok_shop_id})</option>
            ))}
          </select>
          <button
            onClick={handleSyncCategories}
            disabled={catSyncing}
            title="从 TikTok 拉取最新中文类目字典（同区域多店铺共享）"
            className="px-3.5 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <FolderTree className={`w-4 h-4 text-indigo-500 ${catSyncing ? 'animate-spin' : ''}`} />
            {catSyncing ? '更新中...' : '更新类目'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '正在同步...' : '立即同步'}
          </button>
        </div>
      </div>

      {/* 筛选、类目与搜索：tab 计数为店铺全量，不受当前筛选影响；同步时间并入本工具条；sticky 吸顶常驻 */}
      <div className="sticky top-0 z-20 bg-white p-3 rounded-xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => changeFilter(f.key)}
              className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1 rounded-full ${filter === f.key ? 'bg-white/20' : 'bg-white text-slate-500'}`}>
                {f.key === 'ALL' ? Object.values(statusCount).reduce((a, b) => a + b, 0) : (statusCount[f.key] || 0)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            最近同步：{syncedAt ? new Date(syncedAt).toLocaleString('zh-CN') : '尚未同步'}
          </span>
          <CategoryTreeSelect
            tree={categoryTree}
            value={categoryId}
            selectedLabel={categoryName}
            onChange={changeCategory}
          />
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索商品标题或 TikTok ID"
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 商品表 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
            <tr>
              <th className="p-3.5 w-20">主图</th>
              <th className="p-3.5">商品</th>
              <th className="p-3.5">类目</th>
              <th className="p-3.5">状态</th>
              <th className="p-3.5">SKU</th>
              <th className="p-3.5">价格区间 (MXN)</th>
              <th className="p-3.5">总库存</th>
              <th className="p-3.5">平台更新时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="8" className="p-8 text-center text-slate-400">加载中...</td></tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-10 text-center text-slate-400">
                  <PackageSearch className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  {pageData.total === 0 && filter === 'ACTIVATE'
                    ? '当前筛选下没有商品，可切换到「全部」查看其他状态'
                    : '没有匹配的商品，换个关键词或清空类目筛选试试'}
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const meta = STATUS_META[p.status] || { label: p.status, cls: 'bg-slate-100 text-slate-600' };
                const priceText = p.min_price === null
                  ? '—'
                  : p.min_price === p.max_price
                    ? `$${fmtPrice(p.min_price)}`
                    : `$${fmtPrice(p.min_price)} ~ $${fmtPrice(p.max_price)}`;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5">
                      {p.main_image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreview(p)}
                          title="点击查看大图"
                          className="relative group block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0 cursor-zoom-in"
                        >
                          <img
                            src={p.main_image_url}
                            alt={p.title || '商品主图'}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; e.currentTarget.parentElement.nextElementSibling.style.display = 'flex'; }}
                          />
                          <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/35 transition-colors flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </button>
                      ) : null}
                      <div
                        className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 items-center justify-center text-slate-300 shrink-0"
                        style={{ display: p.main_image_url ? 'none' : 'flex' }}
                      >
                        <ImageOff className="w-6 h-6" />
                      </div>
                    </td>
                    <td className="p-3.5 max-w-[300px]">
                      <div className="font-semibold text-slate-900 line-clamp-2">{p.title || '（无标题）'}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        ID: {p.tiktok_product_id}
                        {p.has_draft && <span className="px-1 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold">有草稿</span>}
                      </div>
                    </td>
                    <td className="p-3.5 max-w-[150px]">
                      {(p.category_name_zh || p.category_name) ? (
                        <span
                          className="inline-block px-2 py-0.5 bg-violet-50 text-violet-700 rounded text-[11px] font-medium line-clamp-2"
                          title={
                            p.category_name_zh
                              ? `${p.category_name_zh}（西语原名：${p.category_path || p.category_name}）`
                              : (p.category_path || p.category_name)
                          }
                        >
                          {p.category_name_zh || p.category_name}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-medium whitespace-nowrap ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800">{p.sku_count}</td>
                    <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">{priceText}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-medium ${p.inventory_total > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {p.inventory_total} 件
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">{fmtTs(p.tiktok_update_time)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页：白卡化后 sticky 吸底，避免滚过的表格行透出 */}
      {pageData.total > 0 && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-white rounded-xl border border-slate-200 shadow-md px-4 py-3">
          <span>
            共 <b className="text-slate-800">{pageData.total}</b> 个商品，第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
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
                  n === page ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white flex items-center gap-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一页 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 大图预览：全屏遮罩 + 原图，ESC / 点击遮罩 / 关闭按钮均可退出 */}
      {preview && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-900/85 flex flex-col items-center justify-center p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="商品大图预览"
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition"
            aria-label="关闭预览"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-[92vw] max-h-[82vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={preview.main_image_large_url || preview.main_image_url}
              alt={preview.title || '商品大图'}
              referrerPolicy="no-referrer"
              className="max-w-[92vw] max-h-[78vh] object-contain rounded-xl bg-white shadow-2xl"
            />
          </div>

          <div
            className="mt-4 max-w-2xl text-center text-white space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold line-clamp-2">{preview.title || '（无标题）'}</p>
            <p className="text-[11px] text-white/60 font-mono">
              TikTok 商品 ID: {preview.tiktok_product_id}
              {preview.price_currency && preview.min_price !== null
                && ` · ${preview.min_price === preview.max_price ? `$${fmtPrice(preview.min_price)}` : `$${fmtPrice(preview.min_price)} ~ $${fmtPrice(preview.max_price)}`} ${preview.price_currency}`}
            </p>
            <p className="text-[10px] text-white/40 pt-1">按 ESC 或点击空白处关闭</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
