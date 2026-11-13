import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Search, FolderTree, Tag, X, Loader2, Folder, FolderOpen } from 'lucide-react';
import * as api from '../api';
import {
  OFFICIAL_TO_FATMOSS,
  mappedNamesForNode,
  flattenLeaves,
  findNodeById,
  populatedCategoryTree,
} from '../referenceCategoryMap';

// 模块级缓存：全量官方类目树只拉一次，多次打开共享
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

// 收集所有「子树内含已映射参考商品」的节点 id，用于默认展开定位
function collectMappedAncestorIds(nodes, acc = new Set()) {
  for (const node of nodes) {
    if (node.children?.length) {
      const before = acc.size;
      collectMappedAncestorIds(node.children, acc);
      // 子树里有映射节点，或自身就是映射叶子的父 → 展开
      if (acc.size > before || mappedNamesForNode(node).length > 0) {
        acc.add(node.category_id);
      }
    }
  }
  return acc;
}

// 节点参考商品计数：优先用外部去重计数（与列表口径一致），否则退回子树映射类目求和
function nodeCount(node, counts, resolveCount) {
  const names = mappedNamesForNode(node);
  if (!names.length) return 0;
  if (resolveCount) return resolveCount(names);
  return names.reduce((sum, name) => sum + (counts[name] || 0), 0);
}

function TreeNode({ node, depth, expanded, toggle, selectedId, counts, resolveCount, onPick }) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.category_id);
  const names = mappedNamesForNode(node);
  const mapped = names.length > 0;
  const count = mapped ? nodeCount(node, counts, resolveCount) : 0;
  const active = selectedId === node.category_id;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 pr-2 rounded-lg transition ${
          active ? 'bg-indigo-50' : mapped ? 'hover:bg-slate-50' : ''
        }`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.category_id)}
            className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
            title={isOpen ? '收起' : '展开'}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="p-1 shrink-0"><Tag className="w-3 h-3 text-slate-300" /></span>
        )}

        <button
          type="button"
          disabled={!mapped}
          onClick={() => mapped && onPick(node)}
          className={`flex-1 text-left flex items-center gap-1.5 py-1.5 text-xs truncate ${
            !mapped
              ? 'text-slate-300 cursor-not-allowed'
              : active
                ? 'text-indigo-700 font-semibold'
                : 'text-slate-700 hover:text-indigo-600'
          }`}
          title={mapped ? names.join('、') : '该官方类目下暂无参考商品'}
        >
          {hasChildren && (isOpen
            ? <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />)}
          <span className="truncate">{node.name}</span>
        </button>

        {mapped && (
          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {count}
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.category_id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedId={selectedId}
              counts={counts}
              resolveCount={resolveCount}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReferenceCategoryCascader({ selectedId, selectedPath, counts, resolveCount, onChange, region = 'MX' }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState(treeCache);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const wrapRef = useRef(null);

  const visibleTree = useMemo(() => populatedCategoryTree(tree || [], node => nodeCount(node, counts, resolveCount)), [tree, counts, resolveCount]);
  const allLeaves = useMemo(() => flattenLeaves(visibleTree), [visibleTree]);

  // 打开时加载树，并把含参考商品的类目路径自动展开
  useEffect(() => {
    if (!open) return undefined;
    if (treeCache) {
      setTree(treeCache);
      setExpanded(collectMappedAncestorIds(treeCache));
      return undefined;
    }
    setLoading(true);
    setLoadError('');
    loadTree(region)
      .then((t) => {
        setTree(t);
        setExpanded(collectMappedAncestorIds(t));
      })
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

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const searchResults = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return [];
    return allLeaves
      .filter((l) => l.name.toLowerCase().includes(kw) || l.path.join(' / ').toLowerCase().includes(kw))
      .slice(0, 60);
  }, [keyword, allLeaves]);

  const pickNode = (node) => {
    const names = mappedNamesForNode(node);
    if (!names.length) return;
    const chain = [];
    // 反查完整路径用于按钮展示
    const findChain = (nodes, id, trail) => {
      for (const n of nodes) {
        const nextTrail = [...trail, n.name];
        if (n.category_id === id) return nextTrail;
        if (n.children?.length) {
          const hit = findChain(n.children, id, nextTrail);
          if (hit) return hit;
        }
      }
      return null;
    };
    const path = (findChain(tree, node.category_id, []) || [node.name]).join(' / ');
    onChange({ id: node.category_id, path, names });
    setOpen(false);
    setKeyword('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange({ id: '', path: '', names: [] });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[260px]"
      >
        <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className={`text-xs truncate ${selectedId ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
          {selectedPath || '全部品类 · TikTok 官方类目'}
        </span>
        {selectedId && (
          <span role="button" tabIndex={0} onClick={clear} className="text-slate-300 hover:text-slate-500 shrink-0" title="清除类目">
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 left-0 w-[380px] max-w-[92vw] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索官方类目中文名，如 塑身衣 / 睡衣"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {loading && (
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin" /> 正在加载 TikTok 官方类目字典…
            </div>
          )}
          {loadError && (
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-rose-600 text-xs px-6 text-center">
              类目加载失败：{loadError}
              <span className="text-slate-400">请先到 TikTok 商品页点击「更新类目」同步字典</span>
            </div>
          )}

          {!loading && !loadError && keyword.trim() && (
            <div className="h-72 overflow-y-auto p-1.5">
              {searchResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">没有匹配「{keyword}」且已收录素材的类目</div>
              ) : (
                searchResults.map((leaf) => {
                  const node = findNodeById(tree, leaf.id);
                  const names = node ? mappedNamesForNode(node) : [];
                  const mapped = names.length > 0;
                  return (
                    <button
                      key={leaf.id}
                      type="button"
                      disabled={!mapped}
                      onClick={() => node && pickNode(node)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                        !mapped
                          ? 'text-slate-300 cursor-not-allowed'
                          : selectedId === leaf.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-700 hover:bg-indigo-50'
                      }`}
                    >
                      <div className="font-medium truncate flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-violet-500 shrink-0" /> {leaf.name}
                        {mapped && (
                          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                            {nodeCount(node, counts, resolveCount)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5 pl-4">{leaf.path.slice(0, -1).join(' / ')}</div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {!loading && !loadError && !keyword.trim() && tree && (
            <div className="h-72 overflow-y-auto p-1.5">
              <button
                type="button"
                onClick={() => onChange({ id: '', path: '', names: [] })}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium mb-1 ${
                  !selectedId ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                全部参考商品
              </button>
              {!visibleTree.length && <p className="p-3 text-xs text-slate-600">暂无已收录素材的分类</p>}
              {visibleTree.map((node) => (
                <TreeNode
                  key={node.category_id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  selectedId={selectedId}
                  counts={counts}
                  resolveCount={resolveCount}
                  onPick={pickNode}
                />
              ))}
              <p className="px-2 pt-2 pb-1 text-[10px] text-slate-400 leading-relaxed">
                仅显示已有素材的分类，空分类自动隐藏。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
