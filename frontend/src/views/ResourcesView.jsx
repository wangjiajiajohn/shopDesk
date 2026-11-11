import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Image as ImageIcon, Contact, Download, FileVideo, FileText, Loader2, ChevronRight, Lock, Eye, EyeOff, Copy, Stamp } from 'lucide-react';
import * as api from '../api';
import { IDENTITY_FIELDS, TAX_FIELDS } from '../data/registrant';
import AccountManager from '../components/AccountManager';

const TABS = [
  { id: 'accounts', label: '账号信息', icon: KeyRound },
  { id: 'logos', label: '店铺 Logo', icon: ImageIcon },
  { id: 'documents', label: '证件资料', icon: Contact },
];

// 证件/Logo 文件中文名映射
const FILE_LABELS = {
  'id-front.png': '身份证正面',
  'id-back.png': '身份证反面',
  'holding-id.png': '手持身份证',
  'sat-1.png': 'SAT 税号文件 1',
  'sat-2.png': 'SAT 税号文件 2',
  'sat.pdf': 'SAT 税号 PDF',
  'verification.mp4': '注册验证视频',
  'business-license.png': '营业执照',
  'bonita-a-diario-4096.png': '主 Logo 4096px',
  'bonita-a-diario-avatar-1024.png': '店铺头像 1024px',
  'bonita-a-diario-circle-preview.png': '圆形头像预览',
  'bonita-a-diario-transparent-4096.png': '透明底 Logo 4096px',
  'bonita-a-diario-transparent.svg': '透明底矢量 SVG',
  'bonita-a-diario.svg': '品牌矢量 SVG',
};

const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default function ResourcesView({ showToast }) {
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [fileGroups, setFileGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  // 证件分组展开状态：默认全部收起（Set 为空），点击标题切换
  const [expandedDocs, setExpandedDocs] = useState(() => new Set());
  const toggleDocGroup = (category) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const load = async () => {
    try {
      const [accs, groups] = await Promise.all([
        api.getPlatformAccounts().catch(() => []),
        api.getResourceFiles().catch(() => []),
      ]);
      setAccounts(accs);
      setFileGroups(groups);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const logoGroup = fileGroups.find((g) => g.category === 'shop-logos');
  const docGroups = fileGroups.filter((g) => g.category !== 'shop-logos');

  // 注册人登录资料：Movae 原始 id（registrant-email / registrant-shop）迁移时并入 note
  const registrantLogins = useMemo(
    () => accounts.filter((a) => a.note?.includes('registrant-')),
    [accounts]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">店铺资料库</h2>
        <p className="text-xs text-slate-500 mt-0.5">平台账号密码、品牌 Logo 与注册证件统一管理；敏感信息加密存储、默认掩码。外部站点入口已移至「运营导航」。</p>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                active ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'accounts' && accounts.length > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${active ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {accounts.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载中...
        </div>
      )}

      {/* Tab 1：账号信息 */}
      {!loading && tab === 'accounts' && (
        <AccountManager accounts={accounts} onChanged={load} showToast={showToast} />
      )}

      {/* Tab 2：店铺 Logo */}
      {!loading && tab === 'logos' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(logoGroup?.files || []).map((f) => (
            <div key={f.name} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 flex flex-col">
              <div className="h-32 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 p-3">
                <img src={`/resources/shop-logos/${f.name}`} alt={f.name}
                  className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-800">{FILE_LABELS[f.name] || f.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{f.name} · {fmtSize(f.size)}</div>
              </div>
              <a href={`/resources/shop-logos/${f.name}`} download={f.name} target="_blank" rel="noreferrer"
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1">
                <Download className="w-3.5 h-3.5" /> 下载
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3：证件资料（分组默认收起，点击展开；收起时不加载图片） */}
      {!loading && tab === 'documents' && (
        <div className="space-y-3">
          {docGroups.map((group) => {
            const expanded = expandedDocs.has(group.category);
            return (
              <div key={group.category} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleDocGroup(group.category)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition text-left">
                  <ChevronRight className={`w-4 h-4 text-indigo-500 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-90' : ''}`} />
                  <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-800 flex-1">{group.label}</h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-semibold">
                    {group.files.length} 个文件
                  </span>
                  <span className="text-[10px] text-slate-400">{expanded ? '点击收起' : '点击展开'}</span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">
                    {/* 注册人专属：身份 / 税务 / 登录资料 */}
                    {group.category === 'registrant' && (
                      <>
                        <InfoPanel title="身份信息" note="来源：证件正面及 SAT 文件" fields={IDENTITY_FIELDS} />
                        <InfoPanel title="税务信息" note="来源：SAT.pdf · 签发于 2022-07-12，以下为文件记载" fields={TAX_FIELDS} />

                        <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-xs font-bold text-slate-800">邮箱与店铺登录资料</h4>
                            <span className="px-1.5 py-0.5 border border-rose-300 text-rose-600 rounded text-[10px] font-semibold flex items-center gap-1">
                              <Stamp className="w-3 h-3" /> 原始数据
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mb-3">
                            以下为原始资料，密码及绑定邮箱可能已变更，请以当前账号设置为准。
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {registrantLogins.map((login) => (
                              <div key={login.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                <h5 className="text-[11px] font-bold text-indigo-700">{login.platform}</h5>
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div>
                                    <div className="text-slate-400 text-[10px]">邮箱账号</div>
                                    <div className="text-slate-800 font-medium break-all">{login.account}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-400 text-[10px]">辅助邮箱</div>
                                    <div className="text-slate-800 font-medium break-all">{login.contact || '未提供'}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 shrink-0">密码</span>
                                  <RegistrantPassword login={login} showToast={showToast} />
                                </div>
                              </div>
                            ))}
                            {registrantLogins.length === 0 && (
                              <p className="text-[11px] text-slate-400 col-span-2">未找到注册人登录账号，请在「账号信息」Tab 检查</p>
                            )}
                          </div>
                        </section>

                        <h4 className="text-xs font-bold text-slate-700 pt-1">原始图片与视频</h4>
                      </>
                    )}

                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> 受控访问，不开放公开路径
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {group.files.map((f) => {
                        const url = api.fileDownloadUrl(group.category, f.name);
                        const isVideo = f.mime.startsWith('video/');
                        const isPdf = f.mime === 'application/pdf';
                        return (
                          <div key={f.name} className="border border-slate-200 rounded-xl overflow-hidden group">
                            <a href={url} target="_blank" rel="noreferrer"
                              className="block h-36 bg-slate-50 flex items-center justify-center relative">
                              {isVideo ? (
                                <div className="text-center text-slate-400">
                                  <FileVideo className="w-9 h-9 mx-auto mb-1" />
                                  <span className="text-[10px]">视频 {fmtSize(f.size)}</span>
                                </div>
                              ) : isPdf ? (
                                <div className="text-center text-slate-400">
                                  <FileText className="w-9 h-9 mx-auto mb-1" />
                                  <span className="text-[10px]">PDF {fmtSize(f.size)}</span>
                                </div>
                              ) : (
                                <img src={url} alt={f.name} className="h-full w-full object-cover group-hover:opacity-90" />
                              )}
                            </a>
                            <div className="p-2.5 space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-800 truncate">
                                {FILE_LABELS[f.name] || f.name}
                              </div>
                              <div className="text-[10px] text-slate-400">{fmtSize(f.size)}</div>
                              <a href={url} download={f.name}
                                className="w-full px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1">
                                <Download className="w-3 h-3" /> 下载
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {group.category === 'registrant' && (
                      <p className="text-[10px] text-slate-400 pt-1">
                        来源：你提供的 MARTINEZESPINOZA 文件夹 · 本地资料，不在线更新
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 结构化字段面板（身份/税务信息），长文本自动跨两列
function InfoPanel({ title, note, fields }) {
  return (
    <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <h4 className="text-xs font-bold text-slate-800">{title}</h4>
      <p className="text-[10px] text-slate-400 mb-3">{note}</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {fields.map(([label, value]) => (
          <div key={label} className={value.length > 45 ? 'md:col-span-2' : ''}>
            <dt className="text-[10px] text-slate-400 mb-0.5">{label}</dt>
            <dd className="text-[11px] font-semibold text-slate-800 leading-relaxed break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// 注册人密码：默认掩码，点击眼睛调 reveal 解密，可复制
function RegistrantPassword({ login, showToast }) {
  const [shown, setShown] = useState(false);
  const [plain, setPlain] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (shown) {
      setShown(false);
      return;
    }
    if (plain) {
      setShown(true);
      return;
    }
    setBusy(true);
    try {
      const r = await api.revealAccountField(login.id, 'password');
      setPlain(r.value);
      setShown(true);
    } catch (err) {
      showToast(`密码解密失败: ${err.message}`, '✕');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      showToast('密码已复制', '✓');
    } catch {
      showToast('复制失败，请手动选择', '✕');
    }
  };

  if (!login.has_password) return <span className="text-[11px] text-slate-300">未提供</span>;

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="font-mono text-[11px] text-slate-700 truncate">
        {shown ? plain : login.password_masked}
      </span>
      <button onClick={toggle} disabled={busy}
        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded shrink-0"
        title={shown ? '隐藏' : '显示密码'}>
        {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      {shown && (
        <button onClick={copy}
          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded shrink-0" title="复制密码">
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
