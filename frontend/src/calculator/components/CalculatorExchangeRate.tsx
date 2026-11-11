import { useRef, useState } from 'react';
import { ArrowRightLeft, ChevronDown, ChevronUp, DollarSign, JapaneseYen, Pencil } from 'lucide-react';
import type { useCalculatorExchangeRate } from '../useCalculatorExchangeRate';
import { canonicalRateFromEdit, convertQuickAmount, displayDirectionalRate } from '../quickCurrency';

type Props = { rate: ReturnType<typeof useCalculatorExchangeRate>; error?: string };
const format = (value: number) => new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
export default function CalculatorExchangeRate({ rate, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState<'CNY' | 'MXN'>('CNY');
  const [amount, setAmount] = useState('');
  const [rateDraft, setRateDraft] = useState<{ source: 'CNY' | 'MXN'; value: string } | null>(null);
  const { fx, setFx, quote, manual, setManual, manualRef, cached, loading, fxError, setRefresh } = rate;
  const draft = rateDraft?.source === source ? rateDraft : null;
  const displayedRate = draft ? draft.value : displayDirectionalRate(fx, source);
  const editError = draft ? canonicalRateFromEdit(draft.value, source).error : '';
  const converted = editError ? { amount: null, error: editError } : convertQuickAmount(amount, fx, source);
  const swapDirection = () => { setAmount(converted.amount === null ? amount : converted.amount.toFixed(3)); setRateDraft(null); setSource(value => value === 'CNY' ? 'MXN' : 'CNY'); };
  const sourceName = source === 'CNY' ? '人民币' : 'MXN';
  const targetName = source === 'CNY' ? 'MXN' : '人民币';
  const SourceIcon = source === 'CNY' ? JapaneseYen : DollarSign;
  const TargetIcon = source === 'CNY' ? DollarSign : JapaneseYen;
  return <section className={`calculator-exchange${expanded ? ' is-expanded' : ''}`} aria-labelledby="calculator-fx-heading">
    <div className="calculator-exchange-main">
      <h2 id="calculator-fx-heading" className={expanded ? 'calculator-exchange-heading' : 'calculator-visually-hidden'}>换算汇率 · 快速换算</h2>
      <div className="calculator-exchange-equation">
        <span className={`calculator-exchange-symbol${source === 'CNY' ? ' calculator-exchange-yuan' : ''}`}><SourceIcon aria-hidden="true" /></span>
        <span className="calculator-exchange-base"><strong>1</strong> {sourceName}</span>
        {expanded ? <span className="calculator-exchange-equals" aria-hidden="true">＝</span> : <button className="calculator-quick-swap" type="button" aria-label="交换人民币与 MXN 换算方向" title="互换币种" onClick={swapDirection}><ArrowRightLeft aria-hidden="true" /></button>}
        <label className="calculator-rate-input" htmlFor="calc-fx">
          <span className={`calculator-exchange-symbol${source === 'MXN' ? ' calculator-exchange-yuan' : ''}`}><TargetIcon aria-hidden="true" /></span>
          <input ref={input} id="calc-fx" type="text" inputMode="decimal" value={displayedRate} placeholder={loading ? '获取中' : '填写汇率'} aria-label={source === 'CNY' ? '人民币兑 MXN 汇率' : 'MXN 兑人民币汇率'} aria-invalid={!!(error || editError)} aria-describedby="calc-fx-state" onChange={event => {
            const value = event.target.value;
            setRateDraft({ source, value });
            const next = canonicalRateFromEdit(value, source);
            if (next.fx !== null) { manualRef.current = true; setManual(true); setFx(next.fx); }
          }} onBlur={() => { if (!editError) setRateDraft(null); }} />
        {!expanded && <span>{targetName}</span>}</label>{expanded && <span>{targetName}</span>}
      </div>
      {expanded && <button className="calculator-rate-edit-inline" type="button" onClick={() => { input.current?.focus(); input.current?.select(); }}><Pencil aria-hidden="true" />可手动修改</button>}
      <button className="calculator-edit-rate" type="button" aria-expanded={expanded} aria-controls="calc-quick-conversion" onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}{expanded ? '收起' : '快速换算'}</button>
    </div>
    <div id="calc-quick-conversion" hidden={!expanded}>
      <div className="calculator-quick-grid">
        <div className="calculator-quick-card calculator-quick-source">
          <label htmlFor="calc-quick-amount"><span className={`calculator-quick-symbol${source === 'CNY' ? ' is-yuan' : ''}`}><SourceIcon aria-hidden="true" /></span>{source === 'CNY' ? '人民币' : 'MXN'}</label>
          <input id="calc-quick-amount" type="text" inputMode="decimal" autoComplete="off" value={amount} placeholder="0.000" aria-label={`快速换算金额（${source === 'CNY' ? '人民币' : 'MXN'}）`} aria-invalid={!!converted.error} aria-describedby="calc-quick-note" onChange={event => setAmount(event.target.value)} />
          <p id="calc-quick-note" className={converted.error ? 'calculator-error' : ''}>{converted.error || '输入金额，右边自动换算'}</p>
        </div>
        <button className="calculator-quick-swap" type="button" aria-label="交换人民币与 MXN 换算方向" onClick={swapDirection}><ArrowRightLeft aria-hidden="true" /></button>
        <div className="calculator-quick-card" role="status" aria-live="polite"><h3><span className={`calculator-quick-symbol${source === 'MXN' ? ' is-yuan' : ''}`}><TargetIcon aria-hidden="true" /></span>{source === 'CNY' ? 'MXN' : '人民币'}</h3><output className="calculator-quick-result">{converted.amount === null ? '—' : format(converted.amount)}</output><p>{converted.error ? '请修正金额或汇率后换算' : `按 ${displayedRate || '—'} 换算`}</p></div>
      </div>
    </div>
    <div id="calc-fx-state" className="calculator-fx-state" role="status">
      {error || editError ? <span className="calculator-error">{editError || error}</span> : <span>{manual ? '当前使用手动汇率' : quote ? `${cached ? '缓存参考汇率' : '自动参考汇率'} · Frankfurter · 报价 ${quote.date} · 获取 ${new Date(quote.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : loading ? '正在获取参考汇率，人民币金额需汇率后换算。' : '请填写汇率，或重新获取自动汇率。'}</span>}
      {fxError && <span className="calculator-warning">{fxError}</span>}
      <button className="text-button" type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? '正在更新…' : '更新自动汇率'}</button>
    </div>
  </section>;
}
