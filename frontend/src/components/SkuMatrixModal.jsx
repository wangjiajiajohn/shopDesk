import React, { useState } from 'react';
import { X, Plus, Boxes, PackageOpen } from 'lucide-react';
import SkuModal from './SkuModal';

// 尺码自然排序：S < M < L < XL < 2XL < 3XL；罩杯 A < B < C < D
const SIZE_RANK = { S: 1, M: 2, L: 3, XL: 4, '2XL': 5, '3XL': 6, '4XL': 7, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
function sizeRank(v) {
  if (SIZE_RANK[v] != null) return SIZE_RANK[v];
  const m = /^(\d+)(X+L)$/i.exec(v);
  if (m) return 10 + Number(m[1]) * 10 + m[2].length;
  return 100;
}

const attrValue = (sku, name) => (sku.attributes || []).find(a => a.name === name)?.value ?? '';

// 颜色×尺码矩阵弹窗：从货源列表抽出，按需打开，列表本身只展示 SPU 摘要
export default function SkuMatrixModal({ isOpen, onClose, product, onSaved, onNotify }) {
  const [skuModal, setSkuModal] = useState({ open: false, sku: null, preset: null });

  if (!isOpen || !product) return null;

  const specs = product.specs || [];
  const hasMatrix = specs.length >= 2;
  const rowAttr = hasMatrix ? specs[0].name : '';
  const colAttr = hasMatrix ? specs[1].name : '';
  const rows = hasMatrix ? specs[0].values || [] : [];
  const cols = hasMatrix
    ? [...(specs[1].values || [])].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b))
    : [];
  const map = new Map();
  for (const sku of product.skus || []) {
    const r = attrValue(sku, rowAttr);
    const c = attrValue(sku, colAttr);
    if (r && c) map.set(`${r}||${c}`, sku);
  }
  const aMap = new Map((product.assets || []).map(a => [a.id, a]));

  const openCreate = (preset) => setSkuModal({ open: true, sku: null, preset });
  const openEdit = (sku) => setSkuModal({ open: true, sku, preset: null });
  const closeSku = () => setSkuModal({ open: false, sku: null, preset: null });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-indigo-600" />
              {product.title}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{product.sku_code} · SKU 价/库存/素材维护</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-slate-600">SKU 矩阵（点击单元格编辑价/库存/素材）</div>
            <button
              onClick={() => openCreate(null)}
              className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg text-[11px] font-semibold flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 新增 SKU
            </button>
          </div>

          {hasMatrix ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                  <tr>
                    <th className="p-2.5 text-left font-semibold whitespace-nowrap">
                      {rowAttr} ＼ {colAttr}
                    </th>
                    {cols.map(c => (
                      <th key={c} className="p-2.5 text-center font-semibold min-w-[132px]">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(r => {
                    // 同一行（颜色）只展示一张代表图：取该行第一个有图的 SKU
                    const rowSkus = cols.map(c => map.get(`${r}||${c}`)).filter(Boolean);
                    const rowImgAssetId = rowSkus.find(s => s.image_asset_id)?.image_asset_id;
                    const rowImg = aMap.get(rowImgAssetId);
                    return (
                      <tr key={r} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap bg-slate-50/40">
                          <div className="flex items-center gap-2">
                            {rowImg?.local_url ? (
                              <img src={rowImg.local_url} alt="" loading="lazy" className="w-9 h-9 object-cover rounded border border-slate-200 shrink-0" />
                            ) : null}
                            <span>{r}</span>
                          </div>
                        </td>
                        {cols.map(c => {
                          const sku = map.get(`${r}||${c}`);
                          if (!sku) {
                            return (
                              <td key={c} className="p-1.5 text-center">
                                <button
                                  onClick={() => openCreate([
                                    { name: rowAttr, value: r },
                                    { name: colAttr, value: c }
                                  ])}
                                  className="w-full h-full min-h-[64px] border border-dashed border-slate-200 rounded-lg text-slate-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/40 flex items-center justify-center"
                                  title={`新增 ${r} / ${c}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </td>
                            );
                          }
                          const lowStock = sku.stock_quantity < 100;
                          return (
                            <td key={c} className="p-1.5">
                              <button
                                onClick={() => openEdit(sku)}
                                className="w-full text-left p-2 rounded-lg border border-transparent hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                              >
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
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {(product.skus || []).length === 0 && (
                <div className="p-6 text-center text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
                  <PackageOpen className="w-4 h-4" /> 暂无 SKU，点击右上角“新增 SKU”
                </div>
              )}
              {(product.skus || []).map(sku => (
                <button
                  key={sku.id}
                  onClick={() => openEdit(sku)}
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

      <SkuModal
        isOpen={skuModal.open}
        onClose={closeSku}
        product={product}
        sku={skuModal.sku}
        presetAttributes={skuModal.preset}
        onSaved={onSaved}
        onNotify={onNotify}
      />
    </div>
  );
}
