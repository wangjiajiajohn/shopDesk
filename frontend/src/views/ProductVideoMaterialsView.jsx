import React from 'react';
import { Video } from 'lucide-react';

export default function ProductVideoMaterialsView() {
  return <div className="h-full min-h-0 flex flex-col gap-5">
    <header className="shrink-0"><h1 className="text-xl font-bold text-slate-900">商品视频素材库</h1><p className="mt-1 text-xs text-slate-600">当前账号的所有店铺共享，不随店铺切换。</p></header>
    <section className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl p-6 text-center" aria-label="商品视频素材">
      <Video className="w-8 h-8 text-slate-500" aria-hidden="true" />
      <h2 className="text-sm font-semibold text-slate-900">商品视频素材库待配置</h2>
      <p className="text-xs text-slate-600">视频收录与管理方式待确定。</p>
    </section>
  </div>;
}
