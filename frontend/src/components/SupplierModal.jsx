import React, { useState, useEffect, useRef } from 'react';
import { Building2, X, Plus, Trash2, Package } from 'lucide-react';

export default function SupplierModal({ isOpen, onClose, suppliers, onAddSupplier, onDeleteSupplier, onAddProductForSupplier }) {
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    dialogRef.current?.focus();
    const keydown = e => {
      if (e.key === 'Escape' && !savingRef.current) { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), input, select, textarea, [tabindex="0"]')];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [isOpen]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    contact_phone: '',
    platform_url: '',
    shipping_sla_hours: 24,
    address: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    savingRef.current = true;
    setSubmitting(true);
    try {
      const created = await onAddSupplier({ ...formData, name: formData.name.trim() });
      setFormData({
        name: '',
        contact_name: '',
        contact_phone: '',
        platform_url: '',
        shipping_sla_hours: 24,
        address: '',
        notes: ''
      });
      setShowAddForm(false);
      if (created?.id) onAddProductForSupplier?.(created.id);
    } catch (err) {
      alert(err.message);
    } finally {
      savingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="supplier-dialog-title" tabIndex={-1} className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 id="supplier-dialog-title" className="font-bold text-slate-900 text-sm">选择或新增供应商</h3>
          </div>
          <button aria-label="关闭供应商窗口" disabled={submitting} onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 顶部新增开关 */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">已维护 {suppliers.length} 家供应商，选择一家后录入货源</span>
          <button
            disabled={submitting}
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition"
          >
            {showAddForm ? '收起表单' : '+ 添加新供应商'}
          </button>
        </div>

        {/* 新增表单 */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
            <div className="font-bold text-slate-800">填写新供应商资料</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">供应商名称 *</label>
                <input
                  type="text"
                  aria-label="供应商名称"
                  required
                  placeholder="例如: 杭州尚潮服饰供应链"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">承诺发货 SLA</label>
                <select
                  value={formData.shipping_sla_hours}
                  onChange={(e) => setFormData({ ...formData, shipping_sla_hours: parseInt(e.target.value) || 24 })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                >
                  <option value={24}>24 小时内揽收 (推荐/极速)</option>
                  <option value={48}>48 小时内揽收 (标准)</option>
                  <option value={72}>72 小时内揽收 (临界)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">对接人 / 联系方式</label>
                <input
                  type="text"
                  placeholder="对接人姓名 / 联系电话"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">发货地 / 仓库地址</label>
                <input
                  type="text"
                  placeholder="浙江义乌 / 广东广州"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.name.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
              >
                {submitting ? '保存中...' : '保存并录入货源'}
              </button>
            </div>
          </form>
        )}

        {!suppliers.length && !showAddForm && <p className="py-6 text-center text-xs text-slate-600">还没有供应商，点击“添加新供应商”建立资料，保存后继续录入货源。</p>}
        {/* 供应商列表 */}
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-mono shrink-0">
                    SLA: {s.shipping_sla_hours}h 揽收
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                  <span>对接人: {s.contact_name || '未设'}</span>
                  {s.address && <span>发货地: {s.address}</span>}
                </div>
                {s.notes && (
                  <div className="text-[11px] text-slate-400 mt-0.5">{s.notes}</div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onAddProductForSupplier && (
                  <button
                    disabled={submitting}
                    onClick={() => onAddProductForSupplier(s.id)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-semibold flex items-center gap-1 transition"
                    title={`为「${s.name}」添加商品`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>录入货源 SPU</span>
                  </button>
                )}
                <button
                  disabled={submitting}
                  onClick={() => onDeleteSupplier(s.id, s.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                  title="删除供货商"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
