import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Store,
  Package,
  Globe2,
  ShoppingBag,
  Truck,
  Calculator,
  Library,
  BookOpen,
  Images,
  Video,
  Workflow,
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
    { id: 'sourcing', label: '货源商品库', icon: Package, badge: 'SPU/SKU 矩阵', group: 'CORE' },
    { id: 'product-creation-queue', label: '商品创建队列', icon: ShoppingBag, badge: null, group: 'PRODUCTION' },
    { id: 'product-materials', label: '商品图片素材库', icon: Images, badge: null, group: 'PRODUCTION' },
    { id: 'product-video-materials', label: '商品视频素材库', icon: Video, badge: null, group: 'PRODUCTION' },
    { id: 'product-functions', label: '商品功能词库', icon: BookOpen, badge: null, group: 'PRODUCTION' },
    { id: 'skills', label: 'Skill 列表', icon: Workflow, badge: null, group: 'SHARED' },
    { id: 'calculator', label: '定价计算器', icon: Calculator, badge: '保本/利润', badgeColor: 'bg-emerald-100 text-emerald-700', group: 'CORE' },
    { id: 'resources', label: '店铺资料库', icon: Library, badge: '账号/证件', badgeColor: 'bg-amber-100 text-amber-700', group: 'CORE' },
    { id: 'listing', label: 'TikTok 店铺商品', icon: ShoppingBag, badge: 'API 同步', badgeColor: 'bg-indigo-100 text-indigo-700', group: 'OPS' },
    { id: 'orders', label: '订单推仓履约', icon: Truck, badge: 'API 同步', badgeColor: 'bg-indigo-100 text-indigo-700', group: 'OPS' },
  ];

  // 知识库父级：当前停留在任一子项时高亮
  const isKbActive = KB_CHILDREN.some((c) => c.id === currentTab);
  const [kbExpanded, setKbExpanded] = useState(isKbActive);
  useEffect(() => {
    if (KB_CHILDREN.some(c => c.id === currentTab)) setKbExpanded(true);
  }, [currentTab]);

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
      >
        <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          开店与供给初始化
        </div>

        {navItems.filter(i => i.group === 'CORE').map(renderNavButton)}

        <div className="pt-4 text-[11px] font-semibold text-slate-400 px-3 py-1">生产与素材</div>
        {navItems.filter(i => i.group === 'PRODUCTION').map(renderNavButton)}

        <div className="pt-4 text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          日常运营闭环
        </div>

        {navItems.filter(i => i.group === 'OPS').map(renderNavButton)}

        <div className="pt-4 text-[11px] font-semibold text-slate-400 px-3 py-1">共享资源</div>
        {navItems.filter(i => i.group === 'SHARED').map(renderNavButton)}

        <div className="pt-4 text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
          学习与参考
        </div>

        {renderNavButton({ id: 'api-catalog', label: 'TikTok 接口资料库', icon: BookOpen })}

        <div>
          <button type="button" aria-expanded={kbExpanded} aria-controls="knowledge-subnav" onClick={()=>setKbExpanded(value=>!value)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${isKbActive ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-100'}`}>
            <span className="flex items-center gap-2.5"><BookOpen aria-hidden="true" className="w-4 h-4"/><span>知识库</span></span>
            <span className="flex items-center gap-2"><span className="text-xs text-slate-600">6 专题</span><ChevronRight aria-hidden="true" className={`w-3.5 h-3.5 ${kbExpanded ? 'rotate-90' : ''}`}/></span>
          </button>
          <ul id="knowledge-subnav" hidden={!kbExpanded} className="ml-5 mt-1 space-y-1 border-l border-slate-200 pl-2">
            {KB_CHILDREN.map(child=><li key={child.id}><button type="button" aria-current={currentTab===child.id ? 'page' : undefined} onClick={()=>onSelectTab(child.id)} className={`w-full px-3 py-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${currentTab===child.id ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}>{child.label}</button></li>)}
          </ul>
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


    </aside>
  );
}
