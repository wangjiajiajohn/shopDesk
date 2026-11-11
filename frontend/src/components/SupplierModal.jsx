import React, { useState } from 'react';
import { Building2, X, Plus, Trash2, Clock, MapPin, Phone } from 'lucide-react';

export default function SupplierModal({ isOpen, onClose, suppliers, onAddSupplier, onDeleteSupplier }) {
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
    if (!formData.name) return;
    setSubmitting(true);
    try {
      await onAddSupplier(formData);
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
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">供货商管理 (Sourcing Suppliers)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 顶部新增开关 */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">已维护 {suppliers.length} 家供货商，支持维护发货时效 SLA</span>
          <button
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
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg"
              >
                {submitting ? '保存中...' : '确认添加'}
              </button>
            </div>
          </form>
        )}

        {/* 供应商列表 */}
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span>{s.name}</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-mono">
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

              <button
                onClick={() => onDeleteSupplier(s.id, s.name)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                title="删除供货商"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
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
