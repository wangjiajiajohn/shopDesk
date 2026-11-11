import { useEffect, useRef, useState } from 'react';
import type { useCalculatorExchangeRate } from '../useCalculatorExchangeRate';
export default function CalculatorCompactRate({ rate, error }: { rate: ReturnType<typeof useCalculatorExchangeRate>; error?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const modify = useRef<HTMLButtonElement>(null);
  const actual = rate.quote ? Number(rate.quote.rate.toFixed(8)) : null;
  const valid = /^\d+(\.\d{1,8})?$/.test(draft.trim()) && Number(draft) > 0 && Number(draft) <= 1_000_000;
  const time = rate.quote ? new Date(rate.quote.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const close = () => { setEditing(false); requestAnimationFrame(() => modify.current?.focus()); };
  const save = (value: string, manual: boolean) => { rate.manualRef.current = manual; rate.setManual(manual); rate.setFx(value); close(); };
  return <div className="calculator-compact-rate">
    {editing ? <>
      <form className="calculator-rate-bar" onSubmit={event => { event.preventDefault(); if (valid) save(draft.trim(), true); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
        <span>汇率</span><label className="calculator-rate-editor">1 CNY = <input ref={input} aria-label="人民币兑比索汇率" aria-invalid={!valid} aria-describedby={!valid ? 'calculator-rate-error' : undefined} type="text" inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)} /> MXN</label>
        <div className="calculator-rate-actions"><button type="submit" className="calculator-rate-confirm" disabled={!valid}>确定</button><button type="button" onClick={close}>取消</button></div>
      </form>
      {!valid && <p id="calculator-rate-error" className="calculator-error">请输入有效的正数汇率（最多8位小数）</p>}
      <div className="calculator-market-rate">市场汇率 {actual ?? '暂不可用'}{rate.cached ? '（缓存）' : ''}{actual !== null && <><span> · </span><button type="button" onClick={() => save(String(actual), false)}>使用市场汇率</button></>}</div>
    </> : <div className="calculator-rate-bar calculator-rate-display">
      <span>汇率</span><span className="calculator-rate-value">1 CNY = <strong>{rate.fx || '—'} MXN</strong></span><span className="calculator-rate-meta"><span className="calculator-rate-badge" data-manual={rate.manual}>{rate.manual ? '手动' : rate.cached ? '缓存' : '自动'}</span><span className="calculator-rate-source">{time}{rate.quote ? ' · Frankfurter' : rate.loading ? '获取中…' : '暂无市场报价'}</span></span>
      <button ref={modify} type="button" onClick={() => { setDraft(rate.fx); setEditing(true); }}>修改</button>
    </div>}
    {(error || rate.fxError) && <p className="calculator-error">{error || rate.fxError}</p>}
  </div>;
}
