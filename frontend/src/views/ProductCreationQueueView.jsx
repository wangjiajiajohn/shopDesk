import React, { useEffect, useRef, useState } from 'react';
import { getSourceProductPage, updateSalesQueue } from '../api';
import { createSourcePageCache } from '../sourcePageCache';
import ProductCreationWorkspace from '../components/ProductCreationWorkspace';

export default function ProductCreationQueueView({ suppliers, ownerId, onNavigateSourcing }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('ALL');
  const [data, setData] = useState({items: [], total:0, queue_total:0});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState('');
  const cache = useRef(createSourcePageCache());
  useEffect(()=>{cache.current.clear();},[ownerId,retry]);
  useEffect(()=>{
    let active=true; const params={page,page_size:20,queue_only:true,q:query,supplier_id:supplier};const key=JSON.stringify(params);
    const apply=result=>{setData(result);setPage(result.page);setSelected(previous=>result.items.find(p=>p.id===previous?.id) || result.items[0] || null);setLoading(false);};
    setError('');const cached=cache.current.get(key);
    if(cached){apply(cached.data);return()=>{active=false;};}
    setLoading(true);const revision=cache.current.revision;
    const timer=setTimeout(()=>getSourceProductPage(params).then(result=>{const entry=cache.current.put(key,result,revision);if(active&&entry)apply(result);}).catch(e=>{if(active){setError(e.message);setLoading(false);}}),200);
    return()=>{active=false;clearTimeout(timer);};
  },[page,query,supplier,ownerId,retry]);
  const remove=async()=>{
    if(!selected)return;setRemoving(true);setMessage('');
    try{await updateSalesQueue([selected.id],'remove');setMessage('已移出队列，货源商品仍保留。');setRetry(n=>n+1);}
    catch(e){setMessage(`移出失败：${e.message}`);}finally{setRemoving(false);}
  };
  return <div className="h-full min-h-0 flex flex-col gap-4">
    <header className="shrink-0 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-slate-900">商品创建队列</h1><p className="text-xs text-slate-600 mt-1">先创建商品信息，再选择参考素材并制作图片。</p></div><button onClick={onNavigateSourcing} className="px-3 py-2 text-xs text-indigo-700 bg-white border border-slate-200 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-600">去货源库选品</button></header>
    <div className="shrink-0 flex flex-wrap items-center gap-3 text-xs text-slate-600"><span>已入队 {data.queue_total} 款</span><label className="flex items-center gap-2">供应商<select value={supplier} onChange={e=>{setSupplier(e.target.value);setPage(1);}} className="border border-slate-200 rounded-lg bg-white p-2"><option value="ALL">全部供应商</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><input aria-label="搜索队列商品" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="搜索商品名称或货号" className="min-w-0 flex-1 md:max-w-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-600 outline-none"/><button disabled={loading} onClick={()=>setRetry(n=>n+1)} className="underline disabled:opacity-40">刷新</button></div>
    {message && <p role="status" className="shrink-0 text-xs text-slate-700">{message}</p>}
    {error ? <div role="alert" className="p-6 bg-white rounded-xl text-red-700">读取队列失败：{error}<button onClick={()=>setRetry(n=>n+1)} className="ml-3 underline">重试</button></div> : loading ? <div role="status" className="p-6 text-sm text-slate-600">正在读取本页队列…</div> : !data.items.length ? <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col justify-center items-center gap-3 text-slate-600"><p>{query || supplier!=='ALL' ? '没有匹配的队列商品' : '还没有待创建的商品'}</p><button onClick={onNavigateSourcing} className="text-indigo-700 underline text-sm">去货源库选品</button></div> : <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,3fr)] lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-1 gap-4">
      <aside aria-label="队列商品" className="min-h-0 flex flex-col border border-slate-200 rounded-xl bg-white"><div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">{data.items.map(p=><button key={p.id} aria-pressed={selected?.id===p.id} onClick={()=>{setSelected(p);setMessage('');}} className={`w-full text-left p-3 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-600 ${selected?.id===p.id?'bg-indigo-50 text-indigo-900':'text-slate-700 hover:bg-slate-50'}`}><span className="block text-sm font-semibold break-words">{p.title}</span><span className="block text-xs mt-1 text-slate-600">{p.sku_code} · 待创建信息</span></button>)}</div><div className="shrink-0 flex items-center justify-between gap-2 p-3 border-t border-slate-200 text-xs text-slate-600"><button disabled={page<=1} onClick={()=>setPage(n=>n-1)} className="disabled:opacity-40 py-1">上一页</button><span>{page} / {Math.max(1,Math.ceil(data.total/20))}</span><button disabled={page*20>=data.total} onClick={()=>setPage(n=>n+1)} className="disabled:opacity-40 py-1">下一页</button></div></aside>
      {selected && <ProductCreationWorkspace key={`${ownerId}:${selected.id}`} ownerId={ownerId} product={selected} onRemove={remove} removing={removing}/>}
    </div>}
  </div>;
}
