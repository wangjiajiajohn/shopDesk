export const creationDefaults = { stock: 20, weight: 200, depth: 10, height: 5, width: 10 };
export const imageTypes = [
  { id: 'main', name: '主图' },
  { id: 'secondary', name: '副图' },
  { id: 'sku', name: 'SKU图' },
  { id: 'sizeChart', name: '尺码表图' },
];
export function newImageScheme(id, name, selectedTypes = imageTypes.map(t => t.id)) {
  return { id, name, referenceMode: 'auto', reference: null, imageTypes: [...selectedTypes], jobs: [], results: [] };
}
export function normaliseCreationConfig(saved = {}) {
  const { reference, referenceMode, ...rest } = saved || {};
  const existing = Array.isArray(saved?.schemes) ? saved.schemes.filter(s => s && typeof s.id === 'string') : [];
  const schemes = existing.length ? existing.map(s => ({ ...newImageScheme(s.id, s.name || '未命名方案'), ...s })) : [
    { ...newImageScheme('scheme-1', '方案 1'), reference: reference || null, referenceMode: referenceMode || 'auto' },
  ];
  return { ...creationDefaults, ...rest, selectedFunctions: Array.isArray(rest.selectedFunctions) ? [...new Set(rest.selectedFunctions.filter(v => typeof v === 'string'))] : [], supplementalRequirements: typeof rest.supplementalRequirements === 'string' ? rest.supplementalRequirements : '', schemes };
}
export function updateImageScheme(config, id, patch) {
  return { ...config, schemes: config.schemes.map(s => s.id === id ? { ...s, ...patch } : s) };
}
