import React from 'react';

export default function SourceInformation({ product }) {
  const data = product?.source_data;
  if (!data) return null;
  const assets = data.assets || [];
  const chart = product.size_chart;
  return <section className="space-y-3 border-t border-slate-200 pt-4" aria-labelledby="source-information-heading">
    <h4 id="source-information-heading" className="font-bold text-slate-900">供应商原始资料</h4>
    <p className="text-slate-600">{data.document_title} · {data.source_category} · 第 {data.source_row} 行 · 货号 {data.source_product_code}</p>
    <p className="text-slate-600">原始报价：{data.original_unit_price} {data.currency} / {data.price_unit === 'pair' ? '双' : '件'} · {data.pack_quantity ? `销售单位含 ${data.pack_quantity}${data.price_unit === 'pair' ? '双' : '件'}` : '套装件数待核对'} · 采购价 {product.supply_price == null ? '待核对' : `${product.supply_price} ${product.supply_currency}`}</p>
    <p className="text-slate-600">成分原文：{product.composition || '未提供'}</p>
    {!!data.issues?.length && <ul className="list-disc pl-4 text-amber-800 bg-amber-50 rounded-lg p-3 space-y-1">{data.issues.map((issue,i) => <li key={i}>{issue.message}</li>)}</ul>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{assets.map(asset => <figure key={asset.url} className="space-y-2">
      <figcaption className="font-semibold text-slate-700">{['size_diagram', 'size_chart'].includes(asset.role) ? '原始尺码 / 测量示意图' : '供应商商品资料图'} · {asset.source_cell}</figcaption>
      <a href={asset.url} target="_blank" rel="noreferrer" aria-label="打开供应商原图"><img src={asset.url} alt={['size_diagram', 'size_chart'].includes(asset.role) ? '供应商提供的尺码与测量资料' : `${product.title} 供应商合成资料图`} className="w-full max-h-96 object-contain bg-slate-50 rounded-lg" /></a>
    </figure>)}</div>
    {!!chart?.rows?.length && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="text-left text-slate-600 mb-2">从原图核对的尺寸（{chart.unit || '单位未确定'}）</caption><thead><tr>{chart.columns.map(c => <th key={c} className="p-2 bg-slate-50">{c}</th>)}</tr></thead><tbody>{chart.rows.map((r,i) => <tr key={i}>{r.map((c,j) => <td className="p-2" key={j}>{c}</td>)}</tr>)}</tbody></table><p className="text-slate-600">{chart.note}</p></div>}
    {!!data.extractions?.some(e => e.kind === 'ocr_text') && <details className="text-slate-600"><summary className="cursor-pointer font-semibold">原图文字识别记录（未经逐项核对）</summary><div className="space-y-3 mt-2">{data.extractions.filter(e => e.kind === 'ocr_text').map((e,i) => <div key={i}><p className="font-medium">{e.source_cell}</p><p className="whitespace-pre-wrap">{e.text || '未识别到文字，参见原图。'}</p></div>)}</div></details>}
    <p className="text-slate-600">资料图用于后续商品分析与制图，尚未制作三视图或西语上架素材。库存未提供，不代表无货。</p>
    <div className="flex flex-wrap gap-3"><a className="text-indigo-700 underline" href={data.document_url} target="_blank" rel="noreferrer">原始货盘</a>{data.raw_photo_links?.map(url => <a className="text-indigo-700 underline" key={url} href={url} target="_blank" rel="noreferrer">产品实拍资料链接（未提取）</a>)}</div>
  </section>;
}
