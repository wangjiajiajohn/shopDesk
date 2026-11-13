// Project workflow catalog; dependencies are not independent workflow entries.
export const workbenchSkills = [
  {
    id: 'product-function-learning', name: '商品功能词库学习更新', state: 'local', kind: 'workflow', dependencies: [],
    summary: '手动按类目学习FastMoss或出海匠热销商品，归纳功能词并更新共享词库。',
    inputs: '商品类目、市场、样本范围和采集要求',
    outputs: '功能词、同义词、来源证据和学习任务记录',
    steps: ['读取用户指定范围和已有词库', '通过可用登录会话采集热销商品资料', '归纳功能与同义词并保留原文证据', '幂等合并词库并回读验证'],
    note: '本机已有。共享资源中的商品功能词库提供任务指令和结果导入；不自动定时，不自动认定本品具备所有候选功能。',
  },
  {
    id: 'tiktok-product-creation', name: '创建商品', state: 'local', kind: 'workflow', executionScope: 'product-information-only', dependencies: [],
    summary: '根据货源资料创建标题、完整描述和SKU等商品信息，不包含图片制作。',
    inputs: '货源商品信息、颜色尺码、采购成本、定价模型及默认上架参数',
    outputs: '西语标题、完整描述、SKU编码/库存/售价、重量和包装参数',
    steps: ['读取本品资料与来源问题', '生成西语标题和完整描述', '根据实际颜色尺码整理SKU并分配编码', '带入库存20、重量200克和包装默认值', '调用定价模型计算售价并保存商品信息'],
    note: '复用本机已有“TikTok商品资料与制图”的非图片阶段。工作台取数、定价及保存接口尚需接入；图片制作由WJJ负责，不在此入口启动。',
  },
  {
    id: 'wjj-reference-product-images', name: '创建商品图（WJJ）', state: 'local', kind: 'workflow', dependencies: ['apimart-images'],
    summary: '根据本品资料与参考商品组图，经APIMart制作主图、副图和SKU图并逐图审核。',
    inputs: '已确认商品信息、原始图片、补充要求与已选功能、词库图片表达和多套参考方案',
    outputs: '按方案隔离的商品图片、功能表达映射、逐图次数与审核记录、问题图和交付报告',
    steps: ['复用已有商品资料和认可版本', '分析本品事实与参考图表达', '建立逐图映射和依赖顺序', '经APIMart制作并逐图审核', '记录尝试、问题图及交付结果'],
    note: '已补齐工作台多套方案、功能词库图片表达、用户补充及逐图结果规则。APIMart与原任务账本继续复用；工作台自动执行和结果回写待接通，展示规则不会启动生图。',
  },
  {
    id: 'apimart-images', name: 'APIMart 商品生图', state: 'local', kind: 'dependency',
    summary: '上传参考素材、提交商品生图或编辑任务、查询结果并下载原图。',
    inputs: '本品图片、参考图片、提示词及制图参数',
    outputs: '生成原图、任务记录与实际模型信息',
    steps: ['核对实际素材与修改要求', '上传素材并提交任务', '查询任务和下载原图', '核对尺寸及非目标变化'],
    note: '本机Codex已有此Skill；登记不代表当前工作台可直接生图，不会自动发布店铺。',
  },
];

export function skillDependencies(skill) {
  return (skill.dependencies || []).map(id => workbenchSkills.find(s => s.id === id)).filter(Boolean);
}
export function selectSkillWorkflows(query = '') {
  const q = query.trim().toLowerCase();
  return workbenchSkills.filter(skill => skill.kind === 'workflow' &&
    [skill, ...skillDependencies(skill)].some(item => `${item.name} ${item.id} ${item.summary}`.toLowerCase().includes(q)));
}
