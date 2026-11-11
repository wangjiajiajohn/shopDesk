import React, { useEffect, useState } from 'react';
import { X, KeyRound, ShieldCheck, ShieldAlert, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import * as api from '../api';

const STATUS_META = {
  ACTIVE: { label: '授权有效', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  EXPIRED: { label: '已过期', cls: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  INVALID: { label: '校验失败', cls: 'text-rose-600 bg-rose-50 border-rose-200', dot: 'bg-rose-500' },
  REVOKED: { label: '已吊销', cls: 'text-rose-600 bg-rose-50 border-rose-200', dot: 'bg-rose-500' },
  UNAUTHORIZED: { label: '未授权', cls: 'text-slate-500 bg-slate-50 border-slate-200', dot: 'bg-slate-400' },
};

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ShopAuthModal({ isOpen, onClose, shop, credential, onChanged }) {
  const [configStatus, setConfigStatus] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setAccessToken('');
      setRefreshToken('');
      api.getAuthConfigStatus().then(setConfigStatus).catch(() => setConfigStatus(null));
    }
  }, [isOpen, shop?.id]);

  if (!isOpen || !shop) return null;

  const meta = STATUS_META[credential?.auth_status] || STATUS_META.UNAUTHORIZED;
  const hasCredential = !!credential && credential.auth_status !== 'UNAUTHORIZED';

  const handleSave = async () => {
    if (!accessToken.trim()) {
      setResult({ ok: false, message: '请填入 access token' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await api.saveManualToken({
        shop_id: shop.id,
        access_token: accessToken.trim(),
        refresh_token: refreshToken.trim() || null,
        is_dev_shop: true,
      });
      setResult({ ok: r.ok, message: r.ok ? `保存并校验成功：${r.message}` : `Token 已保存但校验未通过：${r.message}` });
      setAccessToken('');
      setRefreshToken('');
      onChanged?.();
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.testToken(shop.id);
      setResult({ ok: r.ok, message: r.ok ? `真实接口校验通过：${r.message}` : `校验未通过：${r.message}` });
      onChanged?.();
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.refreshToken(shop.id);
      setResult({ ok: r.ok, message: `Token 已自动续期并重新校验：${r.message}` });
      onChanged?.();
    } catch (err) {
      setResult({ ok: false, message: `续期失败：${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('确定清除该店铺保存在本地的授权凭证吗？（不会影响 TikTok 后台本身的授权）')) return;
    setBusy(true);
    try {
      await api.revokeCredential(shop.id);
      setResult({ ok: true, message: '本地凭证已清除' });
      onChanged?.();
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">TikTok 真实授权管理</h3>
              <p className="text-[11px] text-slate-400">{shop.shop_name} · TK-ID: {shop.tiktok_shop_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 后端未配置警告 */}
        {configStatus && !configStatus.is_configured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> 后端尚未配置应用凭证
            </div>
            <p>请把 Partner Center 的 app_key / app_secret 填入 <code className="bg-amber-100 px-1 rounded">backend/.env</code>（参考 .env.example），重启后端后才能完成真实接口校验。</p>
          </div>
        )}

        {/* 当前凭证状态 */}
        {hasCredential && (
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-bold ${meta.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
                {meta.label}
              </span>
              {credential.is_dev_shop && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">测试店 Token</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>卖家名称：<span className="font-medium text-slate-800">{credential.seller_name || '—'}</span></div>
              <div>站点区域：<span className="font-medium text-slate-800">{credential.seller_base_region || '—'}</span></div>
              <div>Access 到期：<span className="font-mono text-slate-800">{fmtTime(credential.access_token_expire_at)}</span></div>
              <div>Refresh 到期：<span className="font-mono text-slate-800">{fmtTime(credential.refresh_token_expire_at)}</span></div>
              <div className="col-span-2">最近校验：<span className="text-slate-800">{fmtTime(credential.last_verified_at)}</span></div>
              {credential.last_test_message && (
                <div className="col-span-2 p-2 bg-slate-50 rounded-lg text-slate-500 break-all">{credential.last_test_message}</div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTest}
                disabled={busy}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                真实接口测试
              </button>
              <button
                onClick={handleRefresh}
                disabled={busy || !credential.has_refresh_token}
                title={credential.has_refresh_token ? '' : '没有 refresh token，无法续期'}
                className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                刷新 Token
              </button>
              <button
                onClick={handleRevoke}
                disabled={busy}
                className="px-3 py-2 text-slate-400 hover:text-rose-600 rounded-lg transition"
                title="清除本地凭证"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 录入新 token */}
        <div className="space-y-3 text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
            录入 Partner Center 测试店 Token
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Access Token（必填）</label>
            <textarea
              rows={3}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="粘贴 TTP_ 开头的 access token"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Refresh Token（选填，有则支持自动续期）</label>
            <textarea
              rows={2}
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="粘贴 refresh token，留空则到期后需重新手动录入"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            保存后系统会立即调用 TikTok 官方 /authorization/202309/shops 接口做真实性校验，通过后自动回写店铺密文 shop_cipher。Token 在本地加密存储，界面不会显示原文。
          </p>

          {result && (
            <div className={`p-2.5 rounded-lg text-[11px] border ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
              {result.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium">
              关闭
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              保存并真实校验
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
