import React, { useState, useEffect } from 'react';
import { Package, X, AlertCircle, Upload, ImagePlus, Trash2, Plus, Minus } from 'lucide-react';
import CategoryCascader from './CategoryCascader';
import SourceInformation from './SourceInformation';
import { uploadResourceFile } from '../api';

const buildDefault = (suppliers) => ({
  supplier_id: '',
  title: '',
  sku_code: `SP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
  category_name: '通用',
  tiktok_category_id: '',
  source_url: '',
  main_image: '',
  images: [],                    // 多张商品图（用于素材加工、三视图）
  colorValues: '',               // 逗号分隔，如 "黑色,肤色"
  sizeValues: '',                // 逗号分隔，如 "M,L,XL"
  composition: '',               // 商品成分，如 "锦纶62%, 氨纶38%"
  size_chart: null,              // {columns:[], rows:[]}
  supply_price: '',              // 一口采购价
  supply_currency: 'CNY',
  _imgUrls: '',                  // 临时：图片URL文本框内容
  weight_g: 0,                   // 0 = 未填写
  package_length_cm: 0,
  package_width_cm: 0,
  package_height_cm: 0,
});

// 从 specs 数组解析出某属性的逗号分隔字符串
const specValuesToStr = (specs, name) => {
  const spec = (specs || []).find(s => s.name === name);
  return (spec?.values || []).join(',');
};

// 把逗号分隔字符串转成数组（兼容中英文逗号、空格）
const strToValues = (s) => s.split(/[,，\s]+/).map(v => v.trim()).filter(Boolean);

export default function ProductModal({ isOpen, onClose, onSubmit, suppliers, initialData, presetSupplierId }) {
  const [formData, setFormData] = useState(buildDefault(suppliers));
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        supplier_id: initialData.supplier_id || '',
        title: initialData.title || '',
        sku_code: initialData.sku_code || '',
        category_name: initialData.category_name || '通用',
        tiktok_category_id: initialData.tiktok_category_id || '',
        source_url: initialData.source_url || '',
        main_image: initialData.main_image || '',
        images: initialData.images || [],
        colorValues: specValuesToStr(initialData.specs, '颜色'),
        sizeValues: specValuesToStr(initialData.specs, '尺码'),
        composition: initialData.composition || '',
        size_chart: initialData.size_chart || null,
        supply_price: initialData.supply_price ?? '',
        supply_currency: initialData.supply_currency || 'CNY',
        weight_g: initialData.weight_g ?? 0,
        package_length_cm: initialData.package_length_cm ?? 0,
        package_width_cm: initialData.package_width_cm ?? 0,
        package_height_cm: initialData.package_height_cm ?? 0,
      });
    } else {
      const def = buildDefault(suppliers);
      // 从供货商卡片"添加商品"进入时，锁定该供货商
      if (presetSupplierId) def.supplier_id = presetSupplierId;
      setFormData(def);
    }
  }, [initialData, suppliers, isOpen, presetSupplierId]);

  if (!isOpen) return null;

  // 体积重测算（仅当尺寸和重量都已填写时）
  const volCm3 = formData.package_length_cm && formData.package_width_cm && formData.package_height_cm
    ? Math.round(formData.package_length_cm * formData.package_width_cm * formData.package_height_cm)
    : 0;
  const volWeightG = Math.round((volCm3 / 6000) * 1000);
  const isBulky = formData.weight_g > 0 && volWeightG > formData.weight_g;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const specs = [];
    const colors = strToValues(formData.colorValues);
    const sizes = strToValues(formData.sizeValues);
    if (colors.length) specs.push({ name: '颜色', values: colors });
    if (sizes.length) specs.push({ name: '尺码', values: sizes });

    const payload = { ...formData, specs };
    delete payload.colorValues;
    delete payload.sizeValues;
    delete payload._imgUrls;
    // 主图取第一张商品图
    payload.main_image = (payload.images && payload.images[0]) || payload.main_image || '';
    // supply_price 空串转 null
    if (payload.supply_price === '' || payload.supply_price === null) payload.supply_price = null;

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

  // 上传商品图片
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImg(true);
    try {
      const uploaded = [];
      for (const f of files) {
        const res = await uploadResourceFile(f, 'product-images');
        if (res?.url) uploaded.push(res.url);
      }
      if (uploaded.length) {
        setFormData(d => ({ ...d, images: [...(d.images || []), ...uploaded] }));
      }
    } catch (err) {
      alert('图片上传失败: ' + (err.message || err));
    } finally {
      setUploadingImg(false);
    }
  };

  const removeImage = (idx) => {
    setFormData(d => ({ ...d, images: (d.images || []).filter((_, i) => i !== idx) }));
  };

  // 尺码表编辑
  const initSizeChart = () => ({ columns: ['尺码', '上胸围', '下胸围'], rows: [['', '', '']] });
  const ensureSizeChart = () => formData.size_chart || initSizeChart();
  const setChartCell = (rowIdx, colIdx, val) => {
    const chart = ensureSizeChart();
    const rows = chart.rows.map((r, ri) => ri === rowIdx ? r.map((c, ci) => ci === colIdx ? val : c) : r);
    setFormData(d => ({ ...d, size_chart: { ...chart, rows } }));
  };
  const addChartRow = () => {
    const chart = ensureSizeChart();
    setFormData(d => ({ ...d, size_chart: { ...chart, rows: [...chart.rows, new Array(chart.columns.length).fill('')] } }));
  };
  const removeChartRow = (idx) => {
    const chart = ensureSizeChart();
    setFormData(d => ({ ...d, size_chart: { ...chart, rows: chart.rows.filter((_, i) => i !== idx) } }));
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
              {initialData ? '编辑货源 SPU' : '录入新货源 SPU'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <SourceInformation product={initialData} />

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">商品中文标题</label>
              <input
                type="text"
                required
                placeholder="例如: 针织连体衣"
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
                required={!initialData}
                disabled={!initialData && !!presetSupplierId}
                aria-label="关联供应商"
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className={`${inputCls} bg-white`}
              >
                <option value="">请选择供应商</option>
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
                颜色
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">逗号分隔</span>
              </label>
              <input
                type="text"
                placeholder="兰,咖,黑,灰绿"
                value={formData.colorValues}
                onChange={(e) => setFormData({ ...formData, colorValues: e.target.value })}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                尺码
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">逗号分隔</span>
              </label>
              <input
                type="text"
                placeholder="S,M,L,XL,2XL,3XL"
                value={formData.sizeValues}
                onChange={(e) => setFormData({ ...formData, sizeValues: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">
                商品图片
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">上传多张，第一张为主图，用于素材加工/三视图</span>
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-3">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="prod-imgs"
                />
                <label htmlFor="prod-imgs" className="flex items-center justify-center gap-1.5 text-indigo-600 hover:text-indigo-700 cursor-pointer py-2 text-xs font-medium">
                  <ImagePlus className="w-4 h-4" />
                  {uploadingImg ? '上传中…' : '点击上传图片'}
                </label>
                {formData.images?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                        <img src={img} className="w-full h-full object-cover" alt="" />
                        {idx === 0 && <span className="absolute top-0 left-0 bg-indigo-600 text-white text-[9px] px-1 rounded-br">主图</span>}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-0 right-0 bg-rose-500 text-white w-4 h-4 rounded-bl hidden group-hover:flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="或粘贴图片 URL（换行分隔多张）"
                  value={formData._imgUrls || ''}
                  onChange={(e) => {
                    const urls = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                    setFormData(d => ({ ...d, _imgUrls: e.target.value, images: urls }));
                  }}
                  className="mt-2 w-full px-2 py-1 text-[11px] border border-slate-200 rounded font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">采购价</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="如 45"
                  value={formData.supply_price ?? ''}
                  onChange={(e) => setFormData({ ...formData, supply_price: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                  className={`${inputCls} flex-1`}
                />
                <select
                  value={formData.supply_currency}
                  onChange={(e) => setFormData({ ...formData, supply_currency: e.target.value })}
                  className={`${inputCls} bg-white w-20`}
                >
                  <option value="CNY">¥</option>
                  <option value="MXN">$</option>
                  <option value="USD">$</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">商品成分</label>
              <input
                type="text"
                placeholder="如 锦纶62%, 氨纶38%"
                value={formData.composition || ''}
                onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">
                尺码表
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">记录各尺码的详细尺寸数据</span>
              </label>
              {formData.size_chart ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50">
                      <tr>
                        {formData.size_chart.columns.map((col, ci) => (
                          <th key={ci} className="px-2 py-1 text-left text-slate-600 font-medium border-b border-slate-200">{col}</th>
                        ))}
                        <th className="w-8 border-b border-slate-200"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.size_chart.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border-b border-slate-100 p-0">
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) => setChartCell(ri, ci, e.target.value)}
                                className="w-full px-2 py-1 bg-transparent focus:bg-indigo-50 outline-none"
                              />
                            </td>
                          ))}
                          <td className="text-center">
                            <button type="button" onClick={() => removeChartRow(ri)} className="text-slate-300 hover:text-rose-500">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={addChartRow}
                    className="w-full py-1.5 text-indigo-600 hover:bg-indigo-50 text-[11px] flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> 增加一行
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFormData(d => ({ ...d, size_chart: initSizeChart() }))}
                  className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-300 text-xs"
                >
                  + 添加尺码表
                </button>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">采购原链接</label>
              <input
                type="text"
                placeholder="1688 / 供应商商品页链接"
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                className={inputCls}
              />
            </div>
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
