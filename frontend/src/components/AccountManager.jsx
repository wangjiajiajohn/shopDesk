import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Copy, X, Loader2, KeyRound } from 'lucide-react';
import * as api from '../api';

const EMPTY_FORM = {
  platform: '', purpose: '', account: '', contact: '', url: '', note: '',
  password: '', secret: '', pin: '',
};

export default function AccountManager({ accounts, onChanged, showToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  // 已解密显示的字段：{ [accountId]: Set(field) }
  const [revealed, setRevealed] = useState({});
  const [plainCache, setPlainCache] = useState({});

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      setForm({ ...EMPTY_FORM, platform: editing.platform, purpose: editing.purpose || '', account: editing.account,
        contact: editing.contact || '', url: editing.url || '', note: editing.note || '' });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [modalOpen, editing]);

  const toggleReveal = async (acc, field) => {
    const key = `${acc.id}:${field}`;
    const shown = revealed[acc.id]?.has(field);
    if (shown) {
      // 隐藏：从集合移除并清缓存
      setRevealed((prev) => {
        const next = new Set(prev[acc.id]);
        next.delete(field);
        return { ...prev, [acc.id]: next };
      });
      setPlainCache((prev) => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    try {
      const r = await api.revealAccountField(acc.id, field);
      setPlainCache((prev) => ({ ...prev, [key]: r.value }));
      setRevealed((prev) => ({ ...prev, [acc.id]: new Set([...(prev[acc.id] || []), field]) }));
    } catch (err) {
      showToast(`解密失败: ${err.message}`, '✕');
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label}已复制`, '✓');
    } catch {
      showToast('复制失败，请手动选择', '✕');
    }
  };

  const save = async () => {
    if (!form.platform.trim() || !form.account.trim()) {
      showToast('平台和账号为必填项', '✕');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        // 编辑时：密码类字段留空表示不变
        const payload = { ...form };
        ['password', 'secret', 'pin'].forEach((f) => { if (!payload[f]) delete payload[f]; });
        await api.updatePlatformAccount(editing.id, payload);
        showToast('账号已更新', '✓');
      } else {
        await api.createPlatformAccount(form);
        showToast('账号已加密保存', '✓');
      }
      setModalOpen(false);
      onChanged();
    } catch (err) {
      showToast(`保存失败: ${err.message}`, '✕');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (acc) => {
    if (!confirm(`确定删除「${acc.platform} / ${acc.account}」吗？此操作不可恢复。`)) return;
    try {
      await api.deletePlatformAccount(acc.id);
      showToast('账号已删除', '✓');
      onChanged();
    } catch (err) {
      showToast(`删除失败: ${err.message}`, '✕');
    }
  };

  const SecretCell = ({ acc, field, masked, has }) => {
    const key = `${acc.id}:${field}`;
    const isShown = revealed[acc.id]?.has(field);
    if (!has) return <span className="text-slate-300">—</span>;
    return (
      <div className="flex items-center gap-1 font-mono text-[11px]">
        <span className="text-slate-700">{isShown ? plainCache[key] : masked}</span>
        <button onClick={() => toggleReveal(acc, field)} className="text-slate-400 hover:text-indigo-600 p-0.5"
          title={isShown ? '隐藏' : '显示明文'}>
          {isShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        {isShown && (
          <button onClick={() => copyText(plainCache[key], field)} className="text-slate-400 hover:text-indigo-600 p-0.5" title="复制">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          共 {accounts.length} 个账号 · 密码/密钥/PIN 均加密存储，默认掩码，点击眼睛图标解密显示
        </p>
        <button onClick={() => { setEditing(null); setModalOpen(true); }}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新增账号
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[11px]">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">平台 / 用途</th>
              <th className="text-left px-3 py-2.5 font-semibold">登录账号</th>
              <th className="text-left px-3 py-2.5 font-semibold">密码</th>
              <th className="text-left px-3 py-2.5 font-semibold">密钥 Secret</th>
              <th className="text-left px-3 py-2.5 font-semibold">PIN</th>
              <th className="text-right px-3 py-2.5 font-semibold w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-slate-800">{acc.platform}</div>
                  {acc.purpose && <div className="text-[11px] text-slate-400">{acc.purpose}</div>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-slate-700">{acc.account}</div>
                  {acc.contact && <div className="text-[11px] text-slate-400">{acc.contact}</div>}
                </td>
                <td className="px-3 py-2.5"><SecretCell acc={acc} field="password" masked={acc.password_masked} has={acc.has_password} /></td>
                <td className="px-3 py-2.5"><SecretCell acc={acc} field="secret" masked={acc.secret_masked} has={acc.has_secret} /></td>
                <td className="px-3 py-2.5"><SecretCell acc={acc} field="pin" masked={acc.pin_masked} has={acc.has_pin} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditing(acc); setModalOpen(true); }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="编辑">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(acc)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="删除">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan="6" className="text-center text-slate-400 py-10">暂无账号，点击右上角新增</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-500" />
                {editing ? '编辑账号' : '新增账号'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="平台 *" value={form.platform} onChange={(v) => setForm({ ...form, platform: v })} placeholder="如 领星 OMS" />
              <Field label="用途" value={form.purpose} onChange={(v) => setForm({ ...form, purpose: v })} placeholder="如 墨西哥本地店铺" />
              <Field label="登录账号 *" value={form.account} onChange={(v) => setForm({ ...form, account: v })} placeholder="账号/邮箱/手机号" />
              <Field label="联系人" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} />
              <div className="col-span-2"><Field label="平台链接" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://..." /></div>
              <Field label="密码" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })}
                placeholder={editing ? '留空表示不修改' : '登录密码'} />
              <Field label="密钥 / 安全问答" type="password" value={form.secret} onChange={(v) => setForm({ ...form, secret: v })}
                placeholder={editing ? '留空表示不修改' : '二级密钥'} />
              <Field label="PIN 码" type="password" value={form.pin} onChange={(v) => setForm({ ...form, pin: v })}
                placeholder={editing ? '留空表示不修改' : '支付/操作 PIN'} />
              <div className="col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">备注</label>
                <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium">取消</button>
              <button onClick={save} disabled={busy}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? '保存修改' : '加密保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-slate-600 font-semibold mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
    </div>
  );
}
