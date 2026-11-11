import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight,
  ImageOff, Search, Download, X, Loader2,
} from 'lucide-react';
import {
  loadReferenceIndex, loadReferencePage, referenceAsset, selectReferencePage,
} from '../referenceProducts';
import ReferenceCategoryCascader from '../components/ReferenceCategoryCascader';

const PAGE_SIZES = [12, 15, 24];

// 图片加载失败时降级为占位，避免破图
function Photo({ image, alt, src }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50 gap-1">
        <ImageOff className="w-5 h-5" />
        <span className="text-[10px]">图片暂未加载</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="w-full h-full object-contain bg-white"
      onError={() => setFailed(true)}
    />
  );
}

// 页码列表：页数多时用省略号，避免按钮溢出
function pageNumbers(totalPages, current) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set([1, totalPages, current, current - 1, current + 1]);
  const list = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

function Pager({ page, pages, total, unit, busy, onPage }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <span>
        共 <b className="text-slate-800">{total}</b> {unit}，第 {page} / {pages} 页
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={busy || page <= 1}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white flex items-center gap-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> 上一页
        </button>
        {pageNumbers(pages, page).map((n, i) => (
          n === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n)}
              disabled={busy}
              className={`w-8 h-8 rounded-lg font-medium transition ${
                n === page ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          )
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={busy || page >= pages}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white flex items-center gap-1 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          下一页 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ImageGroup({ title, images, onZoom }) {
  if (!images.length) return null;
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-bold text-slate-800">
        {title} <span className="text-slate-400 font-normal">· {images.length} 张</span>
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-3">
        {images.map((image) => (
          <figure key={image.role} className="space-y-1">
            <button
              type="button"
              onClick={() => onZoom(referenceAsset(image.asset), image.skuLabel || image.role)}
              className="block w-full aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50 hover:border-indigo-300 transition"
            >
              <Photo image={image} alt={image.skuLabel || image.role} src={referenceAsset(image.preview)} />
            </button>
            <figcaption className="flex items-center justify-between gap-1 text-[10px] text-slate-500">
              <span className="truncate">{image.skuLabel || image.role}</span>
              <a
                href={referenceAsset(image.asset)}
                download
                className="text-indigo-600 hover:underline shrink-0"
                title="下载原图"
              >
                <Download className="w-3 h-3" />
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Detail({ product, category, categories, onBack, onZoom }) {
  // 同一张图可能在主副图、详情图、SKU 中重复出现，按 主副图 → 详情图 → SKU 顺序去重，只展示一次
  const seen = new Set();
  const unique = (list) => list.filter((i) => {
    if (seen.has(i.asset)) return false;
    seen.add(i.asset);
    return true;
  });
  const gallery = unique(product.images.filter((i) => i.role === '主图' || i.role.startsWith('副图')));
  const details = unique(product.images.filter((i) => i.role.startsWith('详情图')));
  const sku = unique(product.images.filter((i) => i.role.startsWith('SKU')));
  const [active, setActive] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);

  const image = gallery[active];
  const placements = product.displayPlacements || product.placements || [];
  const detailCatSet = category ? [category] : (categories || []);
  const shownPlacements = detailCatSet.length
    ? placements.filter((p) => detailCatSet.includes(p.category))
    : placements;
  const title = product.title || `待获取标题 · ${product.id}`;
  const pending = product.detailStatus && product.detailStatus !== 'available';

  return (
    <div className="space-y-5 max-w-6xl">
      <button
        onClick={onBack}
        className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5"
      >
        <ArrowLeft className="w-4 h-4" /> 返回参考商品
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        {/* 主图 / 副图 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
            {image ? (
              <button
                type="button"
                onClick={() => onZoom(referenceAsset(image.asset), image.role)}
                className="w-full h-full"
              >
                <Photo image={image} alt={image.role} src={referenceAsset(image.asset)} />
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">暂无主图</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((item, i) => (
                <button
                  key={item.role}
                  onClick={() => setActive(i)}
                  className={`w-14 h-14 shrink-0 rounded-md border overflow-hidden bg-slate-50 ${
                    active === i ? 'border-indigo-500 ring-1 ring-indigo-300' : 'border-slate-200'
                  }`}
                  title={item.role}
                >
                  <Photo image={item} alt={item.role} src={referenceAsset(item.preview)} />
                </button>
              ))}
            </div>
          )}
          {image && (
            <p className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{image.role} · {image.width} × {image.height}</span>
              <a href={referenceAsset(image.asset)} download className="text-indigo-600 hover:underline">下载原图</a>
            </p>
          )}
        </div>

        {/* 事实与卖点 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 text-xs">
          <p className="text-[11px] font-semibold text-indigo-600">
            {shownPlacements.map((p) => `${p.category} · 第${p.rank}名`).join(' / ') || '已收录留档'}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            lang={product.title ? 'es' : 'zh-CN'}
            className="text-sm font-bold text-slate-900 leading-relaxed focus:outline-none"
          >
            {title}
          </h1>

          {pending && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1">
              <p className="font-semibold text-amber-800">商品图文待补齐</p>
              <p className="text-amber-700 leading-relaxed">
                {product.detailStatus === 'region-unavailable'
                  ? 'TikTok 提示该地区不提供此商品，尚未取得标题、描述与图片；排名记录仍保留。'
                  : 'TikTok 商品图文尚待核验，当前仅保留已取得的排名记录。'}
              </p>
              {product.referenceName && <p className="text-amber-700">FastMoss 参考名称：{product.referenceName}</p>}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-lg p-2">
              <dt className="text-[10px] text-slate-400">近 28 天销量</dt>
              <dd className="text-sm font-bold text-slate-900 mt-0.5">{product.sales28Text || '未取得'}</dd>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <dt className="text-[10px] text-slate-400">近 7 天销量</dt>
              <dd className="text-sm font-bold text-slate-900 mt-0.5">{product.sales7Text || '未取得'}</dd>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <dt className="text-[10px] text-slate-400">商品 ID</dt>
              <dd className="text-[11px] font-mono text-slate-700 mt-1 break-all">{product.id}</dd>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <dt className="text-[10px] text-slate-400">店铺</dt>
              <dd className="text-[11px] text-slate-700 mt-1">{product.shop || '原页未提供'}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3 text-[11px]">
            <a href={product.tiktokUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
              TikTok 商品原页 <ArrowUpRight className="w-3 h-3" />
            </a>
            <a href={product.fastmossUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
              FastMoss 数据来源 <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <h2 className="font-bold text-slate-800">商品卖点</h2>
            <p className="text-[10px] text-slate-400">{product.sellingPointsSource || '来自 FastMoss 商品简介'}</p>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">
              {product.sellingPoints || '尚未取得卖点资料。'}
            </p>
          </div>
        </div>
      </div>

      {/* 商品描述 */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
        <h2 className="text-xs font-bold text-slate-800">商品描述</h2>
        <p className="text-[10px] text-slate-400">
          来自 TikTok 商品详情页{product.descriptionTranslated && ' · 浏览器显示的中文译文'}
        </p>
        {product.descriptionText ? (
          <p lang={product.descriptionLanguage || 'es'} className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
            {product.descriptionText}
          </p>
        ) : (
          <p className="text-xs text-slate-500">{product.descriptionNote || '原页未提供文字描述。'}</p>
        )}
        {product.skuNote && (
          <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="text-slate-400">SKU 规格：</span>{product.skuNote}
          </p>
        )}
      </section>

      <ImageGroup title="详情图" images={details} onZoom={onZoom} />
      <ImageGroup title="SKU 配图" images={sku} onZoom={onZoom} />

      <p className="text-[10px] text-slate-400 leading-relaxed">
        资料为采集时快照。标题、描述与图片来自 TikTok；销量、品类排名与卖点来自 FastMoss。
        主副图、详情图与 SKU 的重复图片已去重，同一张图只展示一次；万位销量沿用来源展示口径。
      </p>
    </div>
  );
}

export default function ReferenceProductsView() {
  const [index, setIndex] = useState(null);
  const [indexError, setIndexError] = useState('');
  const [indexAttempt, setIndexAttempt] = useState(0);

  // categories: 官方树节点解析出的 FastMoss 类目名集合（OR 筛选）
  // category:   细分收窄时的单个 FastMoss 类目（优先级高于 categories）
  // officialId/categoryPath: 当前官方树选中节点，供级联器与标题展示
  const [filters, setFilters] = useState({
    category: '', query: '', page: 1, pageSize: 15,
    categories: [], officialId: '', categoryPath: '',
  });
  const [draft, setDraft] = useState('');
  const [debounced, setDebounced] = useState('');

  const [loaded, setLoaded] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(null);

  const reqSeq = useRef(0);
  const scrollPos = useRef(0);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft.trim()), 350);
    return () => clearTimeout(timer);
  }, [draft]);

  // 筛选条件变化回到第一页
  useEffect(() => {
    setFilters((prev) => ({ ...prev, query: debounced, page: 1 }));
  }, [debounced]);

  // 载入目录
  useEffect(() => {
    const controller = new AbortController();
    setIndexError('');
    loadReferenceIndex(controller.signal)
      .then(setIndex)
      .catch((err) => {
        if (!controller.signal.aborted) setIndexError(err.message || '参考商品目录读取失败');
      });
    return () => controller.abort();
  }, [indexAttempt]);

  const page = useMemo(() => (index ? selectReferencePage(index, filters) : null), [index, filters]);

  // 品类下拉计数随当前资料范围动态计算，避免固定用 7 天口径导致数字与筛选结果不一致
  const categoryCounts = useMemo(() => {
    if (!index) return {};
    return Object.fromEntries(
      index.categories.map((c) => [
        c.name,
        selectReferencePage(index, { ...filters, category: c.name, query: '', page: 1 }).total,
      ]),
    );
  }, [index, filters.category, filters.pageSize]);

  // 官方节点去重计数：跨 FastMoss 类目合并后真实商品数，保证浮层徽章与列表口径一致
  const resolveNodeCount = useCallback((names) => {
    if (!index || !names?.length) return 0;
    return selectReferencePage(index, {
      ...filters, categories: names, category: '', query: '', page: 1,
    }).total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, filters.pageSize]);
  const pageKey = page ? `${filters.officialId}|${filters.categories.join(',')}|${filters.category}|${filters.query}|${page.page}|${filters.pageSize}` : '';

  // 载入本页详情
  useEffect(() => {
    if (!page) return undefined;
    const seq = ++reqSeq.current;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    loadReferencePage(page.items, controller.signal)
      .then((products) => {
        if (seq === reqSeq.current) setLoaded(products);
      })
      .catch((err) => {
        if (!controller.signal.aborted && seq === reqSeq.current) setError(err.message || '本页商品读取失败');
      })
      .finally(() => {
        if (seq === reqSeq.current) setBusy(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, attempt]);

  // 关闭详情后恢复列表滚动位置
  useEffect(() => {
    if (!selected && scrollPos.current) {
      const top = scrollPos.current;
      scrollPos.current = 0;
      requestAnimationFrame(() => document.querySelector('main')?.scrollTo({ top }));
    }
  }, [selected]);

  // ESC 关闭大图
  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const changePage = (next) => {
    setFilters((prev) => ({ ...prev, page: next }));
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setDraft('');
    setFilters((prev) => ({
      ...prev, category: '', query: '', page: 1,
      categories: [], officialId: '', categoryPath: '',
    }));
  };

  // 官方树节点选中：回传 { id, path, names(FastMoss 名集合) }
  const onOfficialCategory = ({ id, path, names }) => {
    setFilters((prev) => ({
      ...prev,
      officialId: id,
      categoryPath: path,
      categories: names || [],
      category: '', // 切换官方节点时清空细分收窄
      page: 1,
    }));
  };

  // 同一官方叶子挂了多个 FastMoss 细分（如女士塑身衣 → 收腹裤/塑身衣/收腹塑腰）
  const subNames = filters.categories.length > 1 ? filters.categories : [];

  const open = (product) => {
    scrollPos.current = document.querySelector('main')?.scrollTop || 0;
    setSelected(product);
  };

  if (selected) {
    return (
      <>
        <Detail product={selected} category={filters.category} categories={filters.categories} onBack={() => setSelected(null)} onZoom={setZoom} />
        {zoom && <ZoomLayer zoom={zoom} onClose={() => setZoom(null)} />}
      </>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>📦 参考商品</span>
            <span className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-200">
              选品素材 · 墨西哥
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            墨西哥 TikTok 爆款参考：主图、副图、SKU 图、详情图与卖点，支持下载用于复刻
          </p>
        </div>
        {index && (
          <div className="text-[11px] text-slate-400 self-start sm:text-right leading-relaxed">
            <div>{index.totalProducts} 款已收录 · {index.categories.length} 个品类</div>
            <div>采集于 {index.capturedAt} — {index.completedAt}</div>
          </div>
        )}
      </div>

      {/* 筛选与搜索：sticky 吸顶常驻 */}
      <div className="sticky top-0 z-20 bg-white p-3 rounded-xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <ReferenceCategoryCascader
            selectedId={filters.officialId}
            selectedPath={filters.categoryPath}
            counts={categoryCounts}
            resolveCount={resolveNodeCount}
            onChange={onOfficialCategory}
          />
          {/* 同一官方叶子下的 FastMoss 细分收窄 */}
          {subNames.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, category: '', page: 1 }))}
                className={`px-2 py-1 rounded-full text-[11px] font-medium border transition ${
                  !filters.category
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                }`}
              >
                全部细分 {resolveNodeCount(subNames)}
              </button>
              {subNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setFilters((prev) => ({ ...prev, category: name, page: 1 }))}
                  className={`px-2 py-1 rounded-full text-[11px] font-medium border transition ${
                    filters.category === name
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {name} {categoryCounts[name] ?? ''}
                </button>
              ))}
            </div>
          )}
          {(filters.officialId || filters.query || draft) && (
            <button onClick={reset} className="text-slate-500 hover:text-indigo-600 font-medium hover:underline">
              重置筛选
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          <select
            value={filters.pageSize}
            onChange={(e) => setFilters((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))}
            className="px-2 py-1.5 border border-slate-200 rounded-lg font-medium bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            title="每页显示"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} 款/页</option>)}
          </select>
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜索标题 / 卖点 / 店铺 / 商品 ID"
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 目录状态 */}
      {indexError ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <h2 className="text-sm font-bold text-slate-800">参考商品目录未能载入</h2>
          <p className="text-xs text-slate-500">{indexError}</p>
          <button
            onClick={() => setIndexAttempt((n) => n + 1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
          >
            重新载入
          </button>
        </div>
      ) : !index ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 正在读取参考商品目录…
        </div>
      ) : (
        <>
          <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700">
              {filters.category || filters.categoryPath || '全部参考商品'}
            </span>
            <span>7 天与 28 天榜单已合并去重，按 28 天销量从高到低{filters.query && ` · 搜索「${filters.query}」`}</span>
          </p>

          {error ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <h2 className="text-sm font-bold text-slate-800">本页商品未能载入</h2>
              <p className="text-xs text-slate-500">{error}</p>
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
              >
                重试本页
              </button>
            </div>
          ) : busy && loaded.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 正在加载第 {page.page} 页商品…
            </div>
          ) : page.total === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <h2 className="text-sm font-bold text-slate-800">没有找到匹配的参考商品</h2>
              <p className="text-xs text-slate-500">试试商品 ID、西语标题或中文卖点，也可以重置筛选。</p>
              <button onClick={reset} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">
                查看全部参考商品
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 transition-opacity ${busy ? 'opacity-60' : ''}`}>
              {loaded.map((product) => {
                const placements = product.displayPlacements || product.placements || [];
                const activeCatSet = filters.category
                  ? [filters.category]
                  : (filters.categories || []);
                const placement = placements.find((p) => activeCatSet.includes(p.category)) || placements[0];
                const main = product.images.find((i) => i.role === '主图');
                const title = product.title || `待获取标题 · ${product.id}`;
                return (
                  <button
                    key={product.id}
                    onClick={() => open(product)}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden text-left hover:border-indigo-300 hover:shadow-sm transition flex flex-col"
                  >
                    <div className="aspect-square bg-slate-50 border-b border-slate-100 overflow-hidden">
                      {main
                        ? <Photo image={main} alt={title} src={referenceAsset(main.preview)} />
                        : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-5 h-5" /></div>}
                    </div>
                    <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                      <span className="text-[10px] font-semibold text-indigo-600">
                        {placement ? `${placement.category} · 第${placement.rank}名` : '已收录留档'}
                        {activeCatSet.length === 0 && placements.length > 1 && ' · 多品类'}
                      </span>
                      <strong lang={product.title ? 'es' : 'zh-CN'} className="text-[11px] font-medium text-slate-800 leading-snug line-clamp-2">
                        {title}
                      </strong>
                      <span className="text-[10px] text-slate-500 mt-auto pt-1 leading-relaxed">
                        近28天 <b className="text-slate-900">{product.sales28Text || '未取得'}</b>
                        <span className="text-slate-300 mx-1">·</span>
                        近7天 <b className="text-slate-700">{product.sales7Text || '未取得'}</b>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 分页：sticky 吸底常驻 */}
          {page.total > 0 && (
            <div className="sticky bottom-0 z-20 bg-white rounded-xl border border-slate-200 shadow-md px-4 py-3">
              <Pager
                page={page.page}
                pages={page.pages}
                total={page.total}
                unit="款参考商品"
                busy={busy}
                onPage={changePage}
              />
            </div>
          )}
        </>
      )}

      {zoom && <ZoomLayer zoom={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

// 全屏大图：ESC / 点遮罩 / 关闭按钮均可退出
function ZoomLayer({ zoom, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/85 flex flex-col items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition"
        aria-label="关闭预览"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="max-w-[92vw] max-h-[82vh]" onClick={(e) => e.stopPropagation()}>
        <img
          src={zoom.src}
          alt={zoom.label}
          referrerPolicy="no-referrer"
          className="max-w-[92vw] max-h-[78vh] object-contain rounded-xl bg-white shadow-2xl"
        />
      </div>
      <p className="text-white/70 text-xs mt-3">{zoom.label}</p>
    </div>,
    document.body,
  );
}
