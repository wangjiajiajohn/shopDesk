import React, { useEffect, useState } from 'react';
import { X, KeyRound, ShieldCheck, ShieldAlert, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import * as api from '../api';

const STATUS_META = {
  ACTIVE: { label: '授权有效', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  INVALID: { label: '校验失败', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  EXPIRED: { label: '已过期', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  REVOKED: { label: '已吊销', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  UNAUTHORIZED: { label: '未授权', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AuthTokenModal({ isOpen, onClose, shop, credential, configStatus, onChanged }) {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setAccessToken('');
      setRefreshToken('');
      setResult(null);
      setBusy('');
    }
  }, [isOpen, shop?.id]);

  if (!isOpen || !shop) return null;

  const meta = STATUS_META[credential?.auth_status] || STATUS_META.UNAUTHORIZED;
  const configured = configStatus?.is_configured;

  const run = async (key, fn) => {
    setBusy(key);
    setResult(null);
    try {
      const r = await fn();
      setResult({ ok: r.ok !== false, text: r.message || '操作成功' });
      onChanged && onChanged();
    } catch (err) {
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  };

  const handleSave = () => {
    if (!accessToken.trim()) {
      setResult({ ok: false, text: '请填写 access token' });
      return;
    }
    run('save', () =>
      api.saveManualToken({
        shop_id: shop.id,
        access_token: accessToken.trim(),
        refresh_token: refreshToken.trim() || null,
        is_dev_shop: false,
      })
    );
  };

  const handleRevoke = () => {
    if (!confirm('确定清除该店铺的本地授权凭证吗？（不影响 TikTok 平台侧授权）')) return;
    run('revoke', async () => {
      await api.revokeCredential(shop.id);
      return { ok: true, message: '本地凭证已清除' };
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">TikTok 授权管理</h3>
              <p className="text-[11px] text-slate-400">{shop.shop_name} · {shop.tiktok_shop_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!configured && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 leading-relaxed">
            后端尚未配置应用凭证（backend/.env 缺少 TIKTOK_APP_KEY / TIKTOK_APP_SECRET），保存后无法通过真实接口校验。
          </div>
        )}

        {/* 当前授权状态 */}
        <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">当前状态</span>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 ${meta.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
              {meta.label}
            </span>
          </div>
          {credential && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">授权卖家</span>
                <span className="font-medium text-slate-800">{credential.seller_name || '—'} {credential.seller_base_region ? `· ${credential.seller_base_region}` : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Access Token 到期</span>
                <span className="font-mono text-slate-800">{fmtTime(credential.access_token_expire_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Refresh Token</span>
                <span className={credential.has_refresh_token ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                  {credential.has_refresh_token ? `已保存 · 到期 ${fmtTime(credential.refresh_token_expire_at)}` : '未保存'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">最近校验</span>
                <span className="text-slate-700">{fmtTime(credential.last_verified_at)}</span>
              </div>
              {credential.last_test_message && (
                <div className={`text-[11px] rounded-lg px-2.5 py-2 leading-relaxed ${credential.auth_status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {credential.last_test_message}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => run('test', () => api.testToken(shop.id))}
                  disabled={!! busy}
                  className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5"
                >
                  {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  真实接口测试
                </button>
                <button
                  onClick={() => run('refresh', () => api.refreshToken(shop.id))}
                  disabled={!!busy || !credential.has_refresh_token}
                  title={credential.has_refresh_token ? '用 refresh token 换新 access token' : '没有 refresh token'}
                  className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5"
                >
                  {busy === 'refresh' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  刷新 Token
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={!!busy}
                  className="px-3 py-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="清除本地凭证"
                >
                  {busy === 'revoke' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 录入新 token */}
        <div className="space-y-3 text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
            录入 / 替换 Token
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Access Token</label>
            <textarea
              rows={2}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="粘贴 Partner Center 测试店生成、或 OAuth 换取的 access token"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Refresh Token（选填，用于自动续期）</label>
            <textarea
              rows={2}
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="粘贴 refresh token，保存后可一键刷新到期的 access token"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            保存后系统会立即调用 TikTok 官方 <span className="font-mono">/authorization/202309/shops</span> 接口验证真实性，并自动回写店铺密文 shop_cipher。Token 在本地加密存储，界面永不显示原文。
          </p>
          {result && (
            <div className={`rounded-lg px-3 py-2 text-[11px] font-medium ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {result.ok ? '✓ ' : '✕ '}{result.text}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium">
              关闭
            </button>
            <button
              onClick={handleSave}
              disabled={busy === 'save'}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              {busy === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              保存并真实校验
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
