import React, { useMemo, useRef, useState } from 'react';
import SkillFullRules from '../components/SkillFullRules';
import SkillChecklist from '../components/SkillChecklist';
import { Search } from 'lucide-react';
import { workbenchSkills, skillDependencies, selectSkillWorkflows } from '../workbenchSkills';

export default function SkillsView({ ownerId }) {
  const checklistRef = useRef(null);
  const [query, setQuery] = useState('');
  const skills = useMemo(() => selectSkillWorkflows(query), [query]);
  return <div className="h-full min-h-0 flex flex-col gap-5">
    <header className="shrink-0"><h1 className="text-2xl font-bold text-slate-900">Skill 列表</h1><p className="mt-2 text-sm text-slate-600">每个卡片对应一个业务流程，展开查看规则、依赖与接入进度。</p></header>
    <div className="shrink-0 flex flex-wrap gap-3 items-center">
      <label className="relative flex-1 min-w-48 max-w-sm"><span className="sr-only">搜索Skill</span><Search aria-hidden="true" className="absolute left-3 top-2.5 w-4 h-4 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索技能名称或用途" className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"/></label>
      <span role="status" className="text-sm text-slate-600">{skills.length} 个流程</span><button type="button" onClick={()=>{checklistRef.current?.scrollIntoView({block:'start',behavior:'instant'});checklistRef.current?.focus({preventScroll:true});}} className="ml-auto text-sm font-semibold text-indigo-700 underline rounded focus-visible:ring-2 focus-visible:ring-indigo-600">查看接入待办</button>
    </div>
    <section aria-label="技能登记清单" className="flex-1 min-h-0 overflow-y-auto pr-1">
      {!skills.length ? <p className="p-10 text-center text-sm text-slate-600 bg-white border border-slate-200 rounded-xl">没有匹配的Skill，请调整关键词。</p> : <ul className="space-y-5">{skills.map(skill=><li key={skill.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-xl font-bold text-slate-900">{skill.name}</h2><span className={`text-xs px-3 py-1 rounded-lg ${skill.state==='local'?'bg-slate-100 text-slate-700':'bg-amber-50 text-amber-900'}`}>{skill.state==='local'?'本机已有 · 待接入':'待建立'}</span></div>
        <p className="text-sm leading-relaxed text-slate-600 mt-3">{skill.summary}</p>
        <details className="mt-5 text-sm group"><summary className="cursor-pointer text-indigo-700 font-semibold rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">查看规则与接入进度</summary>
          <div className="mt-5 space-y-6 text-slate-700 border-t border-slate-200 pt-5">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5"><div><dt className="text-base font-semibold text-slate-900">输入资料</dt><dd className="mt-2 leading-relaxed">{skill.inputs}</dd></div><div><dt className="text-base font-semibold text-slate-900">输出结果</dt><dd className="mt-2 leading-relaxed">{skill.outputs}</dd></div></dl>
            <section><h3 className="text-base font-semibold text-slate-900 mb-3">执行流程</h3><ol className="list-decimal pl-5 space-y-2 leading-relaxed">{skill.steps.map(step=><li key={step}>{step}</li>)}</ol></section>
            <section><h3 className="text-base font-semibold text-slate-900 mb-2">接入说明</h3><p className="leading-relaxed">{skill.note}</p></section>
            {['tiktok-product-creation','wjj-reference-product-images'].includes(skill.id) && <SkillFullRules skillId={skill.id} />}
            {skillDependencies(skill).length > 0 && <section className="border-t border-slate-200 pt-5"><h3 className="text-base font-semibold text-slate-900 mb-3">调用的依赖能力</h3>{skillDependencies(skill).map(dependency=><div key={dependency.id} className="space-y-2"><p className="font-semibold text-slate-900">{dependency.name}</p><p className="leading-relaxed">{dependency.summary}</p><p>本机已有 · 由本流程调用 · 工作台待接入</p></div>)}</section>}
          </div>
        </details>
      </li>)}</ul>}
      <section ref={checklistRef} tabIndex={-1} aria-label="独立接入待办" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 text-sm text-slate-700"><h2 className="text-xl font-bold text-slate-900">接入待办</h2><p className="mt-2 text-sm text-slate-600">创建商品的工作台接入进度，与Skill规则分开记录。</p><SkillChecklist key={ownerId || 'anonymous'} ownerId={ownerId} /></section>
    </section>
    <p className="shrink-0 text-xs text-slate-600">已安装与已接入分别记录；展示规则不会启动任务。</p>
  </div>;
}
