import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Building2,
  ImageOff,
  ChevronDown,
  ChevronRight,
  Boxes,
  Image as ImageIcon,
  PackageOpen
} from 'lucide-react';
import SkuModal from '../components/SkuModal';

// 尺码自然排序：S < M < L < XL < 2XL < 3XL；罩杯 A < B < C < D
const SIZE_RANK = { S: 1, M: 2, L: 3, XL: 4, '2XL': 5, '3XL': 6, '4XL': 7, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
function sizeRank(v) {
  if (SIZE_RANK[v] != null) return SIZE_RANK[v];
  const m = /^(\d+)(X+L)$/i.exec(v);
  if (m) return 10 + Number(m[1]) * 10 + m[2].length;
  return 100;
}

const attrValue = (sku, name) => (sku.attributes || []).find(a => a.name === name)?.value ?? '';

const ROLE_LABEL = {
  main: '主图', sub: '副图', sku: '变体图', detail: '详情图',
  size_chart: '尺码表', certification: '资质图'
};

export default function SourcingView({
  products,
  suppliers,
  onOpenAddProduct,
  onEditProduct,
  onDeleteProduct,
  onOpenSupplierModal,
  onQuickDistribute,
  onRefreshProduct,
  onNotify
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [skuModal, setSkuModal] = useState({ open: false, product: null, sku: null, preset: null });

  // 首次加载默认展开第一个 SPU
  useEffect(() => {
    if (products.length && expandedIds.size === 0) {
      setExpandedIds(new Set([products[0].id]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category_name).filter(Boolean))),
    [products]
  );

  const filteredProducts = products.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    const supplierName = p.supplier?.name || '';
    const matchQ = !q ||
      p.title.toLowerCase().includes(q) ||
      p.sku_code.toLowerCase().includes(q) ||
      supplierName.toLowerCase().includes(q) ||
      (p.skus || []).some(s => (s.supplier_sku_code || '').toLowerCase().includes(q));
    const matchCat = selectedCategory === 'ALL' || p.category_name === selectedCategory;
    return matchQ && matchCat;
  });

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 价格区摘要：全部同价显示一口价，否则显示区间
  const priceSummary = (p) => {
    const prices = (p.skus || []).map(s => s.supply_price).filter(v => v != null);
    if (!prices.length) return p.price_tier_1 != null ? `¥${p.price_tier_1} 起` : '未定价';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const cur = (p.skus || []).find(s => s.currency)?.currency || p.supply_currency || '';
    return min === max ? `$${min} ${cur} 一口价` : `$${min} ~ $${max} ${cur}`;
  };

  // 构造颜色×尺码矩阵
  const buildMatrix = (product) => {
    const specs = product.specs || [];
    if (specs.length < 2) return null;
    const rowAttr = specs[0].name;
    const colAttr = specs[1].name;
    const rows = specs[0].values || [];
    const cols = [...(specs[1].values || [])].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
    const map = new Map();
    for (const sku of product.skus || []) {
      const r = attrValue(sku, rowAttr);
      const c = attrValue(sku, colAttr);
      if (r && c) map.set(`${r}||${c}`, sku);
    }
    return { rowAttr, colAttr, rows, cols, map };
  };

  const assetMap = (product) => new Map((product.assets || []).map(a => [a.id, a]));

  const openSkuCreate = (product, preset) => setSkuModal({ open: true, product, sku: null, preset });
  const openSkuEdit = (product, sku) => setSkuModal({ open: true, product, sku, preset: null });

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>📦 货源商品库</span>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-200">
              SPU / SKU 三层模型
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            按 SPU 款族管理供应商货源，颜色×尺码矩阵维护每个 SKU 的一口价、库存与素材；素材与变体数据直接驱动 TikTok 墨西哥站草稿刊登。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            onClick={onOpenSupplierModal}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>供货商管理 ({suppliers.length})</span>
          </button>

          <button
            onClick={onOpenAddProduct}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ 新增货源 SPU</span>
          </button>
        </div>
      </div>

      {/* 筛选与搜索条 */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索品名、货号、供应商或供应商编码..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-slate-400 font-medium">类目:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              selectedCategory === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            全览
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                selectedCategory === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* SPU 卡片列表 */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-xs">
          暂无匹配的货源商品，点击上方“新增货源 SPU”录入
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map(p => {
            const expanded = expandedIds.has(p.id);
            const matrix = buildMatrix(p);
            const aMap = assetMap(p);
            const specText = (p.specs || []).map(s => `${s.values.length} ${s.name}`).join(' × ');
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
                {/* SPU 摘要行（点击展开） */}
                <div className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="text-slate-400 hover:text-indigo-600 shrink-0"
                    title={expanded ? '收起' : '展开 SKU 矩阵'}
                  >
                    {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>

                  {p.main_image ? (
                    <img src={p.main_image} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                      <ImageOff className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{p.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                        {p.category_name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      {p.sku_code} · {p.supplier?.name || '未关联供应商'}
                      {p.supplier?.shipping_sla_hours ? ` · SLA ${p.supplier.shipping_sla_hours}h` : ''}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-slate-400" />
                        {specText || `${(p.skus || []).length} SKU`} = <strong className="text-slate-700">{(p.skus || []).length}</strong> 个变体
                      </span>
                      <span>{p.weight_g}g/件</span>
                      {p.is_bulky ? (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">
                          抛货 体积重{p.volume_weight_g}g
                        </span>
                      ) : (
                        <span className="text-slate-400">体积重 {p.volume_weight_g}g</span>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:block text-right shrink-0 w-36">
                    <div className="text-[10px] text-slate-400 font-medium mb-0.5">供货价区</div>
                    <div className="text-sm font-bold text-indigo-600">{priceSummary(p)}</div>
                  </div>

                  <div className="hidden sm:block text-right shrink-0 w-24">
                    <div className="text-[10px] text-slate-400 font-medium mb-0.5">聚合库存</div>
                    <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                      p.stock_quantity < 100 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {p.stock_quantity} 件
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onQuickDistribute(p)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1"
                    >
                      刊登分发
                    </button>
                    <button
                      onClick={() => onEditProduct(p)}
                      className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title="编辑 SPU 信息"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(p.id, p.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="删除 SPU"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 展开区：素材 + SKU 矩阵 */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-4">
                    {/* 素材库 */}
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-2">
                        <ImageIcon className="w-3.5 h-3.5" />
                        素材库
                        <span className="text-slate-400 font-normal">
                          （{(p.assets || []).length} 张，供应商 CDN 原图，点击放大；上传 TikTok 在刊登链路完成）
                        </span>
                      </div>
                      {(p.assets || []).length === 0 ? (
                        <div className="text-[11px] text-slate-400 py-3 flex items-center gap-1.5">
                          <ImageOff className="w-3.5 h-3.5" /> 暂无素材
                        </div>
                      ) : (
                        <div className="flex gap-2.5 overflow-x-auto pb-1">
                          {(p.assets || []).map(a => (
                            <a
                              key={a.id}
                              href={a.local_url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="group shrink-0 w-20"
                              title={a.sku_code || ''}
                            >
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                {a.local_url ? (
                                  <img src={a.local_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <ImageOff className="w-5 h-5" />
                                  </div>
                                )}
                                <span className="absolute top-1 left-1 text-[9px] px-1 py-0.5 rounded bg-slate-900/70 text-white font-semibold">
                                  {ROLE_LABEL[a.role] || a.role}
                                </span>
                                {a.tts_uri && (
                                  <span className="absolute bottom-1 right-1 text-[9px] px-1 py-0.5 rounded bg-emerald-600/90 text-white font-semibold">
                                    TTS
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono mt-1 truncate">
                                {a.sku_code || '通用'}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SKU 矩阵 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <Boxes className="w-3.5 h-3.5" />
                          SKU 矩阵（点击单元格编辑价/库存/素材）
                        </div>
                        <button
                          onClick={() => openSkuCreate(p, null)}
                          className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> 新增 SKU
                        </button>
                      </div>

                      {matrix ? (
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                              <tr>
                                <th className="p-2.5 text-left font-semibold whitespace-nowrap">
                                  {matrix.rowAttr} ＼ {matrix.colAttr}
                                </th>
                                {matrix.cols.map(c => (
                                  <th key={c} className="p-2.5 text-center font-semibold min-w-[132px]">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {matrix.rows.map(r => (
                                <tr key={r} className="hover:bg-slate-50/60">
                                  <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap bg-slate-50/40">{r}</td>
                                  {matrix.cols.map(c => {
                                    const sku = matrix.map.get(`${r}||${c}`);
                                    if (!sku) {
                                      return (
                                        <td key={c} className="p-1.5 text-center">
                                          <button
                                            onClick={() => openSkuCreate(p, [
                                              { name: matrix.rowAttr, value: r },
                                              { name: matrix.colAttr, value: c }
                                            ])}
                                            className="w-full h-full min-h-[64px] border border-dashed border-slate-200 rounded-lg text-slate-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/40 flex items-center justify-center"
                                            title={`新增 ${r} / ${c}`}
                                          >
                                            <Plus className="w-4 h-4" />
                                          </button>
                                        </td>
                                      );
                                    }
                                    const img = aMap.get(sku.image_asset_id);
                                    const lowStock = sku.stock_quantity < 100;
                                    return (
                                      <td key={c} className="p-1.5">
                                        <button
                                          onClick={() => openSkuEdit(p, sku)}
                                          className="w-full text-left p-2 rounded-lg border border-transparent hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                                        >
                                          <div className="flex items-start gap-2">
                                            {img?.local_url ? (
                                              <img src={img.local_url} alt="" loading="lazy" className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0" />
                                            ) : (
                                              <div className="w-9 h-9 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                                                <ImageOff className="w-3.5 h-3.5" />
                                              </div>
                                            )}
                                            <div className="min-w-0 space-y-0.5">
                                              <div className="font-mono text-[10px] text-slate-400 truncate">
                                                {sku.supplier_sku_code || sku.sku_code}
                                              </div>
                                              <div className="font-bold text-indigo-600 text-[13px]">
                                                ${sku.supply_price ?? '—'} <span className="text-[10px] font-normal text-slate-400">{sku.currency || ''}</span>
                                              </div>
                                              <div className={`text-[11px] font-semibold ${lowStock ? 'text-amber-600' : 'text-slate-600'}`}>
                                                库存 {sku.stock_quantity}
                                              </div>
                                            </div>
                                          </div>
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        /* 无标准两轴规格时的兜底平铺列表 */
                        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                          {(p.skus || []).length === 0 && (
                            <div className="p-6 text-center text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
                              <PackageOpen className="w-4 h-4" /> 暂无 SKU，点击右上角“新增 SKU”
                            </div>
                          )}
                          {(p.skus || []).map(sku => (
                            <button
                              key={sku.id}
                              onClick={() => openSkuEdit(p, sku)}
                              className="w-full flex items-center gap-3 p-2.5 hover:bg-indigo-50/50 text-left"
                            >
                              <span className="font-mono text-[11px] text-slate-600 flex-1 truncate">{sku.sku_code}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{sku.supplier_sku_code || '—'}</span>
                              <span className="text-[12px] font-bold text-indigo-600 w-24 text-right">${sku.supply_price ?? '—'} {sku.currency || ''}</span>
                              <span className="text-[11px] text-slate-600 w-20 text-right">库存 {sku.stock_quantity}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SkuModal
        isOpen={skuModal.open}
        onClose={() => setSkuModal({ open: false, product: null, sku: null, preset: null })}
        product={skuModal.product}
        sku={skuModal.sku}
        presetAttributes={skuModal.preset}
        onSaved={onRefreshProduct}
        onNotify={onNotify}
      />
    </div>
  );
}
