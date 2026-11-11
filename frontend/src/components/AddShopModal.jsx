import React, { useState } from 'react';
import { Store, X, ShieldAlert } from 'lucide-react';

export default function AddShopModal({ isOpen, onClose, onSubmit, markets }) {
  const [formData, setFormData] = useState({
    market_code: 'MX',
    shop_name: '',
    tiktok_shop_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shop_name || !formData.tiktok_shop_id) {
      alert('请完整填写店铺名称和 TikTok Shop ID');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">授权绑定新 TikTok 店铺</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">选择目标运营国家市场</label>
            <select
              value={formData.market_code}
              onChange={(e) => setFormData({ ...formData, market_code: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-medium"
            >
              <option value="MX">🇲🇽 墨西哥 (MX) - 西班牙语 / MXN 比索</option>
              <option value="US" disabled>🇺🇸 美国 (US) - 英语 / USD (未来可扩展)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">店铺内部标识名称</label>
            <input
              type="text"
              required
              placeholder="例如: Tienda Juvenil MX (店D)"
              value={formData.shop_name}
              onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">TikTok Shop ID (平台店铺识别码)</label>
            <input
              type="text"
              required
              placeholder="例如: 749201938105"
              value={formData.tiktok_shop_id}
              onChange={(e) => setFormData({ ...formData, tiktok_shop_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1">
            <div className="font-bold text-indigo-900 flex items-center gap-1.5">
              <span>🔗 两步完成真实授权</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              1. 先保存店铺基础信息；2. 在店铺卡片点击「去授权」，录入 TikTok Partner 的 token，系统将调用官方接口真实验证。未授权的店铺不会参与刊登与 API 操作。
            </p>
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
              {submitting ? '绑定中...' : '确认授权并绑定'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
