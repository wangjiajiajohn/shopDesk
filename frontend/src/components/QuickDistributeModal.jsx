import React, { useState } from 'react';
import { ShoppingBag, X, Sparkles, Store, Check, ImageOff } from 'lucide-react';

export default function QuickDistributeModal({ isOpen, onClose, product, shops, onNotify }) {
  const [selectedShopIds, setSelectedShopIds] = useState(shops.map(s => s.id));

  if (!isOpen || !product) return null;

  const toggleShop = (id) => {
    if (selectedShopIds.includes(id)) {
      if (selectedShopIds.length === 1) {
        alert('至少需勾选 1 个目标店铺！');
        return;
      }
      setSelectedShopIds(selectedShopIds.filter(s => s !== id));
    } else {
      setSelectedShopIds([...selectedShopIds, id]);
    }
  };

  // 定价估算 (墨西哥比索)：基于真实货源成本，生图派发接口接通前仅作试算参考
  // RMB 阶梯价：成本 * 2.75 汇率 + 头程 45 MXN；MXN 一口价：直接取 SKU 最低供货价
  // 统一再叠加佣金 8% + 目标毛利 35%
  const hasTier = product.price_tier_1 != null;
  const skuPrices = (product.skus || []).map(s => s.supply_price).filter(v => v != null);
  const minSkuPrice = skuPrices.length ? Math.min(...skuPrices) : null;
  const supplyCurrency = product.supply_currency
    || (product.skus || []).find(s => s.currency)?.currency
    || 'MXN';
  const costMxn = hasTier ? product.price_tier_1 * 2.75 + 45 : (minSkuPrice ?? 0);
  const estMxnPrice = Math.round(costMxn / (1 - 0.08 - 0.35));
  const estBundle2Price = hasTier
    ? Math.round(((product.price_tier_2 ?? 0) * 2 * 2.75 + 60) / (1 - 0.08 - 0.35))
    : null;
  const costText = hasTier
    ? `1件成本: ¥${product.price_tier_1} (RMB)`
    : `SKU 一口价: $${minSkuPrice ?? '—'} ${supplyCurrency}`;

  // apimart 真实接口尚未接通：诚实告知，不模拟派发、不伪造成功
  const handleStart = () => {
    onNotify('apimart 生图分发接口开发中，当前不会真正派发任务或创建草稿', 'ℹ');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">一键多店铺刊登分发</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* 当前选定货源商品 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
            {product.main_image ? (
              <img
                src={product.main_image}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-slate-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-300">
                <ImageOff className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <div className="font-bold text-slate-900 line-clamp-1">{product.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                货号: {product.sku_code} · {costText}
              </div>
              <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                建议墨西哥售价: ${estMxnPrice} MXN
                {estBundle2Price != null && ` (2件装 Bundle: ${estBundle2Price} MXN)`}
              </div>
            </div>
          </div>

          {/* 勾选目标分发店铺 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-700 font-semibold">
                勾选目标分发店铺 (勾选几个就自动向 apimart 派发几套生图)
              </label>
              <span className="text-indigo-600 font-bold">已选 {selectedShopIds.length} 个店铺</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shops.map(shop => {
                const checked = selectedShopIds.includes(shop.id);
                return (
                  <div
                    key={shop.id}
                    onClick={() => toggleShop(shop.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      checked 
                        ? 'bg-indigo-50/60 border-indigo-400 text-indigo-950 font-semibold' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Store className={`w-4 h-4 ${checked ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div>
                        <div>{shop.shop_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{shop.tiktok_shop_id}</div>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded flex items-center justify-center ${
                      checked ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                    }`}>
                      {checked && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* apimart AI 生图与质检说明（规划能力，接口尚未接通） */}
          <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 text-purple-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-purple-900">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>apimart 自动化换景换人流水线（开发中）</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              接口接通后，将按选中的 <strong>{selectedShopIds.length} 个店铺</strong>分别生成 {selectedShopIds.length} 套独立的拉美本地化视觉图包（不同墨西哥背景、不同拉美模特），每套图片经 <strong>≤3 次质检校验</strong>，防多店重复铺货。当前仅支持店铺勾选与售价试算，不会产生真实派发。
            </p>
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
            type="button"
            onClick={handleStart}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <span>启动生图并一键分发 ({selectedShopIds.length}店)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
