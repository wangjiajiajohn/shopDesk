// Suggestions require explicit selection; they are not inferred product facts.
export function productFunctionOptions(product = {}) {
  const text = `${product.category_name || ''} ${product.title || ''}`;
  if (/文胸|胸罩|胸贴|乳贴/.test(text)) return ['聚拢', '承托', '显丰满', '上提', '侧收', '背部平整'];
  if (/塑身|束身|收腹|瘦身/.test(text)) return ['收腹', '收腰', '提臀', '修饰腰线', '修饰臀线', '平整背部'];
  if (/内裤/.test(text)) return ['包裹臀部', '高腰包覆', '减少勒痕', '无痕穿搭'];
  if (/袜/.test(text)) return ['保暖', '防滑', '弹性包覆', '吸汗'];
  if (/睡衣|家居服/.test(text)) return ['居家穿着', '睡眠穿着', '活动方便', '亲肤触感'];
  return [];
}
