import { useEffect, useRef, useState } from 'react';
import { fetchExchangeRate, parseExchangeQuote, type ExchangeQuote, type PurchaseCurrency } from './exchangeRate';

// Independent state per input; quote cache is shared without sharing manual overrides.
export function useCalculatorExchangeRate(currency: PurchaseCurrency) {
  const [fx, setFx] = useState('');
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [manual, setManual] = useState(false), manualRef = useRef(false);
  const [cached, setCached] = useState(false), [loading, setLoading] = useState(false), [fxError, setFxError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [boundCurrency, setBoundCurrency] = useState(currency);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setBoundCurrency(currency);
    manualRef.current = false; setManual(false); setFx(''); setQuote(null); setCached(false); setFxError('');
    if (currency === 'MXN') { setFx('1'); setLoading(false); clearTimeout(timer); return () => { active = false; controller.abort(); }; }
    const key = `bonita.fx.v1.${currency}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as ExchangeQuote | null;
      if (saved && Number.isFinite(Date.parse(saved.fetchedAt))) { const valid = parseExchangeQuote(saved, currency); setQuote({ ...valid, fetchedAt: saved.fetchedAt }); setFx(String(Number(valid.rate.toFixed(8)))); setCached(true); }
    } catch { /* A missing or invalid independent FX cache does not affect workspace data. */ }
    setLoading(true);
    void fetchExchangeRate(currency, controller.signal).then(value => {
      if (!active) return;
      setQuote(value); setCached(false);
      if (!manualRef.current) setFx(String(Number(value.rate.toFixed(8))));
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Live result remains usable without a cache. */ }
    }).catch(() => { if (active) setFxError('自动汇率更新失败，可重试或手动填写；已有缓存会继续显示。'); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [currency, refresh]);
  return { fx: boundCurrency === currency ? fx : '', setFx, quote: boundCurrency === currency ? quote : null, manual, setManual, manualRef, cached, loading, fxError, setRefresh };
}
