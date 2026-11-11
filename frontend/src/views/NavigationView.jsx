import React, { useEffect, useMemo, useState } from 'react';
import { Globe2, ExternalLink, Loader2, KeyRound } from 'lucide-react';
import * as api from '../api';
import { WEBSITES, matchWebsite } from '../data/websites';

// 运营导航分组（仅视图层归类，不改 websites.js 数据契约）
const GROUPS = [
  { id: 'platform', label: '销售平台', ids: ['tiktok', 'mercadolibre'] },
  { id: 'supply', label: '供应链与 ERP / WMS', ids: ['lingxing', 'mihouse', 'miaoshou', 'topwms', 'yuanchuang', 'yollgo'] },
  { id: 'growth', label: '广告与数据工具', ids: ['eco', 'fastmoss', 'chuhaijiang', 'zhenghe'] },
  { id: 'collab', label: '协作办公', ids: ['feishu'] },
];

export default function NavigationView({ onNavigateTab }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPlatformAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  // 网站 → 已存平台账号
  const websiteAccountMap = useMemo(() => {
    const map = {};
    accounts.forEach((a) => {
      const w = matchWebsite(a.platform);
      if (w) (map[w.id] ||= []).push(a);
    });
    return map;
  }, [accounts]);

  const linkedCount = Object.values(websiteAccountMap).reduce((n, list) => n + list.length, 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-indigo-600" />
          运营导航
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          日常运营用到的外部平台统一入口：销售平台、供应链 ERP/WMS、广告数据工具与协作办公。
          已在店铺资料库登记登录账号的站点会显示「已存账号」，点击可跳转查看。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载中...
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const sites = group.ids
              .map((id) => WEBSITES.find((w) => w.id === id))
              .filter(Boolean);
            if (!sites.length) return null;
            return (
              <section key={group.id}>
                <div className="flex items-center gap-2 mb-2.5">
                  <h2 className="text-xs font-bold text-slate-700">{group.label}</h2>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold">
                    {sites.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sites.map((w) => {
                    const linked = websiteAccountMap[w.id] || [];
                    return (
                      <div
                        key={w.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-xs transition space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={`/resources/website-logos/${w.icon}`}
                              alt=""
                              className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100 shrink-0"
                              onError={(e) => { e.target.style.visibility = 'hidden'; }}
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs">{w.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                                {new URL(w.url).hostname}
                              </div>
                            </div>
                          </div>
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                            title="新窗口打开"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        {linked.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {linked.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => onNavigateTab?.('resources')}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-medium hover:bg-emerald-100 flex items-center gap-1"
                                title="跳转到店铺资料库 · 账号信息"
                              >
                                <KeyRound className="w-3 h-3" />
                                已存账号：{a.account}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">暂无关联账号</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* 兜底：websites.js 新增但未归入任何分组的站点 */}
          {WEBSITES.some((w) => !GROUPS.some((g) => g.ids.includes(w.id))) && (
            <section>
              <h2 className="text-xs font-bold text-slate-700 mb-2.5">其他</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {WEBSITES.filter((w) => !GROUPS.some((g) => g.ids.includes(w.id))).map((w) => (
                  <div key={w.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <a href={w.url} target="_blank" rel="noreferrer" className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      {w.name} <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-[11px] text-slate-400">
            共 {WEBSITES.length} 个常用站点，其中 {linkedCount} 个已关联资料库账号。站点清单维护在
            <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded font-mono">src/data/websites.js</code>。
          </p>
        </div>
      )}
    </div>
  );
}
