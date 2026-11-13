import React, { useState } from 'react';

export default function SourceProductImage({ product, onPreview }) {
  const original = product.main_image;
  const preview = /^\/uploads\/jianghe-(catalog|new-arrivals|shaping-pants)\/[^/]+\.[^/.]+$/.test(original || '')
    ? original.replace(/\/([^/]+)\.[^/.]+$/, '/thumbs/$1.webp') : original;
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }} className="w-24 h-32 border border-slate-200 rounded bg-slate-50 text-slate-600 text-xs">图片加载失败<br />点击重试</button>;
  return <button type="button" onClick={() => onPreview(original)} className="block cursor-zoom-in group" title="点击查看原始资料图" aria-label={`查看${product.title}原始资料图`}>
    <img key={attempt} src={fallback ? original : preview} alt={`${product.title}供应商资料图`} decoding="async" onError={() => { if (!fallback && preview !== original) setFallback(true); else setFailed(true); }} className="w-24 h-32 object-contain bg-slate-50 rounded border border-slate-200 group-hover:border-indigo-400 transition" />
  </button>;
}
