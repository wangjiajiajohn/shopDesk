import { Star } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { referenceAsset } from '../referenceProducts';
import { getProductFunctions, importProductFunctionRun } from '../api';

const control = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600';
export default function ProductFunctionsView() {
  const [data, setData] = useState({ terms: [], runs: [] });
  const [category, setCategory] = useState('女士文胸');
  const [market, setMarket] = useState('墨西哥');
  const [requirements, setRequirements] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  async function load() { setBusy(true); setError(''); try { setData(await getProductFunctions()); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  useEffect(()=>{ load(); },[]);
  async function copyTask() {
    const text = `使用 $product-function-learning 执行一次商品功能词库学习任务。类目：${category.trim()}；市场：${market.trim()}；要求：${requirements.trim() || '从FastMoss或出海匠同类热销商品详情归纳功能词，保留来源，合并同义词。'}。完成后更新ShopDesk词库并回读验证。不设置定时任务。`;
    try { await navigator.clipboard.writeText(text); setNotice('任务指令已复制。粘贴给Codex即可手动执行；复制本身不会开始采集。'); } catch { setError('复制失败，请检查浏览器剪贴板权限后重试。'); }
  }
  async function importRun(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if(file.size > 5*1024*1024) throw new Error('文件过大，请选择小于5MB的任务结果JSON。');
      const run = JSON.parse(await file.text());
      const result = await importProductFunctionRun(run);
      setData(result); setNotice('学习结果已合并保存，原有词条和来源保留。');
    } catch(e) { setError(`导入失败：${e.message}`); } finally { setBusy(false); e.target.value=''; }
  }
  const categories = [...new Set(data.terms.map(t=>t.category))].sort();
  const terms = data.terms.filter(t=>!filter || t.category===filter);
  return <div className="h-full min-h-0 flex flex-col gap-4">
    <header><h1 className="text-xl font-bold text-slate-900">商品功能词库</h1><p className="mt-1 text-xs text-slate-600">所有店铺共用 · 红星表示来源图片重点强调的功能，可展开查看原图；候选功能不等于每款商品都具备。</p></header>
    <section aria-label="手动学习任务" className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">手动学习更新</h2>
      <div className="flex flex-wrap gap-3"><label className="flex-1 text-xs text-slate-600">商品类目<select value={category} onChange={e=>setCategory(e.target.value)} className={`${control} block w-full mt-1`}>{[...new Set(['女士文胸', '女士塑身衣', '女士收腹裤', '女士内裤', '女士睡衣', '男士睡衣', '袜子', ...categories])].map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className="text-xs text-slate-600">市场<input value={market} onChange={e=>setMarket(e.target.value)} className={`${control} block w-full mt-1`}/></label></div>
      <label className="block text-xs text-slate-600">本次采集要求<textarea rows={2} value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="商品范围、销量周期、数量或重点学习的内容" className={`${control} block w-full mt-1`}/></label>
      <div className="flex flex-wrap gap-3 items-center"><button disabled={!category.trim() || !market.trim()} onClick={copyTask} className={`${control} text-indigo-700 disabled:opacity-40`}>复制 Skill 执行指令</button><label className={`${control} text-indigo-700 cursor-pointer`}>导入学习结果<input type="file" accept="application/json,.json" disabled={busy} onChange={importRun} className="block text-xs mt-1 max-w-full"/></label></div>
      <p className="text-xs text-slate-600">由你将指令交给Codex执行，不自动调度。Skill完成后通过接口更新词库，也可在此导入其结果JSON。</p>
    </section>
    {notice && <p role="status" className="text-xs text-slate-700">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error} <button onClick={load} className="underline">重新读取</button></p>}
    <div className="flex gap-3 items-center text-xs text-slate-600"><label>类目 <select value={filter} onChange={e=>setFilter(e.target.value)} className={control}><option value="">全部有词条的类目</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><span>{terms.length} 个功能 · {data.runs.length} 次学习记录</span><button disabled={busy} onClick={load} className="underline disabled:opacity-40">刷新词库</button></div>
    <section aria-label="功能词条" className="flex-1 min-h-0 overflow-y-auto bg-white border border-slate-200 rounded-xl">
      {busy ? <p role="status" className="p-6 text-slate-600">正在读取词库…</p> : !terms.length ? <p className="p-6 text-sm text-slate-600">尚无学习结果。先按类目执行一次Skill，再更新词库；系统不会把预设词冒充采集结果。</p> : <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 items-start">{terms.map(t=><li key={`${t.category}:${t.name}`} className="min-w-0 rounded-xl border border-slate-200 p-4 break-words"><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-semibold text-slate-900">{t.name}</h2>{t.sources.some(s=>s.evidenceType === 'image_text' && s.visualExpression && s.imageAsset) && <span title="来源图片通过文案、箭头或特写重点表现此功能；展开来源可查看原图。" className="shrink-0 inline-flex items-center gap-1 text-xs text-red-700"><Star aria-hidden="true" className="h-3.5 w-3.5 fill-red-600 text-red-600"/>图片强调</span>}</div><p className="text-xs text-slate-600 mt-1">{t.category} · 更新于 {new Date(t.updatedAt).toLocaleString()}</p>{!!t.aliases?.length && <p className="text-xs text-slate-600 mt-1">同义词：{t.aliases.join('、')}</p>}<details className="text-xs mt-2 text-slate-600"><summary className="cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-600">查看 {t.sources.length} 条来源</summary><ul className="mt-2 space-y-2">{t.sources.map((s,i)=><li key={i}><a href={s.url} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{s.platform} · {s.title}</a><p>{s.excerpt}</p>{s.visualExpression && <p className="mt-1">画面表达：{s.visualExpression}</p>}{s.imageAsset && <a href={referenceAsset(s.imageAsset)} target="_blank" rel="noreferrer" className="block mt-2 text-indigo-700 underline"><img src={referenceAsset(s.imageAsset)} alt={`${t.name}的来源图片`} loading="lazy" className="h-36 max-w-full object-contain"/>查看来源原图</a>}</li>)}</ul></details></li>)}</ul>}
    </section>
  </div>;
}
