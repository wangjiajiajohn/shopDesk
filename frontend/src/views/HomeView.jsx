import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { loadMonitor, loadOrders, loadProducts } from '../home/data';
import { inventoryFor } from '../home/inventory';
import HomeAlerts from '../components/home/HomeAlerts';
import OrderStats from '../components/home/OrderStats';
import '../home/dashboard.css';

// Memory only: never reuse another login's order snapshots.
let cacheOwner = null;
const snapshotsByScope = new Map();
function cachedSnapshot(key) {
  const owner = api.getToken();
  if (owner !== cacheOwner) { snapshotsByScope.clear(); cacheOwner = owner; }
  return snapshotsByScope.get(key);
}

export default function HomeView({ shops, markets, showToast, selectedShopId = 'ALL', onOpenOrder }) {
  const cacheKey = `${selectedShopId}:${shops.map(shop => shop.id).sort().join(',')}`;
  const initialSnapshot = cachedSnapshot(cacheKey);
  const [orders, setOrders] = useState(initialSnapshot?.orders ?? null);
  const [monitor, setMonitor] = useState(initialSnapshot?.monitor ?? null);
  const [products, setProducts] = useState(initialSnapshot?.products ?? null);
  const [returns, setReturns] = useState(initialSnapshot?.returns ?? null);
  const [returnsError, setReturnsError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [monitorError, setMonitorError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false), sequence = useRef(0), serverOffset = useRef(initialSnapshot?.serverOffset ?? 0);
  const targets = selectedShopId === 'ALL' ? shops : shops.filter(shop => shop.id === selectedShopId);
  const scopeKey = targets.map(shop => shop.id).join(',');
  const scope = useRef(scopeKey); scope.current = scopeKey;
  const currency = markets.find(market => market.country_code === targets[0]?.market_code)?.currency || 'MXN';

  const refresh = async () => {
    const seq = ++sequence.current; const owner = api.getToken(); setLoading(true);
    const [alerts, rows, catalog, aftersales] = await Promise.allSettled([loadMonitor(selectedShopId), loadOrders(selectedShopId), loadProducts(targets), api.getReturnMonitor(selectedShopId)]);
    if (sequence.current !== seq || api.getToken() !== owner) return false;
    const previous = cachedSnapshot(cacheKey);
    snapshotsByScope.set(cacheKey, { returns: aftersales.status === 'fulfilled' ? aftersales.value : previous?.returns, products: catalog.status === 'fulfilled' ? catalog.value : previous?.products, orders: rows.status === 'fulfilled' ? rows.value.items : previous?.orders, monitor: alerts.status === 'fulfilled' ? alerts.value : previous?.monitor, serverOffset: alerts.status === 'fulfilled' ? alerts.value.evaluated_at*1000-Date.now() : previous?.serverOffset });
    if (alerts.status === 'fulfilled') { setMonitor(alerts.value); setMonitorError(''); serverOffset.current = alerts.value.evaluated_at*1000-Date.now(); setNow(Date.now()+serverOffset.current); }
    else setMonitorError(alerts.reason.message);
    if (rows.status === 'fulfilled') { setOrders(rows.value.items); setOrdersError(''); }
    else setOrdersError(rows.reason.message);
    if (catalog.status === 'fulfilled') { setProducts(catalog.value); setProductsError(''); }
    else setProductsError(catalog.reason.message);
    if (aftersales.status === 'fulfilled') { setReturns(aftersales.value); setReturnsError(''); } else setReturnsError(aftersales.reason.message);
    setLoading(false);
    return alerts.status === 'fulfilled' && rows.status === 'fulfilled' && catalog.status === 'fulfilled' && aftersales.status === 'fulfilled';
  };
  const sync = async (notify = true) => {
    if (lock.current || !targets.length) return;
    lock.current = true; if (notify) setSyncing(true); const key = scopeKey;
    const failures = [];
    try {
      for (const shop of targets) {
        try { await api.syncShopOrders(shop.id, 90); }
        catch (error) { failures.push(`${shop.shop_name}订单：${error.message}`); }
        try { await api.syncShopProducts(shop.id, 'ALL'); }
        catch (error) { failures.push(`${shop.shop_name}商品库存：${error.message}`); }
      }
      if (scope.current !== key) return;
      const ok = await refresh();
      setSyncError(failures.length ? `部分店铺同步失败：${failures.join('；')}。当前仍使用上次快照。` : '');
      if (notify) showToast(ok && !failures.length ? '首页数据已更新' : '部分数据更新失败，请查看页面提示', ok && !failures.length ? '✓' : '✕');
    } finally { lock.current = false; if (notify) setSyncing(false); }
  };
  useEffect(() => {
    const cached = cachedSnapshot(cacheKey);
    setReturns(cached?.returns ?? null); setReturnsError('');
    setProducts(cached?.products ?? null); setProductsError('');
    setOrders(cached?.orders ?? null); setMonitor(cached?.monitor ?? null);
    serverOffset.current = cached?.serverOffset ?? 0;
    setNow(Date.now()+serverOffset.current);
    setOrdersError(''); setMonitorError(''); setSyncError('');
    refresh();
    if (!cached) sync(false);
    const timer = setInterval(() => { if (!document.hidden) sync(false); }, 5*60000);
    const clock = setInterval(() => setNow(Date.now()+serverOffset.current), 30000);
    return () => { sequence.current++; clearInterval(timer); clearInterval(clock); };
  }, [scopeKey, cacheKey]);

  const stockStats = products && orders ? inventoryFor(products, orders, now) : null;
  const snapshots = (monitor?.shops || []).map(shop => shop.last_order_snapshot_at).filter(Boolean);
  const snapshot = snapshots.length && snapshots.length === (monitor?.shops.length || 0)
    ? new Date(Math.min(...snapshots.map(value=>new Date(value).getTime()))).toLocaleString('zh-CN',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '尚未完整同步';
  return <div className="home-dashboard">
    {syncError && <p role="alert" className="hd-error">{syncError}</p>}
    <HomeAlerts returns={returns} returnsError={returnsError} stockStats={stockStats} stockError={productsError || ordersError} monitor={monitor} orders={orders || []} loading={loading} error={monitorError} now={now} snapshot={snapshot} syncing={syncing} onSync={()=>sync()} canSync={targets.length>0} scopeKey={scopeKey} selectedShopId={selectedShopId} onOpenOrder={onOpenOrder}/>
    <OrderStats orders={orders} loading={loading} error={ordersError} currency={currency} now={now}/>
  </div>;
}
