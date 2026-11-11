import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { authLogin, authRegister, authRequestVerifyToken, authVerifyCode, authForgotPassword, authResetPassword, setToken } from '../api';

export default function AuthView({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // login | register | verify | forgot | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'success'|'error', text}

  const flash = (type, text) => setMsg({ type, text });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const res = await authLogin(email.trim(), password);
      setToken(res.access_token);
      onAuthSuccess();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 8) return flash('error', '密码至少 8 位');
    if (password !== confirm) return flash('error', '两次密码不一致');
    setLoading(true); setMsg(null);
    try {
      await authRegister(email.trim(), password);
      // 注册成功后自动请求验证 token，让用户输入验证码
      await authRequestVerifyToken(email.trim());
      flash('success', '注册成功！验证码已发送至您的邮箱，请查收');
      setMode('verify');
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      await authVerifyCode(email.trim(), code.trim());
      flash('success', '邮箱验证成功！请登录');
      setMode('login');
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      await authRequestVerifyToken(email.trim());
      flash('success', '验证码已重新发送');
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      await authForgotPassword(email.trim());
      flash('success', '重置密码验证码已发送至您的邮箱，请查收');
      setMode('reset');
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (password.length < 8) return flash('error', '密码至少 8 位');
    if (password !== confirm) return flash('error', '两次密码不一致');
    setLoading(true); setMsg(null);
    try {
      await authResetPassword(email.trim(), code.trim(), password);
      flash('success', '密码重置成功！请使用新密码登录');
      setMode('login');
      setPassword(''); setConfirm(''); setCode('');
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendResetCode = async () => {
    try {
      await authForgotPassword(email.trim());
      flash('success', '验证码已重新发送');
    } catch (err) {
      flash('error', err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-8 pt-8 pb-4">
          <h1 className="text-2xl font-bold text-slate-800">ShopDesk</h1>
          <p className="text-sm text-slate-500 mt-1">TikTok 跨境电商工作台</p>
        </div>

        {/* Tab */}
        {mode !== 'verify' && (
          <div className="px-8 flex gap-1 border-b border-slate-100">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setMsg(null); }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  mode === m ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>
        )}

        <div className="p-8">
          {msg && (
            <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg text-sm ${
              msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{msg.text}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field icon={<Mail className="w-4 h-4" />}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱" className="flex-1 bg-transparent outline-none text-sm" />
              </Field>
              <Field icon={<Lock className="w-4 h-4" />}>
                <input type={showPwd ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码" className="flex-1 bg-transparent outline-none text-sm" />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              <Submit loading={loading}>登录</Submit>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setMode('forgot'); setMsg(null); }} className="text-slate-400 hover:text-indigo-600">忘记密码？</button>
                <span className="text-slate-400">还没有账号？<button type="button" onClick={() => setMode('register')} className="text-indigo-600 hover:underline">去注册</button></span>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <Field icon={<Mail className="w-4 h-4" />}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱" className="flex-1 bg-transparent outline-none text-sm" />
              </Field>
              <Field icon={<Lock className="w-4 h-4" />}>
                <input type={showPwd ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码（至少 8 位）" className="flex-1 bg-transparent outline-none text-sm" />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              <Field icon={<Lock className="w-4 h-4" />}>
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="确认密码" className="flex-1 bg-transparent outline-none text-sm" />
              </Field>
              <Submit loading={loading}>注册并验证邮箱</Submit>
              <p className="text-center text-xs text-slate-400">
                已有账号？<button type="button" onClick={() => setMode('login')} className="text-indigo-600 hover:underline">去登录</button>
              </p>
            </form>
          )}

          {mode === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-sm text-slate-600">
                验证邮箱：<span className="font-medium text-slate-800">{email}</span>
              </div>
              <Field icon={<Mail className="w-4 h-4" />}>
                <input type="text" required inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位验证码" className="flex-1 bg-transparent outline-none text-sm tracking-widest" />
              </Field>
              <Submit loading={loading}>完成验证</Submit>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={resendCode} className="text-indigo-600 hover:underline">重新发送验证码</button>
                <button type="button" onClick={() => setMode('login')} className="text-slate-400 hover:text-slate-600">返回登录</button>
              </div>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
                验证码已发送至邮箱，如未收到请检查垃圾邮件箱。
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="text-sm text-slate-600">
                请输入注册邮箱，我们将发送重置密码验证码。
              </div>
              <Field icon={<Mail className="w-4 h-4" />}>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="注册邮箱" className="flex-1 bg-transparent outline-none text-sm" />
              </Field>
              <Submit loading={loading}>发送验证码</Submit>
              <p className="text-center text-xs text-slate-400">
                想起密码了？<button type="button" onClick={() => setMode('login')} className="text-indigo-600 hover:underline">返回登录</button>
              </p>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-sm text-slate-600">
                重置密码：<span className="font-medium text-slate-800">{email}</span>
              </div>
              <Field icon={<Mail className="w-4 h-4" />}>
                <input type="text" required inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="6 位验证码" className="flex-1 bg-transparent outline-none text-sm tracking-widest" />
              </Field>
              <Field icon={<Lock className="w-4 h-4" />}>
                <input type={showPwd ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="新密码（至少 8 位）" className="flex-1 bg-transparent outline-none text-sm" />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>
              <Field icon={<Lock className="w-4 h-4" />}>
                <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="确认新密码" className="flex-1 bg-transparent outline-none text-sm" />
              </Field>
              <Submit loading={loading}>确认重置</Submit>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={resendResetCode} className="text-indigo-600 hover:underline">重新发送验证码</button>
                <button type="button" onClick={() => setMode('login')} className="text-slate-400 hover:text-slate-600">返回登录</button>
              </div>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
                验证码已发送至邮箱，如未收到请检查垃圾邮件箱。
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-lg focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
      <span className="text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

function Submit({ loading, children }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium text-sm transition">
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
      {!loading && <ArrowRight className="w-4 h-4" />}
    </button>
  );
}
