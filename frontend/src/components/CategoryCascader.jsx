import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Search, FolderTree, Tag, X, Loader2 } from 'lucide-react';
import * as api from '../api';

// 模块级缓存：全量类目树只拉一次，多个弹窗/多次打开共享
let treeCache = null;
let treePromise = null;

function loadTree(region) {
  if (treeCache) return Promise.resolve(treeCache);
  if (!treePromise) {
    treePromise = api.getTiktokCategoryTree(region)
      .then((data) => { treeCache = data.tree; return treeCache; })
      .catch((err) => { treePromise = null; throw err; });
  }
  return treePromise;
}

// 扁平化全部叶子并挂上完整路径，供关键词搜索
function flattenLeaves(nodes, chain = [], acc = []) {
  for (const node of nodes) {
    const nextChain = [...chain, node.name];
    if (node.is_leaf || !node.children?.length) {
      acc.push({ id: node.category_id, name: node.name, path: nextChain });
    } else {
      flattenLeaves(node.children, nextChain, acc);
    }
  }
  return acc;
}

// 按 id 反查节点及其祖先链
function findNode(nodes, id, chain = []) {
  for (const node of nodes) {
    const next = [...chain, node];
    if (node.category_id === id) return next;
    if (node.children?.length) {
      const hit = findNode(node.children, id, next);
      if (hit) return hit;
    }
  }
  return null;
}

const SEARCH_LIMIT = 80;

export default function CategoryCascader({ value, fallbackName = '', onChange, region = 'MX' }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState(treeCache);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [rootId, setRootId] = useState('');   // 当前选中的一级
  const [level2Id, setLevel2Id] = useState(''); // 当前选中的二级
  const wrapRef = useRef(null);

  const allLeaves = useMemo(() => (tree ? flattenLeaves(tree) : []), [tree]);
  const idIndex = useMemo(() => new Map(allLeaves.map((l) => [l.id, l])), [allLeaves]);

  // 打开面板时确保树已加载
  useEffect(() => {
    if (!open) return undefined;
    if (treeCache) { setTree(treeCache); return undefined; }
    setLoading(true);
    setLoadError('');
    loadTree(region)
      .then((t) => setTree(t))
      .catch((err) => setLoadError(err.message || '类目字典加载失败'))
      .finally(() => setLoading(false));
    return undefined;
  }, [open, region]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 已有选中值时，打开面板自动定位到其所属一级/二级
  useEffect(() => {
    if (open && tree && value) {
      const chain = findNode(tree, value);
      if (chain && chain.length >= 2) {
        setRootId(chain[0].category_id);
        setLevel2Id(chain[1].category_id);
      }
    }
  }, [open, tree, value]);

  const roots = tree || [];
  const currentRoot = roots.find((n) => n.category_id === rootId);
  const level2Nodes = currentRoot?.children || [];
  const currentLevel2 = level2Nodes.find((n) => n.category_id === level2Id);
  const leafNodes = currentLevel2?.children || [];

  const searchResults = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return [];
    return allLeaves
      .filter((l) => l.name.toLowerCase().includes(kw) || l.path.join(' / ').toLowerCase().includes(kw))
      .slice(0, SEARCH_LIMIT);
  }, [keyword, allLeaves]);

  const selected = value ? idIndex.get(value) : null;

  const pickLeaf = (id, name, path) => {
    onChange(id, name, path);
    setOpen(false);
    setKeyword('');
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange('', fallbackName || '', []);
  };

  const columnCls = 'w-48 shrink-0 overflow-y-auto border-r border-slate-100 last:border-r-0';
  const rowCls = (active) => `w-full text-left px-2.5 py-1.5 text-xs truncate flex items-center justify-between gap-1 transition cursor-pointer ${
    active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
  }`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? (
            <span className="text-xs text-slate-800 font-medium">{selected.path.join(' / ')}</span>
          ) : fallbackName ? (
            <span className="text-xs text-slate-500">
              {fallbackName}
              <span className="ml-1.5 text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded">未关联官方类目</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">请选择 TikTok 官方类目（必选叶子）</span>
          )}
        </span>
        {value && (
          <span role="button" tabIndex={0} onClick={clearSelection} className="text-slate-300 hover:text-slate-500" title="清除选择">
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 left-0 w-[600px] max-w-[92vw] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {/* 搜索区 */}
          <div className="p-2 border-b border-slate-100 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索类目中文名，如 塑身衣 / 太阳镜"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {loading && (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin" /> 正在加载全量类目字典…
            </div>
          )}
          {loadError && (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-rose-600 text-xs px-6 text-center">
              类目加载失败：{loadError}
              <span className="text-slate-400">请先到 TikTok 商品页点击「更新类目」同步字典</span>
            </div>
          )}

          {!loading && !loadError && keyword.trim() && (
            <div className="h-64 overflow-y-auto p-1.5">
              {searchResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">没有匹配「{keyword}」的叶子类目</div>
              ) : (
                searchResults.map((leaf) => (
                  <button
                    key={leaf.id}
                    type="button"
                    onClick={() => pickLeaf(leaf.id, leaf.name, leaf.path)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-indigo-50 transition ${
                      value === leaf.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    <div className="font-medium truncate flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-violet-500 shrink-0" /> {leaf.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5 pl-4.5">{leaf.path.slice(0, -1).join(' / ')}</div>
                  </button>
                ))
              )}
              {searchResults.length === SEARCH_LIMIT && (
                <div className="py-2 text-center text-[10px] text-slate-400">结果较多，仅显示前 {SEARCH_LIMIT} 条，请细化关键词</div>
              )}
            </div>
          )}

          {!loading && !loadError && !keyword.trim() && (
            <div className="flex h-64">
              {/* 一级：28 个根 */}
              <div className={columnCls}>
                {roots.map((node) => (
                  <button
                    key={node.category_id}
                    type="button"
                    onClick={() => { setRootId(node.category_id); setLevel2Id(''); }}
                    className={rowCls(rootId === node.category_id)}
                  >
                    <span className="truncate">{node.name}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
              {/* 二级 */}
              <div className={columnCls}>
                {!currentRoot ? (
                  <div className="py-10 px-3 text-center text-[11px] text-slate-400">← 请先选择左侧大类</div>
                ) : level2Nodes.map((node) => (
                  <button
                    key={node.category_id}
                    type="button"
                    onClick={() => setLevel2Id(node.category_id)}
                    className={rowCls(level2Id === node.category_id)}
                  >
                    <span className="truncate">{node.name}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
              {/* 三级：叶子 */}
              <div className={columnCls}>
                {!currentLevel2 ? (
                  <div className="py-10 px-3 text-center text-[11px] text-slate-400">← 请选择子类</div>
                ) : leafNodes.map((node) => (
                  <button
                    key={node.category_id}
                    type="button"
                    onClick={() => pickLeaf(node.category_id, node.name,
                      [currentRoot.name, currentLevel2.name, node.name])}
                    className={rowCls(value === node.category_id)}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-violet-500 shrink-0" /> {node.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
