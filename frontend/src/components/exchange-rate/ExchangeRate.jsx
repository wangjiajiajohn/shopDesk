import { useEffect, useState } from 'react';
import { RATE_SOURCE, normalizeRates, ratePoints } from './rates';
import '../../home/tokens.css';
import './exchange-rate.css';

const cacheKey = currency => `shopdesk:fx:ecb:CNY:${currency}`;
function readCache(currency) {
  try { const data=JSON.parse(localStorage.getItem(cacheKey(currency))); return data && { ...data, rows:normalizeRates(data.rows.map(row=>({...row,base:'CNY',quote:currency})),currency) }; } catch { return null; }
}
export default function ExchangeRate({ currency }) {
  const [miniIndex,setMiniIndex]=useState(null);
  const [activeIndex,setActiveIndex]=useState(null);
  const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  useEffect(()=>{
    setActiveIndex(null);setMiniIndex(null);
    if (!currency || currency==='CNY') {setLoading(false);setSnapshot(null);setError('');return;}
    let active=true;
    const cached=readCache(currency);setSnapshot(cached?{...cached,currency}:null);setError('');setLoading(true);
    let controller;
    const load=async()=>{
      controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      try {
        const from=new Date();from.setUTCDate(from.getUTCDate()-30);
        const params=new URLSearchParams({base:'CNY',quotes:currency,from:from.toISOString().slice(0,10),providers:'ecb'});
        const response=await fetch(`https://api.frankfurter.dev/v2/rates?${params}`,{signal:controller.signal,referrerPolicy:'no-referrer'});
        if (!response.ok) throw new Error('汇率暂时不可用');
        const rows=normalizeRates(await response.json(),currency), next={rows,fetchedAt:new Date().toISOString()};
        if (!active) return;
        setSnapshot({...next,currency});
        try {localStorage.setItem(cacheKey(currency),JSON.stringify(next));} catch { /* Storage is optional. */ }
      } catch {if(active)setError('汇率更新失败');}
      finally {clearTimeout(timeout);if(active)setLoading(false);}
    };
    load();const interval=setInterval(load,60*60000);
    return ()=>{active=false;clearInterval(interval);controller?.abort();};
  },[currency,retry]);
  if (!currency) return null;
  if (currency==='CNY') return <span className="fx-same">1 CNY = 1 CNY</span>;
  const rows=snapshot?.currency===currency?snapshot.rows:[], latest=rows.at(-1), points=rows.length?ratePoints(rows,300,100):[];
  const mini=rows.length?ratePoints(rows,96,30,3):[], first=rows[0], change=latest?(latest.rate/first.rate-1)*100:0;
  return <details className="fx-widget" key={currency}>
    <summary aria-label={`人民币兑${currency}近30天日参考汇率，点击展开`}>
      <span className="fx-value">{latest?<>1 CNY = <strong>{latest.rate.toFixed(4)}</strong> {currency}</>:loading?'汇率读取中…':`${currency} 汇率暂不可用`}</span>
      {latest&&<span className="fx-mini-wrap" onPointerLeave={()=>setMiniIndex(null)}>
        <svg width="96" height="30" viewBox="0 0 96 30" aria-hidden="true" onPointerMove={event=>{const box=event.currentTarget.getBoundingClientRect();const x=(event.clientX-box.left)/box.width*96;setMiniIndex(Math.max(0,Math.min(mini.length-1,Math.round((x-3)/90*(mini.length-1)))));}}>
          <polyline points={mini.map(p=>`${p.x},${p.y}`).join(' ')} className="fx-line"/>
          {mini[miniIndex]&&<g className="fx-crosshair"><line x1={mini[miniIndex].x} x2={mini[miniIndex].x} y1="0" y2="30"/><circle cx={mini[miniIndex].x} cy={mini[miniIndex].y} r="3"/></g>}
        </svg>
        {mini[miniIndex]&&<span className="fx-mini-tooltip" role="status"><span>{mini[miniIndex].date}</span><strong>1 CNY = {mini[miniIndex].rate.toFixed(4)} {currency}</strong></span>}
      </span>}
    </summary>
    <div className="fx-popover">
      <div className="fx-heading"><strong>人民币兑{currency}</strong><span>近30天</span></div>
      {latest?<><p className="fx-latest">1 CNY = {latest.rate.toFixed(4)} {currency}</p><p className="fx-caption">区间变化 {change>=0?'+':''}{change.toFixed(2)}% · 数据日期 {latest.date}</p>
        <div className="fx-chart-wrap">
          <svg viewBox="0 0 300 110" className="fx-chart" role="slider" tabIndex={0} aria-label="逐日查看人民币汇率，可用左右方向键切换日期" aria-valuemin={0} aria-valuemax={Math.max(0,points.length-1)} aria-valuenow={activeIndex ?? points.length-1} aria-valuetext={`${points[activeIndex ?? points.length-1]?.date}，1 CNY = ${points[activeIndex ?? points.length-1]?.rate} ${currency}`}
            onPointerMove={event=>{const box=event.currentTarget.getBoundingClientRect();const x=(event.clientX-box.left)/box.width*300;setActiveIndex(Math.max(0,Math.min(points.length-1,Math.round((x-5)/290*(points.length-1)))));}}
            onPointerLeave={()=>setActiveIndex(null)} onFocus={()=>setActiveIndex(points.length-1)} onBlur={()=>setActiveIndex(null)}
            onKeyDown={event=>{let next=activeIndex??points.length-1;if(event.key==='ArrowLeft')next--;else if(event.key==='ArrowRight')next++;else if(event.key==='Home')next=0;else if(event.key==='End')next=points.length-1;else return;event.preventDefault();setActiveIndex(Math.max(0,Math.min(points.length-1,next)));}}>
            <polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} className="fx-line"/>
            {points.map(p=><circle key={p.date} cx={p.x} cy={p.y} r="2" className="fx-dot"/>)}
            {points[activeIndex]&&<g className="fx-crosshair"><line x1={points[activeIndex].x} x2={points[activeIndex].x} y1="0" y2="100"/><circle cx={points[activeIndex].x} cy={points[activeIndex].y} r="4"/></g>}
          </svg>
          {points[activeIndex]&&<div className="fx-tooltip" role="status" style={{left:`${Math.min(54,Math.max(0,points[activeIndex].x/3-22))}%`}}><span>{points[activeIndex].date}</span><strong>1 CNY = {points[activeIndex].rate.toFixed(4)} {currency}</strong></div>}
        </div>
        <div className="fx-date-range"><span>{first.date}</span><span>{latest.date}</span></div>
      </>:<p role="status">{loading?'正在读取参考汇率…':'该币种暂无可用汇率数据。'}</p>}
      {error&&<p className="fx-error" role="alert">{error}{latest?'，保留上次数据。':''}<button onClick={()=>setRetry(n=>n+1)}>重试</button></p>}
      <p className="fx-source">日参考汇率，不是实时成交价。<a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">{RATE_SOURCE}</a>{snapshot&&<span> · 获取时间 {new Date(snapshot.fetchedAt).toLocaleString('zh-CN',{hour12:false})}</span>}</p>
    </div>
  </details>;
}
