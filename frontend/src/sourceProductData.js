export function sourceCategories(product) {
  return [...new Set([product.category_name, ...(product.source_data?.category_memberships || [])].filter(Boolean))];
}

export function sourceCategorySummary(products, supplierId = 'ALL') {
  const visible = products.filter(p => supplierId === 'ALL' || p.supplier_id === supplierId);
  const counts = {};
  for (const p of visible) for (const category of sourceCategories(p)) counts[category] = (counts[category] || 0) + 1;
  const sourceOrder = [...new Set(products.flatMap(p => p.source_data?.category_order || []))];
  const categories = [...new Set(products.flatMap(sourceCategories))].sort((a,b) => {
    const ai = sourceOrder.indexOf(a), bi = sourceOrder.indexOf(b);
    return (ai < 0 ? sourceOrder.length : ai) - (bi < 0 ? sourceOrder.length : bi);
  });
  return { categories, counts, total: visible.length };
}

export const sourceIssueOptions = [
  ['pack_quantity', '套装件数 / 价格待核对'],
  ['composition', '成分比例异常'],
  ['composition_missing', '成分缺失 / 栏位不符'],
  ['sizes', '尺码缺失 / 含义待核对'],
  ['source_records', '原表编号 / 行列错位'],
  ['missing_chart', '缺少独立尺码图'],
  ['ocr_review', '图片文字尚未复核'],
  ['photo_links', '实拍仅保存链接'],
];

export function sourceIssueTypes(product) {
  const data = product.source_data;
  if (!data) return [];
  const types = new Set((data.issues || []).map(issue =>
    ['source_layout', 'source_column_mismatch', 'source_skc'].includes(issue.field) ? 'source_records' : issue.field));
  // Preserve source formats: an image-only chart is still an available chart.
  if (!(data.assets || []).some(a => ['size_chart', 'size_diagram'].includes(a.role)) &&
      !product.size_chart?.original_image && !product.size_chart?.original_images?.length && !product.size_chart?.rows?.length) types.add('missing_chart');
  if ((data.extractions || []).some(e => e.kind === 'ocr_text' && !['reviewed', 'verified'].includes(e.status))) types.add('ocr_review');
  if (data.raw_photo_links?.length) types.add('photo_links');
  return [...types];
}
