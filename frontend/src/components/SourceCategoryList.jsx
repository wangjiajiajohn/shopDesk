import React from 'react';
import './source-category-list.css';

export default function SourceCategoryList({ categories, counts, total, selected, onSelect }) {
  const group = category => category === '最近上新' ? 0 : /女士|女性|少女|孕妇/.test(category) ? 1 : /男士|男性|男童/.test(category) ? 3 : 2;
  const orderedCategories = categories.map((name, index) => ({ name, index })).sort((a, b) => group(a.name) - group(b.name) || a.index - b.index).map(item => item.name);
  const buttonClass = active => `w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${active ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`;
  return <nav aria-label="货源分类" className="min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl p-3">
    <h2 className="shrink-0 font-semibold text-sm text-slate-900 mb-3">商品分类</h2>
    <div className="source-category-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1">
      <button type="button" aria-pressed={selected === 'ALL'} onClick={() => onSelect('ALL')} className={buttonClass(selected === 'ALL')}><span>全部商品</span><span className="tabular-nums shrink-0">{total}</span></button>
      {orderedCategories.map(category => <button key={category} type="button" aria-pressed={selected === category} onClick={() => onSelect(category)} className={buttonClass(selected === category)}><span className="break-words">{category}</span><span className="tabular-nums shrink-0">{counts[category] || 0}</span></button>)}
      {!categories.length && <p className="text-xs text-slate-600 px-3 py-2">录入商品后显示分类</p>}
    </div>
  </nav>;
}
