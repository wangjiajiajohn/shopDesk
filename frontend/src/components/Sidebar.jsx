import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Store,
  Package,
  Globe2,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  Truck,
  Calculator,
  Library,
  Bookmark,
  BookOpen,
  ChevronRight
} from 'lucide-react';

// 知识库二级目录（顺序与 Movae 侧边栏一致）
const KB_CHILDREN = [
  { id: 'kb-methodology', label: '万能心法' },
  { id: 'kb-funnel', label: '经营转化漏斗' },
  { id: 'kb-playbook', label: '跨境电商打法' },
  { id: 'kb-capabilities', label: '平台能力收集' },
  { id: 'kb-enrollment', label: '商家入驻指南' },
  { id: 'kb-channels', label: '货盘渠道总表' },
];

export default function Sidebar({ currentTab, onSelectTab }) {
  const navItems = [
    { id: 'home', label: '工作台首页', icon: LayoutDashboard, badge: null, group: 'CORE' },
    { id: 'shops', label: '市场与店铺管理', icon: Store, badge: '选国绑店', group: 'CORE' },
    { id: 'sourcing', label: '货源商品库', icon: Package, badge: 'SPU/SKU 矩阵', group: 'CORE' },
    { id: 'calculator', label: '定价计算器', icon: Calculator, badge: '保本/利润', badgeColor: 'bg-emerald-100 text-emerald-700', group: 'CORE' },
    { id: 'resources', label: '店铺资料库', icon: Library, badge: '账号/证件', badgeColor: 'bg-amber-100 text-amber-700', group: 'CORE' },
    { id: 'references', label: '参考商品', icon: Bookmark, badge: '选品素材', badgeColor: 'bg-rose-100 text-rose-700', group: 'CORE' },
    { id: 'inbox', label: '异常收件箱', icon: AlertTriangle, badge: null, group: 'OPS' },
    { id: 'ai-media', label: '素材与 AI 生图', icon: Sparkles, badge: 'apimart', badgeColor: 'bg-purple-100 text-purple-700', group: 'OPS' },
    { id: 'listing', label: 'TikTok 店铺商品', icon: ShoppingBag, badge: 'API 同步', badgeColor: 'bg-indigo-100 text-indigo-700', group: 'OPS' },
    { id: 'orders', label: '订单推仓履约', icon: Truck, badge: 'API 同步', badgeColor: 'bg-indigo-100 text-indigo-700', group: 'OPS' },
  ];

  // 知识库父级：当前停留在任一子项时高亮
  const isKbActive = KB_CHILDREN.some((c) => c.id === currentTab);
  const [kbHovered, setKbHovered] = useState(false);
  const [kbPos, setKbPos] = useState({ top: 0, left: 0 });
  const kbBtnRef = useRef(null);
  const closeTimer = useRef(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openKbPopup = () => {
    clearCloseTimer();
    const rect = kbBtnRef.current?.getBoundingClientRect();
    if (rect) {
      // 视口边界保护：浮层预估 280px 高，底部空间不足时上移，始终留 16px 边距
      const POPUP_EST_H = 280;
      const VIEWPORT_MARGIN = 16;
      const maxTop = window.innerHeight - VIEWPORT_MARGIN - POPUP_EST_H;
      const top = Math.max(VIEWPORT_MARGIN, Math.min(rect.top, maxTop));
      setKbPos({ top, left: rect.right + 8 });
    }
    setKbHovered(true);
  };

  const scheduleCloseKb = () => {
    clearCloseTimer();
    // 150ms 桥接间隙：鼠标从按钮移到浮层途中不关闭
    closeTimer.current = setTimeout(() => setKbHovered(false), 150);
  };

  useEffect(() => {
    const closeOnResize = () => setKbHovered(false);
    window.addEventListener('resize', closeOnResize);
    return () => {
      clearCloseTimer();
      window.removeEventListener('resize', closeOnResize);
    };
  }, []);

  const renderNavButton = (item) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSelectTab(item.id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition text-left ${
          isActive
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
          <span>{item.label}</span>
        </div>
        {item.badge && (
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
            isActive ? 'bg-indigo-500 text-white' : (item.badgeColor || 'bg-slate-100 text-slate-500')
          }`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col p-3 select-none shrink-0">
      <nav
        className="space-y-1 text-xs flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]"
        onScroll={() => setKbHovered(false)}
      >
        <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          开店与供给初始化
        </div>

        {navItems.filter(i => i.group === 'CORE').map(renderNavButton)}

        <div className="pt-4 text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          日常运营闭环
        </div>

        {navItems.filter(i => i.group === 'OPS').map(renderNavButton)}

        <div className="pt-4 text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          学习与参考
        </div>

        {renderNavButton({ id: 'api-catalog', label: 'TikTok 接口资料库', icon: BookOpen })}

        {/* 知识库：hover 触发 fixed 浮层（浮层渲染在组件根部，不受 nav 滚动裁剪） */}
        <div
          ref={kbBtnRef}
          onMouseEnter={openKbPopup}
          onMouseLeave={scheduleCloseKb}
        >
          <button
            onClick={() => onSelectTab(KB_CHILDREN[0].id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition text-left ${
              isKbActive ? 'bg-rose-50 text-rose-700' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className={`w-4 h-4 ${isKbActive ? 'text-rose-600' : 'text-slate-500'}`} />
              <span>知识库</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${isKbActive ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                6 专题
              </span>
              <ChevronRight className={`w-3.5 h-3.5 transition-colors ${kbHovered ? 'text-rose-500' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* 底部固定区：运营导航 + 系统状态（不随主导航滚动） */}
      <div className="shrink-0 pt-3 space-y-2 border-t border-slate-100 mt-3">
        <button
          onClick={() => onSelectTab('navigation')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition text-left text-xs ${
            currentTab === 'navigation'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Globe2 className={`w-4 h-4 ${currentTab === 'navigation' ? 'text-white' : 'text-sky-500'}`} />
            <span>运营导航</span>
          </div>
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
            currentTab === 'navigation' ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-700'
          }`}>
            外部入口
          </span>
        </button>

        {/* 底部系统状态 */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-600 font-medium">
            <span>Celery 调度中枢</span>
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              正常运转
            </span>
          </div>
          <div className="text-[11px] text-slate-500 leading-tight">
            按店铺隔离限流 · 自动对账轮询开启
          </div>
        </div>
      </div>

      {/* 知识库二级浮层：fixed 定位，脱离 nav 滚动容器，避免被 overflow 裁剪 */}
      {kbHovered && (
        <div
          className="fixed w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50"
          style={{ top: kbPos.top, left: kbPos.left }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleCloseKb}
        >
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
            知识库 · 6 专题
          </div>
          {KB_CHILDREN.map((child) => {
            const isActive = currentTab === child.id;
            return (
              <button
                key={child.id}
                onClick={() => {
                  onSelectTab(child.id);
                  setKbHovered(false);
                }}
                className={`w-[calc(100%-0.75rem)] mx-1.5 flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition text-left ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-slate-300'}`} />
                <span className="truncate">{child.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
