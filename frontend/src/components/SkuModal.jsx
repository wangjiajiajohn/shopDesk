import React, { useState, useEffect } from 'react';
import { Boxes, X, Trash2, ImageOff, Plus } from 'lucide-react';
import * as api from '../api';

const EMPTY_FORM = {
  sku_code: '',
  attributes: [{ name: '颜色', value: '' }, { name: '尺码', value: '' }],
  supplier_sku_code: '',
  supply_price: '',
  currency: 'MXN',
  stock_quantity: 0,
  sort_order: 0,
  image_asset_id: ''
};

export default function SkuModal({ isOpen, onClose, product, sku, presetAttributes, onSaved, onNotify }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!sku;

  useEffect(() => {
    if (!isOpen || !product) return;
    if (sku) {
      setFormData({
        sku_code: sku.sku_code || '',
        attributes: (sku.attributes && sku.attributes.length
          ? sku.attributes.map(a => ({ name: a.name || '', value: a.value || '' }))
          : [{ name: '颜色', value: '' }, { name: '尺码', value: '' }]),
        supplier_sku_code: sku.supplier_sku_code || '',
        supply_price: sku.supply_price ?? '',
        currency: sku.currency || product.supply_currency || 'MXN',
        stock_quantity: sku.stock_quantity ?? 0,
        sort_order: sku.sort_order ?? 0,
        image_asset_id: sku.image_asset_id || ''
      });
    } else {
      const nextSort = (product.skus || []).length;
      setFormData({
        ...EMPTY_FORM,
        currency: product.supply_currency || 'MXN',
        attributes: presetAttributes && presetAttributes.length
          ? presetAttributes.map(a => ({ ...a }))
          : [{ name: '颜色', value: '' }, { name: '尺码', value: '' }],
        sort_order: nextSort
      });
    }
  }, [isOpen, sku, product, presetAttributes]);

  if (!isOpen || !product) return null;

  const assets = product.assets || [];
  const linkedAsset = assets.find(a => a.id === formData.image_asset_id);

  const setAttr = (idx, key, val) => {
    const next = formData.attributes.map((a, i) => (i === idx ? { ...a, [key]: val } : a));
    setFormData({ ...formData, attributes: next });
  };

  const addAttrRow = () => setFormData({
    ...formData,
    attributes: [...formData.attributes, { name: '', value: '' }]
  });

  const removeAttrRow = (idx) => setFormData({
    ...formData,
    attributes: formData.attributes.filter((_, i) => i !== idx)
  });

  const buildPayload = () => ({
    attributes: formData.attributes.filter(a => a.name && a.value),
    supplier_sku_code: formData.supplier_sku_code || null,
    supply_price: formData.supply_price === '' ? null : Number(formData.supply_price),
    currency: formData.currency || null,
    stock_quantity: Number(formData.stock_quantity) || 0,
    sort_order: Number(formData.sort_order) || 0,
    image_asset_id: formData.image_asset_id || null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !formData.sku_code.trim()) {
      alert('SKU 编码必填（全局唯一，兼作 TikTok seller_sku）');
      return;
    }
    if (formData.attributes.filter(a => a.name && a.value).length === 0) {
      alert('至少保留一组完整的规格属性（如 颜色=黑）');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.updateProductSku(product.id, sku.id, buildPayload());
        onNotify?.(`已更新变体 ${sku.sku_code}`);
      } else {
        await api.createProductSku(product.id, { sku_code: formData.sku_code.trim(), ...buildPayload() });
        onNotify?.(`已新增变体 ${formData.sku_code.trim()}`);
      }
      await onSaved?.(product.id);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除变体 "${sku.sku_code}" 吗？SPU 总库存将自动重算。`)) return;
    setSubmitting(true);
    try {
      await api.deleteProductSku(product.id, sku.id);
      onNotify?.(`已删除变体 ${sku.sku_code}`, '🗑');
      await onSaved?.(product.id);
      onClose();
    } catch (err) {
      alert(err.message);
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {isEdit ? '编辑 SKU 变体' : '新增 SKU 变体'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                SPU：{product.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* SKU 编码 */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              SKU 编码 <span className="text-[10px] font-normal text-slate-400">全局唯一，刊登时作为 TikTok seller_sku</span>
            </label>
            <input
              type="text"
              required={!isEdit}
              disabled={isEdit}
              value={formData.sku_code}
              onChange={(e) => setFormData({ ...formData, sku_code: e.target.value })}
              className={`${inputCls} font-mono ${isEdit ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
            />
          </div>

          {/* 规格属性 */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-semibold">销售属性（颜色 / 尺码等）</label>
            {formData.attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="属性名，如 颜色"
                  value={attr.name}
                  onChange={(e) => setAttr(idx, 'name', e.target.value)}
                  className={`${inputCls} flex-1`}
                />
                <span className="text-slate-300">=</span>
                <input
                  type="text"
                  placeholder="属性值，如 黑"
                  value={attr.value}
                  onChange={(e) => setAttr(idx, 'value', e.target.value)}
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeAttrRow(idx)}
                  className="text-slate-300 hover:text-rose-600 px-1"
                  title="删除该属性"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addAttrRow}
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 添加属性行
            </button>
          </div>

          {/* 供应商编码与图片素材 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">供应商商品编码</label>
              <input
                type="text"
                value={formData.supplier_sku_code}
                onChange={(e) => setFormData({ ...formData, supplier_sku_code: e.target.value })}
                className={`${inputCls} font-mono`}
                placeholder="如 P5L00019"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">关联素材图片</label>
              <select
                value={formData.image_asset_id}
                onChange={(e) => setFormData({ ...formData, image_asset_id: e.target.value })}
                className={`${inputCls}`}
              >
                <option value="">未关联</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.role} · {a.sku_code || '通用图'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {linkedAsset && (
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              {linkedAsset.local_url ? (
                <img src={linkedAsset.local_url} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-300">
                  <ImageOff className="w-5 h-5" />
                </div>
              )}
              <div className="text-[11px] text-slate-500 space-y-0.5 min-w-0">
                <div className="font-semibold text-slate-700">{linkedAsset.sku_code || '通用素材'}</div>
                <div>角色：{linkedAsset.role} · 来源：{linkedAsset.source_type}</div>
                {linkedAsset.tts_uri ? (
                  <div className="text-emerald-600 font-medium">已上传 TikTok：{linkedAsset.tts_uri}</div>
                ) : (
                  <div className="text-amber-600">尚未上传 TikTok 素材库</div>
                )}
              </div>
            </div>
          )}

          {/* 价格与库存 */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 mb-2.5">供货价与库存</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">供货一口价</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.supply_price}
                  onChange={(e) => setFormData({ ...formData, supply_price: e.target.value })}
                  className={inputCls}
                  placeholder="留空回退 SPU 价"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">币种</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  className={`${inputCls} font-mono`}
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">可用库存</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <div>
              {isEdit ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 删除变体
                </button>
              ) : <span />}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {submitting ? '保存中...' : '保存变体'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
