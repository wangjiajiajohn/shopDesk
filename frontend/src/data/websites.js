// 常用网站清单（迁移自 Movae websiteBrowser.ts，图标在 /resources/website-logos/）
// aliases 用于和平台账号的 platform 字段做关联匹配
export const WEBSITES = [
  { id: 'tiktok', name: 'TikTok Shop 卖家中心', url: 'https://seller-us.tiktok.com/', icon: 'tiktok.ico', aliases: ['tiktok'] },
  { id: 'mercadolibre', name: '美客多 Mercado Libre', url: 'https://www.mercadolibre.com.mx/', icon: 'mercadolibre.svg', aliases: ['美客多', 'mercadolibre'] },
  { id: 'lingxing', name: '领星 OMS', url: 'https://oms.xlwms.com/', icon: 'lingxing.ico', aliases: ['领星', 'lingxing'] },
  { id: 'mihouse', name: 'Mihouse', url: 'https://mart.jfwms.net/web/dashboard', icon: 'mihouse.svg', aliases: ['mihouse'] },
  { id: 'eco', name: 'ECO 广告代理', url: 'https://business.ecoglobal.vip/ad-account/recharge', icon: 'eco.svg', aliases: ['eco广告', 'ecoglobal'] },
  { id: 'miaoshou', name: '妙手 ERP', url: 'https://erp.91miaoshou.com/', icon: 'miaoshou.ico', aliases: ['妙手', 'miaoshou'] },
  { id: 'topwms', name: '顶妙 WMS', url: 'https://yuanchuanghulian.topwms.com/', icon: 'topwms.ico', aliases: ['顶妙', 'topwms'] },
  { id: 'yuanchuang', name: '深圳源创 ERP', url: 'https://dragonsupply.jfwms.net/web/dashboard', icon: 'yuanchuang.svg', aliases: ['源创', 'yuanchuang'] },
  { id: 'yollgo', name: '友购 Yollgo', url: 'https://app.yollgo.com/', icon: 'yollgo.ico', aliases: ['友购', 'yollgo'] },
  { id: 'feishu', name: '飞书（维亚丝贸）', url: 'https://wcnr7rjsa789.feishu.cn/', icon: 'feishu.ico', aliases: ['飞书', 'feishu', '维亚丝贸'] },
  { id: 'fastmoss', name: 'FastMoss 数据', url: 'https://www.fastmoss.com/', icon: 'fastmoss.ico', aliases: ['fastmoss'] },
  { id: 'chuhaijiang', name: '出海匠', url: 'https://www.chuhaijiang.com/', icon: 'chuhaijiang.svg', aliases: ['出海匠', 'chuhaijiang'] },
  { id: 'zhenghe', name: '郑和数据', url: 'https://www.zhenghedata.com/', icon: 'foke.svg', aliases: ['郑和', 'zhenghe'] },
];

// 根据账号 platform 名称匹配网站
export function matchWebsite(platformName = '') {
  const p = platformName.toLowerCase();
  return WEBSITES.find((w) => w.aliases.some((a) => p.includes(a.toLowerCase()))) || null;
}
