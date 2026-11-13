import { Image as ImageIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { productFunctionOptions } from '../productFunctionOptions';
import { getCreationConfig, saveCreationConfig, getProductFunctions, getSourceProduct } from '../api';
import { loadReferenceIndex, loadReferencePage, selectReferencePage, referenceAsset, materialNumberLabel } from '../referenceProducts';

const steps = ['商品信息', '参考素材', '图片队列', '生成结果'];
import { normaliseCreationConfig, newImageScheme, updateImageScheme, imageTypes } from '../creationSchemes';
const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600';
const buttonClass = 'px-3 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-40';

export default function ProductCreationWorkspace({ product, ownerId, onRemove, removing }) {
  const [step, setStep] = useState(0);
  const [library, setLibrary] = useState(null);
  const [libraryError, setLibraryError] = useState('');
  useEffect(() => { let active=true; getProductFunctions().then(d=>{if(active)setLibrary(d);}).catch(()=>{if(active)setLibraryError('功能词库读取失败，暂显示预设候选；已选功能仍保留。');}); return()=>{active=false;}; }, []);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = `shopdesk:creation-config:${ownerId}:${product.id}`;
  const [config, setConfig] = useState(() => { try { return normaliseCreationConfig(JSON.parse(localStorage.getItem(key) || '{}')); } catch { return normaliseCreationConfig(); } });
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [configRetry, setConfigRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [recoveryConfig, setRecoveryConfig] = useState(null);
  const [activeSchemeId, setActiveSchemeId] = useState(config.schemes[0].id);
  const [removedScheme, setRemovedScheme] = useState(null);
  const scheme = config.schemes.find(s => s.id === activeSchemeId) || config.schemes[0];
  const patchScheme = patch => setConfig(c => updateImageScheme(c, scheme.id, patch));
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setConfigLoading(true); setConfigError('');
    (async () => {
      try {
        let remote = await getCreationConfig(product.id);
        if (!active) return;
        let legacy = null;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            legacy = normaliseCreationConfig(JSON.parse(raw));
            if (!localStorage.getItem(`${key}:legacy-backup`)) localStorage.setItem(`${key}:legacy-backup`, raw);
          }
        } catch { /* Remote remains authoritative if local cache is damaged. */ }
        if (!remote.config && legacy) {
          try { remote = await saveCreationConfig(product.id, legacy, 0); }
          catch { remote = await getCreationConfig(product.id); if (!remote.config) throw new Error('旧设置同步失败，本机原设置已保留，请重试。'); }
          if (active) setNotice('已有本机设置已同步到服务器，原始本机备份保留。');
        }
        if (!active) return;
        const loaded = normaliseCreationConfig(remote.config || {});
        setConfig(loaded); setRevision(remote.revision); setActiveSchemeId(loaded.schemes[0].id);
        try { const pending=localStorage.getItem(`${key}:pending`); setRecoveryConfig(pending ? normaliseCreationConfig(JSON.parse(pending)) : null); } catch { setRecoveryConfig(null); }
      } catch(e) { if(active)setConfigError(e.message); }
      finally { if(active)setConfigLoading(false); }
    })();
    return () => { active = false; };
  }, [product.id, key, configRetry]);
  const [references, setReferences] = useState(null);
  const [referenceError, setReferenceError] = useState('');
  const [query, setQuery] = useState('');
  const [referencePage, setReferencePage] = useState(1);
  const [referenceResult, setReferenceResult] = useState({items: [], pages: 1, total: 0});
  const [referenceBusy, setReferenceBusy] = useState(false);
  useEffect(() => {
    let active = true; setDetail(null); setError('');
    getSourceProduct(product.id).then(p => { if (active) setDetail(p); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [product.id, attempt]);
  useEffect(() => {
    if (step !== 1 || scheme.referenceMode !== 'manual' || references) return;
    const controller = new AbortController(); setReferenceError('');
    loadReferenceIndex(controller.signal).then(setReferences).catch(e => { if (!controller.signal.aborted) setReferenceError(e.message); });
    return () => controller.abort();
  }, [step, scheme.referenceMode, references, attempt]);
  useEffect(() => {
    if (!references || step !== 1 || scheme.referenceMode !== 'manual') return;
    const controller = new AbortController(); setReferenceBusy(true); setReferenceError('');
    const timer = setTimeout(() => {
      const page = selectReferencePage(references, {query, page: referencePage, pageSize: 12});
      loadReferencePage(page.items, controller.signal).then(items => { if (!controller.signal.aborted) setReferenceResult({...page, items}); }).catch(e => { if (!controller.signal.aborted) setReferenceError(e.message); }).finally(() => { if (!controller.signal.aborted) setReferenceBusy(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [references, query, referencePage, step, scheme.referenceMode, attempt]);
  useEffect(() => { setQuery(''); setReferencePage(1); setNotice(''); }, [scheme.id]);
  const save = async () => {
    if (saving || configLoading || configError) return;
    setSaving(true); setNotice('');
    const submitted = config;
    // Keep a local recovery copy even if the network write fails.
    try { localStorage.setItem(`${key}:pending`, JSON.stringify(submitted)); } catch { /* server save can still succeed */ }
    try {
      const result = await saveCreationConfig(product.id, submitted, revision);
      setRevision(result.revision);
      try { localStorage.setItem(key, JSON.stringify(result.config)); localStorage.removeItem(`${key}:pending`); } catch { /* server copy is authoritative */ }
      setRecoveryConfig(null); setNotice('设置已保存到服务器，同一账号换电脑可读取。尚未启动生成任务。'); setRemovedScheme(null);
    } catch(e) { setNotice(`服务器保存失败：${e.message} 当前输入仍保留，未标记为同步成功。`); setRecoveryConfig(submitted); }
    finally { setSaving(false); }
  };
  const emphasizedFunctions = new Set((library?.terms || []).filter(t=>t.category === (detail || product).category_name && t.sources?.some(s=>s.evidenceType === 'image_text' && s.visualExpression && s.imageAsset)).map(t=>t.name));
  const functionOptions = [...new Set([...(library ? library.terms.filter(t=>t.category === (detail || product).category_name).map(t=>t.name) : productFunctionOptions(detail || product)), ...config.selectedFunctions])];
  const colors = detail?.specs?.find(s => s.name === '颜色')?.values || [];
  const sizes = detail?.specs?.find(s => s.name === '尺码')?.values || [];
  const imagePlan = [{id:'main',name:'主图', count:1}, {id:'secondary',name:'副图',count:6}, {id:'sku',name:'SKU图',count:colors.length || '按实际颜色'}, {id:'sizeChart',name:'尺码表图', count:1}].filter(item => scheme.imageTypes.includes(item.id));
  const addScheme = () => {
    let ordinal = config.schemes.length + 1;
    while (config.schemes.some(s => s.name === `方案 ${ordinal}`)) ordinal += 1;
    const next = newImageScheme(crypto.randomUUID(), `方案 ${ordinal}`, scheme.imageTypes);
    setConfig(c => ({...c, schemes:[...c.schemes, next]})); setActiveSchemeId(next.id);
  };
  const removeScheme = () => {
    if (config.schemes.length <= 1) return;
    setRemovedScheme(scheme);
    const remaining = config.schemes.filter(s => s.id !== scheme.id);
    setConfig(c => ({...c, schemes:remaining})); setActiveSchemeId(remaining[0].id);
  };
  if (configLoading) return <section role="status" className="p-6 bg-white rounded-xl text-sm text-slate-600">正在读取服务器上的商品创建设置…</section>;
  if (configError) return <section role="alert" className="p-6 bg-white rounded-xl text-sm text-red-700">商品设置读取失败：{configError} <button onClick={()=>setConfigRetry(n=>n+1)} className="underline">重试</button></section>;
  return <section className="min-w-0 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl" aria-label={`${product.title}创建工作区`}>
    <header className="shrink-0 p-4 border-b border-slate-200 flex flex-wrap justify-between items-start gap-3">
      <div className="min-w-0"><h2 className="font-semibold text-slate-900 break-words">{product.title}</h2><p className="mt-1 text-xs text-slate-600">{product.sku_code} · {product.supplier?.name} · 待创建商品信息</p></div>
      <button disabled={removing} onClick={onRemove} className={`${buttonClass} text-xs`}>移出队列</button>
    </header>
    <nav aria-label="商品创建节点" className="shrink-0 flex flex-wrap border-b border-slate-200 px-4 gap-4">
      {steps.map((name,i) => <button key={name} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)} className={`py-3 border-b-2 text-sm focus-visible:outline-indigo-600 ${step === i ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent text-slate-600'}`}>{name}</button>)}
    </nav>
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5 text-sm">
      {step > 0 && <div className="space-y-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap gap-3 items-center justify-between"><h3 className="font-semibold">图片方案 · {config.schemes.length} 套</h3><button className={`${buttonClass} text-xs`} onClick={addScheme}>新增一套方案</button></div>
        <div className="flex flex-wrap gap-2" aria-label="切换图片方案">{config.schemes.map(s => <button key={s.id} aria-pressed={scheme.id === s.id} onClick={()=>setActiveSchemeId(s.id)} className={`px-3 py-2 text-xs rounded-lg border focus-visible:ring-2 focus-visible:ring-indigo-600 ${scheme.id === s.id ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold' : 'border-slate-200 text-slate-700'}`}>{s.name}{s.reference?.materialNumber ? ` · ${String(s.reference.materialNumber).padStart(4,'0')}` : ''}</button>)}</div>
        <div className="flex flex-wrap gap-3 items-end"><label className="flex-1 min-w-0 text-xs text-slate-600">方案名称<input aria-label="方案名称" value={scheme.name} onChange={e=>patchScheme({name:e.target.value})} className={`${fieldClass} mt-1`}/></label><button className={`${buttonClass} text-xs`} disabled={config.schemes.length <= 1} onClick={removeScheme}>移除此方案</button></div>
        {removedScheme && <p role="status" className="text-xs text-slate-600">已移除“{removedScheme.name}”（尚未保存） <button className="text-indigo-700 underline" onClick={()=>{setConfig(c=>({...c, schemes:[...c.schemes,removedScheme]}));setActiveSchemeId(removedScheme.id);setRemovedScheme(null);}}>撤销</button></p>}
        <p className="text-xs text-slate-600">各方案分别保存参考素材、图片任务和结果，共用同一款商品信息。</p>
      </div>}
      {step === 0 && <>
        <div><h3 className="font-semibold text-slate-900">创建商品信息</h3><p className="mt-1 text-slate-600 text-xs">先生成西语标题、完整描述和SKU，不依赖参考图。售价使用采购成本与现有定价模型计算。</p></div>
        {error ? <p role="alert" className="text-red-700">原始资料读取失败：{error} <button className="underline" onClick={() => setAttempt(n=>n+1)}>重试</button></p> : !detail ? <p role="status" className="text-slate-600">正在读取货源资料…</p> : <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600"><div><dt>成分原文</dt><dd className="mt-1 text-slate-900">{detail.composition || '未提供'}</dd></div><div><dt>采购价</dt><dd className="mt-1 text-slate-900">{detail.supply_price == null ? '待核对' : `${detail.supply_price} ${detail.supply_currency || 'CNY'}`}</dd></div><div><dt>颜色</dt><dd className="mt-1 text-slate-900">{colors.join(' / ') || '未提供'}</dd></div><div><dt>尺码</dt><dd className="mt-1 text-slate-900">{sizes.join(' / ') || '未提供可售尺码，不补造'}</dd></div></dl>
          {!!detail.source_data?.issues?.length && <details className="rounded-lg bg-amber-50 p-3 text-amber-900 text-xs"><summary className="cursor-pointer font-semibold">原始资料待核对 · {detail.source_data.issues.length} 项</summary><ul className="list-disc pl-4 mt-2 space-y-1">{detail.source_data.issues.map((item,i)=><li key={i}>{item.message}</li>)}</ul></details>}
        </>}
        <fieldset><legend className="font-semibold mb-3">默认上架参数</legend><div className="grid grid-cols-2 xl:grid-cols-5 gap-3">{[['stock','每SKU库存',0],['weight','重量（克）',1],['depth','深度（厘米）',1],['height','高度（厘米）',1],['width','宽度（厘米）',1]].map(([name,label,min])=><label className="text-xs text-slate-600" key={name}>{label}<input type="number" min={min} step="1" value={config[name]} onChange={e=>setConfig(c=>({...c,[name]:e.target.value === '' ? '' : Number(e.target.value)}))} className={`${fieldClass} mt-1`} /></label>)}</div></fieldset>
        <div className="border-t border-slate-200 pt-4"><h3 className="font-semibold">商品信息结果</h3><p className="mt-2 text-xs text-slate-600">尚未生成标题、描述、正式SKU编码和售价。这里将展示可编辑的生成结果与SKU明细。</p></div>
        {!!functionOptions.length && <fieldset><legend className="font-semibold text-slate-900">功能快捷选择</legend><button type="button" disabled={!config.selectedFunctions.length} onClick={()=>setConfig(c=>({...c,selectedFunctions:[]}))} className="mt-2 text-xs text-indigo-700 underline rounded focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed">清空全部</button><p className="mt-1 text-xs text-slate-600">{libraryError || (library ? '按词库类目提供候选，选择适用于本商品的功能；' : '正在读取词库，暂显示预设候选；')}再点一次取消。图片图标表示来源图片重点强调。已选功能与下方补充要求一起保存。</p><div className="mt-2 flex flex-wrap gap-2">{functionOptions.map(label => { const selected = config.selectedFunctions.includes(label); return <button type="button" key={label} aria-pressed={selected} onClick={()=>setConfig(c=>({...c,selectedFunctions:selected ? c.selectedFunctions.filter(v=>v!==label) : [...c.selectedFunctions,label]}))} className={`${buttonClass} text-xs ${selected ? 'bg-indigo-50 border-indigo-600 text-indigo-900' : ''}`}>{selected ? '已选 · ' : ''}{label}{emphasizedFunctions.has(label) && <span title="来源图片重点强调此功能" className="inline-flex align-middle ml-1 items-center rounded bg-indigo-50 p-1 text-indigo-700"><ImageIcon aria-hidden="true" strokeWidth={2.5} className="h-4 w-4"/><span className="sr-only">图片强调</span></span>}</button>; })}</div></fieldset>}
        <div><label htmlFor={`supplemental-${product.id}`} className="block font-semibold text-slate-900">补充要求</label><p id={`supplemental-help-${product.id}`} className="mt-1 text-xs text-slate-600">填写本商品的功能、重点卖点或制作要求；不填则按默认规则。保存后供商品信息与各套制图方案共同使用，仅作用于当前商品。</p><textarea id={`supplemental-${product.id}`} aria-describedby={`supplemental-help-${product.id}`} rows={4} value={config.supplementalRequirements} onChange={e=>setConfig(c=>({...c,supplementalRequirements:e.target.value}))} placeholder="例如：强调收腹、提臀功能；描述突出日常穿搭，后续图片重点展示对应结构。" className={`${fieldClass} mt-2 resize-y`}/><p className="mt-1 text-xs text-slate-600">点击“保存信息设置”保存到服务器，同一账号跨电脑保留；生成服务尚未接通。</p></div>
        <div className="flex flex-wrap gap-3 items-center"><button onClick={save} disabled={saving || ['stock','weight','depth','height','width'].some(k=>config[k] === '' || config[k] < (k === 'stock' ? 0 : 1) || !Number.isInteger(config[k]))} className={buttonClass}>{saving ? '正在保存…' : '保存信息设置'}</button><button disabled className="px-3 py-2 rounded-lg bg-indigo-600 text-white opacity-40">创建商品信息</button><span className="text-xs text-slate-600">生成服务待接通</span></div>
      </>}
      {step === 1 && <>
        <div><h3 className="font-semibold">选择参考素材</h3><p className="mt-1 text-xs text-slate-600">商品信息完成后用于制图；参考商品只提供表现方式，本品属性仍以货源资料为准。</p></div>
        <fieldset className="flex flex-wrap gap-5"><legend className="sr-only">参考素材选择方式</legend>{[['auto','系统自动匹配'],['manual','手动选择参考商品']].map(([value,label])=><label key={value} className="flex gap-2 items-center"><input type="radio" name={`reference-mode-${product.id}-${scheme.id}`} value={value} checked={scheme.referenceMode===value} onChange={()=>patchScheme({referenceMode:value})}/>{label}</label>)}</fieldset>
        {scheme.referenceMode==='auto' ? <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3">将按商品类型和结构匹配参考商品。目前仅保存匹配方式，尚未执行自动匹配。</p> : <>
          {scheme.reference && <div className="flex justify-between gap-3 p-3 bg-indigo-50 rounded-lg text-indigo-900 text-xs"><span>已选：{scheme.reference.materialNumber ? `${materialNumberLabel(scheme.reference.materialNumber)} · ` : ''}{scheme.reference.title}</span><button className="underline" onClick={()=>patchScheme({reference:null})}>取消选择</button></div>}
          <input aria-label="搜索参考商品" placeholder="搜索素材编号、名称或关键词" value={query} onChange={e=>{setQuery(e.target.value);setReferencePage(1);}} className={fieldClass}/>
          {referenceError ? <p role="alert" className="text-red-700">{referenceError} <button className="underline" onClick={()=>setAttempt(n=>n+1)}>重试</button></p> : referenceBusy || !references ? <p role="status">正在读取参考商品…</p> : !referenceResult.items.length ? <p className="text-slate-600">没有匹配的参考商品，请调整关键词或先完善参考商品库。</p> : <>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">{referenceResult.items.map(ref=>{const image=ref.images?.find(i=>i.role==='主图') || ref.images?.[0];return <button key={ref.id} aria-pressed={scheme.reference?.id===ref.id} onClick={()=>patchScheme({reference:{id:ref.id,title:ref.title || ref.id,materialNumber:ref.materialNumber}})} className={`text-left border rounded-lg p-3 focus-visible:ring-2 focus-visible:ring-indigo-600 ${scheme.reference?.id===ref.id?'border-indigo-600 bg-indigo-50':'border-slate-200'}`}>{image && <img loading="lazy" src={referenceAsset(image.preview || image.asset)} alt="参考商品" className="h-28 w-full object-contain"/>}<span className="block text-xs font-semibold text-slate-900 mt-2">{materialNumberLabel(ref.materialNumber)}</span><span className="block text-xs text-slate-700 mt-1 line-clamp-2">{ref.title || '标题未提供'}</span></button>;})}</div>
          <div className="flex justify-between items-center text-xs"><button className={buttonClass} disabled={referencePage<=1} onClick={()=>setReferencePage(p=>p-1)}>上一页</button><span>{referencePage} / {referenceResult.pages}</span><button className={buttonClass} disabled={referencePage>=referenceResult.pages} onClick={()=>setReferencePage(p=>p+1)}>下一页</button></div></>}
        </>}
        <fieldset><legend className="text-xs font-semibold mb-2">本方案制作范围</legend><div className="flex flex-wrap gap-4">{imageTypes.map(type=><label key={type.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={scheme.imageTypes.includes(type.id)} onChange={e=>patchScheme({imageTypes:e.target.checked?[...scheme.imageTypes,type.id]:scheme.imageTypes.filter(id=>id!==type.id)})}/>{type.name}</label>)}</div></fieldset>
        <button className={buttonClass} disabled={saving || config.schemes.some(s => !s.name.trim() || !s.imageTypes.length || (s.referenceMode==='manual' && !s.reference))} onClick={save}>{saving ? '正在保存…' : '保存全部方案设置'}</button>
      </>}
      {step === 2 && <>
        <div><h3 className="font-semibold">{scheme.name} · 图片任务清单</h3><p className="mt-1 text-xs text-slate-600">APIMart制作图片，逐张交给AI检查；每张最多重试3次，达到上限后标记具体问题。</p></div>
        {imagePlan.length === 0 && <p className="text-xs text-slate-600">本方案尚未选择制作范围，请在参考素材节点选择。</p>}
        <table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr>{['图片用途','数量','当前状态'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{imagePlan.map(item=><tr key={item.name} className="border-b border-slate-100"><td className="p-3">{item.name}</td><td className="p-3">{item.count}</td><td className="p-3 text-slate-600">尚未加入图片队列</td></tr>)}</tbody></table>
        <p className="text-xs text-slate-600">先完成商品信息，再确定参考素材。尺码表使用本品尺寸数据独立排版。</p>
        <button disabled className="px-3 py-2 bg-indigo-600 rounded-lg text-white opacity-40">将此方案加入图片创建队列</button>
      </>}
      {step === 3 && <>
        <h3 className="font-semibold">{scheme.name} · 生成结果与检查记录</h3>
        <div className="py-10 text-center text-slate-600"><p>本方案还没有生成结果</p><p className="text-xs mt-2">生成后逐张展示图片、检查结论、重试次数和失败原因；已通过的结果保留。</p></div>
      </>}
      {recoveryConfig && <p className="text-xs text-amber-900">发现本机尚未同步成功的设置。<button className="underline ml-2" onClick={()=>{setConfig(recoveryConfig);setActiveSchemeId(recoveryConfig.schemes[0].id);setRecoveryConfig(null);setNotice('已恢复本机输入，请核对后再保存到服务器。');}}>恢复本机未同步内容</button></p>}
      {notice && <p role="status" className="text-xs text-indigo-700">{notice}</p>}
    </div>
  </section>;
}
