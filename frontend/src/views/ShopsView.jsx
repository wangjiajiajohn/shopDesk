import React, { useState } from 'react';
import {
  Store,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  Globe2,
  ExternalLink,
  Layers,
  Sparkles,
  KeyRound
} from 'lucide-react';

const STATUS_META = {
  ACTIVE: { label: '授权有效', cls: 'text-emerald-600', dot: 'bg-emerald-500' },
  INVALID: { label: '校验失败', cls: 'text-rose-600', dot: 'bg-rose-500' },
  EXPIRED: { label: 'Token 已过期', cls: 'text-amber-600', dot: 'bg-amber-500' },
  REVOKED: { label: '授权已吊销', cls: 'text-rose-600', dot: 'bg-rose-500' },
  UNAUTHORIZED: { label: '未授权', cls: 'text-slate-400', dot: 'bg-slate-400' },
};

export default function ShopsView({
  markets,
  shops,
  credentialMap,
  onRefreshShops,
  onOpenAddShop,
  onDeleteShop,
  onOpenAuth
}) {
  const currentMarket = markets[0] || {
    country_code: 'MX',
    name: '墨西哥',
    default_language: 'es',
    currency: 'MXN',
    exchange_rate_cny: 2.75,
    platform_commission_rate: 0.08
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* 头部标题与操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>⚙️ 市场与店铺管理</span>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-200">
              动态 N 店架构
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            按国家选择市场并绑定店铺。系统不设店铺数量上限，支持 1个、2个、3个、4个或更多店铺独立管理与联合刊登。
          </p>
        </div>

        <button
          onClick={onOpenAddShop}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>+ 授权绑定新 TikTok 店铺</span>
        </button>
      </div>

      {/* 墨西哥国家市场卡片 */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-200/80 rounded-2xl p-5 text-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🇲🇽</span>
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span>当前主力运营市场: 墨西哥 (Mexico)</span>
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">已就绪</span>
              </div>
              <div className="text-[11px] text-slate-500">国家代码: MX · 旗下已绑定 {shops.length} 个 TikTok 店铺</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Globe2 className="w-3.5 h-3.5" />
            <span>架构支持后续随时扩展美区 US、英区 UK 等站点</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-emerald-100 text-slate-700">
          <div>
            <div className="text-slate-400 text-[11px]">官方前台语言</div>
            <div className="font-bold text-slate-900 mt-0.5">西班牙语 (es-MX)</div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">法定结算币种</div>
            <div className="font-bold text-slate-900 mt-0.5">MXN (墨西哥比索)</div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">参考汇率</div>
            <div className="font-bold text-indigo-600 mt-0.5">1 RMB ≈ {currentMarket.exchange_rate_cny} MXN</div>
          </div>
          <div>
            <div className="text-slate-400 text-[11px]">TikTok 官方佣金率</div>
            <div className="font-bold text-slate-900 mt-0.5">{(currentMarket.platform_commission_rate * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* 已绑定店铺卡片列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span>旗下已授权店铺列表 ({shops.length} 个)</span>
          <span className="text-[11px] text-slate-400 font-normal">多选分发时可自由勾选参与刊登的店铺</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shops.map((shop, idx) => {
            const cred = credentialMap[shop.id];
            const status = STATUS_META[cred?.auth_status] || STATUS_META.UNAUTHORIZED;
            return (
            <div
              key={shop.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-xs transition space-y-3 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                  店 {String.fromCharCode(65 + idx)}
                </span>
                <span className={`text-[11px] font-bold flex items-center gap-1 ${status.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                  {status.label}
                </span>
              </div>

              <div>
                <div className="font-bold text-slate-900 text-sm">{shop.shop_name}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">TK-ID: {shop.tiktok_shop_id}</div>
              </div>

              <div className="text-[11px] text-slate-500 space-y-1 border-t border-slate-100 pt-2.5">
                <div className="flex items-center justify-between">
                  <span>所属国家:</span>
                  <span className="font-medium text-slate-800">🇲🇽 墨西哥 (MX)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>结算币种:</span>
                  <span className="font-mono text-slate-800">MXN</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Token 到期:</span>
                  <span className="font-mono text-slate-800">
                    {cred?.access_token_expire_at
                      ? new Date(cred.access_token_expire_at).toLocaleDateString('zh-CN')
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => onOpenAuth(shop)}
                  className={`font-semibold flex items-center gap-1 ${cred?.auth_status === 'ACTIVE' ? 'text-indigo-600 hover:text-indigo-800' : 'text-amber-600 hover:text-amber-700'}`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {cred?.auth_status === 'ACTIVE' ? '授权管理' : '去授权'}
                </button>
                <button
                  onClick={() => onDeleteShop(shop.id, shop.shop_name)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                  title="解绑店铺"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            );
          })}

          {/* 快速新增卡片引导 */}
          <div 
            onClick={onOpenAddShop}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition min-h-[170px]"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <div className="font-bold text-slate-800 text-xs">绑定更多店铺</div>
            <div className="text-[11px] text-slate-400 mt-0.5">支持 2店 / 3店 / 4店或更多</div>
          </div>
        </div>
      </div>
    </div>
  );
}
