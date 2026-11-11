import React, { useState, useEffect } from 'react';
import { Package, X, AlertCircle, Boxes } from 'lucide-react';
import CategoryCascader from './CategoryCascader';

const buildDefault = (suppliers) => ({
  supplier_id: suppliers.length > 0 ? suppliers[0].id : '',
  title: '',
  sku_code: `SP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
  category_name: '通用',
  tiktok_category_id: '',
  source_url: '',
  main_image: '',
  pricingMode: 'sku',            // sku = 变体一口价；tier = SPU 三档阶梯价(RMB)
  price_tier_1: null,
  price_tier_2: null,
  price_tier_3: null,
  supply_currency: 'MXN',
  weight_g: 200,
  package_length_cm: 20.0,
  package_width_cm: 15.0,
  package_height_cm: 3.0,
  stock_quantity: 0
});

export default function ProductModal({ isOpen, onClose, onSubmit, suppliers, initialData }) {
  const [formData, setFormData] = useState(buildDefault(suppliers));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      const hasTiers = initialData.price_tier_1 != null;
      setFormData({
        supplier_id: initialData.supplier_id || '',
        title: initialData.title || '',
        sku_code: initialData.sku_code || '',
        category_name: initialData.category_name || '通用',
        tiktok_category_id: initialData.tiktok_category_id || '',
        source_url: initialData.source_url || '',
        main_image: initialData.main_image || '',
        pricingMode: hasTiers ? 'tier' : 'sku',
        price_tier_1: initialData.price_tier_1 ?? null,
        price_tier_2: initialData.price_tier_2 ?? null,
        price_tier_3: initialData.price_tier_3 ?? null,
        supply_currency: initialData.supply_currency || 'MXN',
        weight_g: initialData.weight_g ?? 200,
        package_length_cm: initialData.package_length_cm ?? 20.0,
        package_width_cm: initialData.package_width_cm ?? 15.0,
        package_height_cm: initialData.package_height_cm ?? 3.0,
        stock_quantity: initialData.stock_quantity ?? 0
      });
    } else {
      setFormData(buildDefault(suppliers));
    }
  }, [initialData, suppliers, isOpen]);

  if (!isOpen) return null;

  const hasSkuVariants = !!(initialData?.skus && initialData.skus.length > 0);

  // 动态测算体积重
  const volCm3 = Math.round(formData.package_length_cm * formData.package_width_cm * formData.package_height_cm);
  const volWeightG = Math.round((volCm3 / 6000) * 1000);
  const isBulky = volWeightG > formData.weight_g;

  // 阶梯折扣率
  const p1 = Number(formData.price_tier_1) || 0;
  const p2 = Number(formData.price_tier_2) || 0;
  const p3 = Number(formData.price_tier_3) || 0;
  const discount2 = p1 > 0 ? Math.round(((p1 - p2) / p1) * 100) : 0;
  const discount3 = p1 > 0 ? Math.round(((p1 - p3) / p1) * 100) : 0;

  const numOrNull = (v) => (v === '' || v === null ? null : Number(v));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (formData.pricingMode === 'sku') {
      payload.price_tier_1 = null;
      payload.price_tier_2 = null;
      payload.price_tier_3 = null;
    } else {
      if (p1 <= 0 || p2 <= 0 || p3 <= 0) {
        alert('阶梯价模式下三档价格都必须填写，或切换为「SKU 一口价」模式');
        return;
      }
      if (p1 < p2 || p2 < p3) {
        alert('阶梯价格逻辑错误：1件价 必须 ≥ 2件价 必须 ≥ 3件价！');
        return;
      }
    }
    delete payload.pricingMode;
    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {initialData ? '编辑货源 SPU 信息' : '录入新货源 SPU'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">商品中文标题</label>
              <input
                type="text"
                required
                placeholder="例如: 针织连体衣（款族 SPU，颜色尺码在 SKU 矩阵维护）"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">SPU 货号</label>
              <input
                type="text"
                required
                value={formData.sku_code}
                onChange={(e) => setFormData({ ...formData, sku_code: e.target.value })}
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">关联供货商</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className={`${inputCls} bg-white`}
              >
                <option value="">未关联</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.shipping_sla_hours}h发货)</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">
                TikTok 官方类目
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">选到末级叶子，刊登前还会实时校验</span>
              </label>
              <CategoryCascader
                value={formData.tiktok_category_id}
                fallbackName={formData.category_name}
                onChange={(id, name) => setFormData({
                  ...formData,
                  tiktok_category_id: id,
                  category_name: id ? name : '通用',
                })}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                现货可用库存
                {hasSkuVariants && (
                  <span className="ml-1.5 text-[10px] font-normal text-amber-600">已由 SKU 库存自动聚合，只读</span>
                )}
              </label>
              <input
                type="number"
                disabled={hasSkuVariants}
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                className={`${inputCls} ${hasSkuVariants ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">供货币种</label>
              <input
                type="text"
                value={formData.supply_currency || ''}
                onChange={(e) => setFormData({ ...formData, supply_currency: e.target.value.toUpperCase() })}
                className={`${inputCls} font-mono`}
                maxLength={5}
                placeholder="MXN / CNY"
              />
            </div>
          </div>

          {/* 定价模式切换 */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, pricingMode: 'sku' })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  formData.pricingMode === 'sku'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                SKU 一口价模式
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, pricingMode: 'tier' })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                  formData.pricingMode === 'tier'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}
              >
                SPU 三档阶梯价 (RMB)
              </button>
            </div>

            {formData.pricingMode === 'sku' ? (
              <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <Boxes className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  当前为一口价模式：SPU 不维护价格，每个颜色/尺码 SKU 的供货价（{formData.supply_currency || 'MXN'}）在
                  <strong className="text-slate-800"> 货源库 SKU 矩阵 </strong>
                  中单独维护。供应商 OMS 导入的商品默认使用此模式。
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">1件单价 (基础成本)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">¥</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_tier_1 ?? ''}
                        onChange={(e) => setFormData({ ...formData, price_tier_1: numOrNull(e.target.value) })}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      2件单价 {discount2 > 0 && <span className="text-indigo-600 font-bold">(-{discount2}%)</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">¥</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_tier_2 ?? ''}
                        onChange={(e) => setFormData({ ...formData, price_tier_2: numOrNull(e.target.value) })}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg font-bold text-indigo-700 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      3件单价 {discount3 > 0 && <span className="text-emerald-600 font-bold">(-{discount3}%)</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-slate-400">¥</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_tier_3 ?? ''}
                        onChange={(e) => setFormData({ ...formData, price_tier_3: numOrNull(e.target.value) })}
                        className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg font-bold text-emerald-700 bg-white"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">三档必须同填且满足 1件价 ≥ 2件价 ≥ 3件价，用于 1688 类 RMB 阶梯成本场景。</p>
              </div>
            )}
          </div>

          {/* 物理属性与体积重测算 */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">📐 包装尺寸与实重 (国际运费测算基准)</span>
              {isBulky ? (
                <span className="text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  抛货预警：体积重 ({volWeightG}g) &gt; 实重 ({formData.weight_g}g)
                </span>
              ) : (
                <span className="text-emerald-600 font-medium text-[11px]">
                  ✓ 实重大于体积重，按实重计费
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 font-medium mb-1">实重 (g/克)</label>
                <input
                  type="number"
                  required
                  value={formData.weight_g}
                  onChange={(e) => setFormData({ ...formData, weight_g: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">长 (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.package_length_cm}
                  onChange={(e) => setFormData({ ...formData, package_length_cm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">宽 (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.package_width_cm}
                  onChange={(e) => setFormData({ ...formData, package_width_cm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">高 (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.package_height_cm}
                  onChange={(e) => setFormData({ ...formData, package_height_cm: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
              {submitting ? '保存中...' : '保存 SPU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
