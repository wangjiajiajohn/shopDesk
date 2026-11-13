// 参考商品（FastMoss 采集中文章节类目）→ TikTok 官方类目叶子 ID 的人工映射。
// 参考商品原始数据不含官方 category_id，这里按官方 zh-CN 类目树语义建立对照；
// 多个 FastMoss 类目可指向同一官方叶子（如收腹裤/塑身衣/收腹塑腰 → 女士塑身衣）。
//
// 官方节点事实（region=MX，tiktok_categories 缓存）：
//   845832 Pajamas & Loungewear（女装和内衣/女士睡衣和家居服）
//   846088 女士睡裙；601247 内裤；601262 女士文胸；844936 女士文胸配件
//   843400 女士背心，吊带&抹胸；601274 女士紧身裤；845448 女士袜子
//   700710 孕产内衣与内裤；601259 女士塑身衣
export const FATMOSS_TO_OFFICIAL = {
  女士睡衣: '845832',
  睡裙: '846088',
  内裤: '601247',
  文胸: '601262',
  胸贴: '844936',
  背心: '843400',
  打底裤: '601274',
  袜子: '845448',
  孕妇内裤: '700710',
  收腹裤: '601259',
  塑身衣: '601259',
  收腹塑腰: '601259',
};

// 反向索引：官方叶子 ID → 挂在它下面的 FastMoss 类目名（可能多个）
export const OFFICIAL_TO_FATMOSS = Object.entries(FATMOSS_TO_OFFICIAL).reduce(
  (acc, [fatmossName, leafId]) => {
    (acc[leafId] ||= []).push(fatmossName);
    return acc;
  },
  {},
);

// 嵌套树递归收集某节点（含自身）子树下的全部官方叶子 ID
export function collectSubtreeLeafIds(node) {
  if (!node) return [];
  if (node.is_leaf || !node.children?.length) return [node.category_id];
  return node.children.flatMap(collectSubtreeLeafIds);
}

// 在嵌套树中按 category_id 查找节点，返回该节点对象（未找到返回 null）
export function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.category_id === id) return node;
    if (node.children?.length) {
      const hit = findNodeById(node.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

// 返回节点子树内所有「已映射到参考商品」的 FastMoss 类目名（去重、稳定顺序）
export function mappedNamesForNode(node) {
  const leafIds = collectSubtreeLeafIds(node);
  const names = [];
  leafIds.forEach((leafId) => {
    (OFFICIAL_TO_FATMOSS[leafId] || []).forEach((name) => {
      if (!names.includes(name)) names.push(name);
    });
  });
  return names;
}

// 扁平化全部叶子并挂完整路径，供关键词搜索
export function flattenLeaves(nodes, chain = [], acc = []) {
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

// Keep populated branches and their ancestors; never mutate the official tree.
export function populatedCategoryTree(nodes, countNode) {
  return nodes.flatMap(node => {
    const children = populatedCategoryTree(node.children || [], countNode);
    if (countNode(node) <= 0 && children.length === 0) return [];
    return [{ ...node, ...(node.children ? { children } : {}) }];
  });
}
