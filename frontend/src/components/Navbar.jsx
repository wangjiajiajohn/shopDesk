import React, { useState } from 'react';
import { Store, Globe, Plus, Bell, CheckCircle2, LogOut, User } from 'lucide-react';

export default function Navbar({
  markets,
  shops,
  currentShopId,
  onSelectShop,
  onOpenAddShop,
  onNavigateTab,
  authUser,
  onLogout
}) {
  const currentShop = shops.find(s => s.id === currentShopId);
  const [menuOpen, setMenuOpen] = useState(false);
  const userInitial = (authUser?.email || 'U').charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 shrink-0 z-40 px-6 py-3 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-4">
        {/* Logo 与主标题 */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigateTab('home')}>
          <div className="w-9 h-9 bg-gradient-to-tr from-rose-500 via-pink-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-sm">
            SD
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-tight flex items-center gap-2">
              ShopDesk
              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full font-medium">
                TikTok 跨境运营台
              </span>
            </div>
            <div className="text-[11px] text-slate-500">一人操盘多店 · 墨西哥首发站</div>
          </div>
        </div>

        {/* 市场标识 */}
        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200 text-xs">
          <span className="text-slate-400">运营市场:</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md font-medium text-slate-700">
            <span>🇲🇽 墨西哥 (MX)</span>
            <span className="text-[10px] text-slate-400 font-mono">es / MXN</span>
          </div>
        </div>
      </div>

      {/* 动态店铺下拉与控制 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg text-xs">
          <Store className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <span className="text-slate-500 font-medium">店铺过滤:</span>
          <select
            value={currentShopId}
            onChange={(e) => onSelectShop(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2.5 py-1 font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">全部店铺汇总 ({shops.length} 个已激活)</option>
            {shops.map((s, idx) => (
              <option key={s.id} value={s.id}>
                {s.shop_name} ({s.tiktok_shop_id})
              </option>
            ))}
          </select>

          <button
            onClick={onOpenAddShop}
            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-medium transition flex items-center gap-1"
            title="添加新店铺"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>绑定新店</span>
          </button>
        </div>

        {/* 异常提醒：异常收件箱模块接通前不展示数字角标，避免伪造未读数 */}
        <button
          onClick={() => onNavigateTab('inbox')}
          className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          title="异常收件箱（建设中）"
        >
          <Bell className="w-4 h-4 text-slate-600" />
        </button>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* 用户信息与登出 */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-slate-100 transition"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 text-white flex items-center justify-center text-xs font-semibold">
              {userInitial}
            </div>
            <div className="text-xs text-left hidden sm:block max-w-[140px]">
              <div className="font-medium text-slate-800 truncate">{authUser?.email}</div>
              <div className="text-[10px] text-slate-400">
                {authUser?.is_verified ? '已验证' : '未验证邮箱'}
              </div>
            </div>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs font-medium text-slate-700 truncate">{authUser?.email}</div>
                  <div className="text-[10px] text-slate-400">{authUser?.is_superuser ? '管理员' : '普通用户'}</div>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出登录
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
