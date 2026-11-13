import React, { useEffect, useState } from 'react';

const tasks = [
  ['read', '接通队列取数', '读取完整货源资料并续接已有任务。'],
  ['price', '接通现有定价模型', '保存实际参数、每个 SKU 的成本和售价。'],
  ['save', '接通结果保存', '保留生成版本与原始资料。'],
  ['results', '展示执行结果', '显示待核对项和失败原因，支持修改、保存和重试。'],
  ['verify', '跑通一款商品', '验证 SKU 不重复分配、刷新后结果保留、定价一致。'],
];

export default function SkillChecklist({ ownerId }) {
  const key = `shopdesk:skill-checklist:v1:${ownerId || 'anonymous'}:product-information`;
  const [checked, setChecked] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      setChecked(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {});
      setError('');
    } catch { setChecked({}); setError('无法读取本机进度，勾选后可重新保存。'); }
  }, [key]);
  function toggle(id, done) {
    const next = { ...checked, [id]: done };
    setChecked(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setError(''); }
    catch { setError('保存失败：当前勾选只在本次页面中保留，请检查浏览器存储权限后重新勾选。'); }
  }
  return <section aria-label="创建商品接入待办" className="mt-4 border-t border-slate-200 pt-4">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="text-lg font-bold text-slate-900">接入待办清单</h3><span role="status">已完成 {tasks.filter(([id]) => checked[id] === true).length} / {tasks.length}</span></div>
    <p className="mt-2 text-sm leading-relaxed">手动记录完成情况，勾选不会执行任务。进度按账号保存在当前浏览器，刷新后保留，不跨设备同步。</p>
    <ul className="mt-4 space-y-3">{tasks.map(([id, title, description]) => <li key={id}><label className="flex gap-3 items-start cursor-pointer rounded-lg p-2 hover:bg-slate-50"><input type="checkbox" checked={checked[id] === true} onChange={e => toggle(id, e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"/><span><span className="font-medium text-slate-900">{title}</span><span className="block mt-1">{description}</span></span></label></li>)}</ul>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </section>;
}
