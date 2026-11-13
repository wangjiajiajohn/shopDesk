import React, { useState, useEffect, useRef } from 'react';
import { getSourceProductPage, updateSalesQueue } from '../api';
import { createSourcePageCache } from '../sourcePageCache';
import SourceProductImage from '../components/SourceProductImage';
import SourceCategoryList from '../components/SourceCategoryList';
import { sourceIssueOptions } from '../sourceProductData';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  ImageOff,
  X
} from 'lucide-react';

const specValues = (product, name, fallbackIndex) => {
  const specs = product.specs || [];
  const hit = specs.find(s => s.name === name);
  const spec = hit || specs[fallbackIndex];
  return spec?.values || [];
};

export default function SourcingView({
  products,
  suppliers,
  queuePage = false,
  onNavigateSourcing,
  onOpenAddProduct,
  onEditProduct,
  onDeleteProduct,
  onOpenSupplierModal,
}) {
  const [selectedSupplier, setSelectedSupplier] = useState(queuePage ? 'ALL' : '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedIssue, setSelectedIssue] = useState('ALL');
  const [previewImage, setPreviewImage] = useState(null);

  const queueOnly = queuePage;
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMessage, setQueueMessage] = useState('');
  const [queueError, setQueueError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [result, setResult] = useState({items: [], total: 0, catalog_total: 0, categories: [], category_counts: {}, issue_counts: {}});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pageCache = useRef(null);
  if (!pageCache.current) pageCache.current = createSourcePageCache();
  const [loadedAt, setLoadedAt] = useState(null);
  useEffect(() => { pageCache.current.clear(); }, [products, suppliers, retry]);
  useEffect(() => {
    if (queuePage) return;
    if (selectedSupplier && suppliers.some(s => s.id === selectedSupplier)) return;
    setSelectedSupplier(suppliers.length === 1 ? suppliers[0].id : '');
    setSelectedCategory('ALL'); setPage(1); setSelectedIds(new Set());
  }, [suppliers, selectedSupplier, queuePage]);
  useEffect(() => {
    let active = true;
    if (!selectedSupplier) {
      setResult({items: [], total: 0, catalog_total: 0, categories: [], category_counts: {}, issue_counts: {}});
      setLoadedAt(null); setLoading(false); setError('');
      return () => { active = false; };
    }
    const cache = pageCache.current;
    const params = {page, page_size: pageSize, q: searchQuery, category: selectedCategory, supplier_id: selectedSupplier, issue: selectedIssue, queue_only: queueOnly};
    const key = JSON.stringify(params);
    const cached = cache.get(key);
    if (cached) {
      setResult(cached.data); setLoadedAt(cached.loadedAt); setPage(cached.data.page); setLoading(false); setError('');
      return () => { active = false; };
    }
    const revision = cache.revision;
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      getSourceProductPage(params)
        .then(data => {
          const entry = cache.put(key, data, revision);
          if (active && entry) { setResult(data); setLoadedAt(entry.loadedAt); setPage(data.page); setLoading(false); }
        })
        .catch(err => { if (active) { setError(err.message); setLoading(false); } });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [page, pageSize, searchQuery, selectedCategory, selectedSupplier, selectedIssue, queueOnly, products, suppliers, retry]);
  const categories = result.categories.filter(c => result.category_counts[c] > 0), categoryCounts = result.category_counts;
  const supplierProductCount = result.supplier_total || 0;
  const filteredProducts = result.items;

  const selectable = filteredProducts.filter(p => !p.is_picked);
  const toggleSelection = id => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const changeQueue = async (ids, operation = 'add') => {
    setQueueBusy(true); setQueueError(''); setQueueMessage('');
    try {
      // The server accepts at most 100 ids; retain failed/unprocessed selections for retry.
      let completed = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const response = await updateSalesQueue(batch, operation);
        completed += response.changed;
        setSelectedIds(prev => new Set([...prev].filter(id => !batch.includes(id))));
        setRetry(v => v + 1);
      }
      setQueueMessage(operation === 'add' ? `已加入 ${completed} 款商品到TikTok商品创建队列` : '已移出TikTok商品创建队列');
    } catch (err) { setQueueError(`操作未全部完成：${err.message}。未完成的选择已保留，可重试。`); }
    finally { setQueueBusy(false); }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-5 w-full">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-slate-900">{queuePage ? '商品创建队列' : '货源商品库'}</h1>
          <span className="text-xs text-slate-600">{queuePage ? `${result.queue_total || 0} 款待创建商品` : selectedSupplier ? `${suppliers.find(s => s.id === selectedSupplier)?.name || ''} · ${result.supplier_total || 0} 款货源` : '请先选择供应商'}</span>
        </div>
        {queuePage ? <button type="button" onClick={onNavigateSourcing} className="px-3 py-2 text-xs text-indigo-700 rounded-lg border border-slate-200 bg-white">去货源库选品</button> : <div className="flex items-center gap-3">
          <button type="button" onClick={onOpenSupplierModal} className="px-2 py-2 text-slate-600 hover:text-indigo-700 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-indigo-600">管理供应商</button>
          <button type="button" onClick={() => onOpenAddProduct(selectedSupplier || null)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">
            <Plus className="w-4 h-4" /><span>新增货源</span>
          </button>
        </div>}
      </header>

      <div className="shrink-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2 text-slate-600">
          供应商
          <select value={selectedSupplier} onChange={e => { setSelectedSupplier(e.target.value); setSelectedCategory('ALL'); setSelectedIssue('ALL'); setSearchQuery(''); setSelectedIds(new Set()); setQueueMessage(''); setQueueError(''); setPage(1); }} className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white max-w-48">
            {queuePage ? <option value="ALL">全部供应商</option> : <option value="" disabled>请选择供应商</option>}
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          资料问题
          <select value={selectedIssue} onChange={e => { setSelectedIssue(e.target.value); setPage(1); }} className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white max-w-64 focus-visible:outline-indigo-600">
            <option value="ALL">全部商品</option>
            <option value="ANY">有问题或待复核资料</option>
            {sourceIssueOptions.map(([value, label]) => <option key={value} value={value}>{label} ({result.issue_counts[value] || 0})</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2 flex-1 min-w-48 md:ml-auto md:max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              aria-label="搜索货源商品"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="搜索品名、货号、供应商或供应商编码..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,2fr)] md:grid-cols-[11rem_minmax(0,1fr)] md:grid-rows-1 gap-4 overflow-hidden">
        <SourceCategoryList categories={categories} counts={categoryCounts} total={supplierProductCount} selected={selectedCategory} onSelect={value => { setSelectedCategory(value); setPage(1); }} />
        <section className="min-w-0 min-h-0 flex flex-col gap-3" aria-labelledby="source-results-heading">
          <div className="shrink-0 flex flex-wrap min-h-10 items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <h2 id="source-results-heading" className="font-semibold text-sm text-slate-900">{selectedCategory === 'ALL' ? (queueOnly ? '待创建商品' : '全部商品') : selectedCategory}</h2>
              <span role="status" aria-live="polite">{result.total} 款</span>
            </div>
            {!queueOnly && selectedIds.size > 0 && <div className="ml-auto flex flex-wrap items-center gap-3">
              <span>已选 {selectedIds.size} 款</span>
              <button disabled={queueBusy} className="underline disabled:opacity-40" onClick={() => setSelectedIds(new Set())}>清空</button>
              <button disabled={queueBusy} onClick={() => changeQueue([...selectedIds])} className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2">{queueBusy ? '正在保存…' : '加入TikTok商品创建队列'}</button>
            </div>}
          </div>
          {queueMessage && <p role="status" className="shrink-0 text-xs text-slate-700">{queueMessage}</p>}
          {queueError && <p role="alert" className="shrink-0 text-xs text-red-700">{queueError}</p>}
      {/* 紧凑 SPU 表格 */}
      {!selectedSupplier ? <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-600 text-sm">先选择供应商，再查看该供应商的分类和商品。{!suppliers.length && <button onClick={onOpenSupplierModal} className="block mx-auto mt-3 text-indigo-700 underline">新增供应商</button>}</div> : error ? <div role="alert" className="p-6 bg-white rounded-xl text-red-700">读取商品失败：{error}<button className="ml-3 underline" onClick={() => setRetry(v => v + 1)}>重试</button></div> : loading ? <div role="status" className="p-6 text-slate-600">正在加载本页商品…</div> : filteredProducts.length === 0 ? (
        <div className="flex-1 min-h-0 overflow-auto bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-600 text-xs">
          <p>{queueOnly && !result.queue_total ? '队列还没有商品，请前往货源商品库勾选加入。' : result.catalog_total ? '没有匹配的货源，请调整供应商、资料问题、搜索或类目筛选。' : '还没有货源商品，先选择或新增供应商，再录入第一款货源。'}</p>
          {!queuePage && !result.catalog_total && <button onClick={() => onOpenAddProduct(selectedSupplier || null)} className="mt-3 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold">选择供应商并录入</button>}
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="h-full overflow-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600" tabIndex={0} role="region" aria-label="商品列表，可滚动">
            <table className="w-full min-w-[44rem] table-fixed text-xs">
              <colgroup>
                {!queueOnly && <col className="w-10" />}
                <col className="w-28" />
                <col />
                <col className="w-28" />
                <col className="w-40" />
                <col className="w-36" />
                <col className="w-24" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] sticky top-0 z-20">
                <tr>
                  {!queueOnly && <th className="p-2 text-center"><input type="checkbox" aria-label="选择本页所有可加入的商品" disabled={queueBusy || !selectable.length} checked={selectable.length > 0 && selectable.every(p => selectedIds.has(p.id))} onChange={e => { const checked = e.target.checked; setSelectedIds(prev => { const next = new Set(prev); for (const p of selectable) { if (checked) next.add(p.id); else next.delete(p.id); } return next; }); }} /></th>}
                  <th className="p-2.5 text-left font-semibold whitespace-nowrap">资料图</th>
                  <th className="p-2.5 text-left font-semibold">商品</th>
                  <th className="p-2.5 text-left font-semibold whitespace-nowrap">采购价</th>
                  <th className="p-2.5 text-left font-semibold">颜色</th>
                  <th className="p-2.5 text-left font-semibold">尺码</th>
                  <th className="sticky right-0 z-30 bg-slate-50 p-2.5 text-center font-semibold border-l border-slate-200">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(p => {
                  const colors = specValues(p, '颜色', 0);
                  const sizes = specValues(p, '尺码', 1);
                  const colorText = colors.length ? `${colors.length} 色：${colors.join(' / ')}` : '—';
                  const sizeText = sizes.length ? `${sizes.length} 码：${sizes.join(' / ')}` : '—';
                  return (
                    <tr
                      key={p.id}
                      aria-selected={!queueOnly && (p.is_picked || selectedIds.has(p.id))}
                      onClick={event => {
                        if (queueOnly || queueBusy || p.is_picked || event.target.closest('button, input, select, a, textarea, label')) return;
                        toggleSelection(p.id);
                      }}
                      className={`transition ${!queueOnly && !p.is_picked && !queueBusy ? 'cursor-pointer' : ''} ${!queueOnly && (p.is_picked || selectedIds.has(p.id)) ? 'bg-indigo-50' : 'hover:bg-indigo-50/30'}`}
                    >
                      {!queueOnly && <td className="p-2 text-center"><input type="checkbox" aria-label={p.is_picked ? `${p.title}已加入TikTok商品创建队列` : `选择${p.title}`} checked={Boolean(p.is_picked || selectedIds.has(p.id))} disabled={queueBusy || p.is_picked} onChange={() => toggleSelection(p.id)} /></td>}
                      <td className="p-2.5 align-middle">
                        {p.main_image ? (
                          <SourceProductImage key={p.main_image} product={p} onPreview={setPreviewImage} />
                        ) : (
                          <div className="w-24 h-32 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500">
                            <ImageOff className="w-6 h-6" />
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 align-middle min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-bold text-slate-900 text-[13px] break-words">{p.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium shrink-0">
                            {p.category_name}
                          </span>
                        </div>
                        {p.is_picked && <p className="mt-1 text-[11px] text-indigo-700 font-semibold">已加入TikTok商品创建队列</p>}
                        {!!p.source_data?.issues?.length && (
                          <p className="mt-1 text-[11px] text-amber-800 font-medium">{p.source_data.issues.some(issue => issue.field === 'composition') ? '成分比例异常 · 待核对' : '资料待核对'}</p>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate" title={p.sku_code}>
                          {p.sku_code} · {p.supplier?.name || '未关联供应商'}
                        </div>
                      </td>
                      <td className="p-2.5 align-middle whitespace-nowrap">
                        {p.supply_price != null ? <>
                          <span className="font-semibold text-slate-900 tabular-nums">{Number(p.supply_price).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.supply_currency || 'CNY'}</span>
                          {p.source_data?.price_unit && <span className="block text-[11px] text-slate-600">/ {p.source_data.pack_quantity > 1 ? `套（${p.source_data.pack_quantity}${p.source_data.price_unit === 'pair' ? '双' : '件'}）` : p.source_data.price_unit === 'pair' ? '双' : '件'}</span>}
                        </> : <span className="text-slate-600">未填写</span>}
                      </td>
                      <td className="p-2.5 align-middle">
                        <span className="text-slate-600 whitespace-normal break-words leading-5 block" title={colorText}>{colorText}</span>
                      </td>
                      <td className="p-2.5 align-middle">
                        <span className="text-slate-600 whitespace-normal break-words leading-5 block" title={sizeText}>{sizeText}</span>
                      </td>
                      <td className={`sticky right-0 z-10 border-l border-slate-200 p-2.5 align-middle ${!queueOnly && (p.is_picked || selectedIds.has(p.id)) ? 'bg-indigo-50' : 'bg-white'}`}>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button
                            onClick={() => onEditProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title="编辑 SPU 信息"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {queueOnly && <button disabled={queueBusy} onClick={() => changeQueue([p.id], 'remove')} className="text-xs text-slate-600 underline disabled:opacity-40">移出队列</button>}
                          {!queuePage && <button
                            onClick={() => onDeleteProduct(p.id, p.title)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="删除 SPU"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span className="flex flex-wrap items-center gap-3"><label>每页 <select aria-label="每页商品数" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-slate-200 rounded-lg p-1.5 bg-white">{[20, 50, 100].map(n => <option key={n} value={n}>{n} 款</option>)}</select></label>{loadedAt && <span>服务器数据 · {new Date(loadedAt).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>}<button disabled={loading} onClick={() => setRetry(v => v + 1)} className="underline disabled:opacity-40">刷新数据</button></span>
            <div className="flex items-center gap-3"><button disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40">上一页</button><span>{page} / {Math.max(1, Math.ceil(result.total / pageSize))}</span><button disabled={loading || page * pageSize >= result.total} onClick={() => setPage(p => p + 1)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40">下一页</button></div>
          </div>
        </section>
      </div>

      {/* SPU 主图点击放大预览 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="预览"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
