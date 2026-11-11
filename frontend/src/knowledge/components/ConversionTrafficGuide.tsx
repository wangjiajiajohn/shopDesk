import { ArrowLeftRight, ArrowRight, Eye, MousePointer2, ShoppingBag, PackageCheck, MapPin, Users, Megaphone, Search } from 'lucide-react';

const dimensions = [
  { Icon: MapPin, name: '流量入口', categories: ['推荐短视频', '搜索', '商城/商品卡', '直播', '店铺主页'], purpose: '判断客户从哪里来' },
  { Icon: Users, name: '内容来源', categories: ['店铺自己', '合作达人', '其他用户'], purpose: '判断谁能提供有效内容' },
  { Icon: Megaphone, name: '分发方式', categories: ['自然推荐', '付费投放'], purpose: '判断流量如何获得' },
];
const factors = [
  { Icon: Eye, label: '商品曝光量' },
  { Icon: MousePointer2, label: '商品点击率' },
  { Icon: ShoppingBag, label: '点击后支付率' },
  { Icon: PackageCheck, label: '（1－退货率）' },
];

export default function ConversionTrafficGuide() {
  return <section className="conversion-traffic-guide" aria-labelledby="conversion-traffic-heading">
    <h2 id="conversion-traffic-heading">把流量与转化连起来</h2>
    <figure className="conversion-equation" aria-labelledby="conversion-equation-caption">
      <figcaption id="conversion-equation-caption">留存订单怎么估算</figcaption>
      <div className="conversion-equation-flow" role="math" aria-label="留存订单约等于商品曝光量乘以商品点击率乘以点击后支付率乘以一减退货率">
        <strong className="conversion-equation-result"><PackageCheck size={24} aria-hidden="true" />留存订单</strong>
        <span className="conversion-math-symbol" aria-hidden="true">≈</span>
        {factors.map(({ Icon, label }, index) => <span className="conversion-equation-factor" key={label}>
          {index > 0 && <span className="conversion-math-symbol" aria-hidden="true">×</span>}
          <span><Icon size={24} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></span>
        </span>)}
      </div>
      <p>同一批次、统计口径一致时的简化估算；未单列取消、仅退款等因素。</p>
    </figure>

    <section className="conversion-traffic-dimensions" aria-labelledby="conversion-dimensions-heading">
      <h3 id="conversion-dimensions-heading">看流量，用三个维度</h3>
      <table>
        <caption>同一笔订单可同时属于不同维度，不能把重叠渠道直接相加。</caption>
        <thead><tr><th scope="col">维度</th><th scope="col">分类</th><th scope="col">用途</th></tr></thead>
        <tbody>{dimensions.map(({ Icon, name, categories, purpose }) => <tr key={name}>
          <th scope="row"><span className="conversion-dimension-name"><Icon size={24} strokeWidth={1.6} aria-hidden="true" />{name}</span></th>
          <td><ul>{categories.map(category => <li key={category}>{category}</li>)}</ul></td>
          <td>{purpose}</td>
        </tr>)}</tbody>
      </table>
    </section>

    <figure className="conversion-seo" aria-labelledby="conversion-seo-heading">
      <figcaption id="conversion-seo-heading"><Search size={24} strokeWidth={1.6} aria-hidden="true" /><h3>SEO · 搜索匹配优化</h3></figcaption>
      <p>搜索更重视内容与搜索词的匹配程度。</p>
      <div className="conversion-seo-flow"><strong>买家搜索词</strong><ArrowLeftRight size={24} aria-label="匹配" /><span>标题 · 类目 · 属性 · 内容</span><ArrowRight size={24} aria-label="关联" /><strong>相关商品</strong></div>
      <p className="conversion-seo-note">准确覆盖真实需求，避免堆砌无关词；匹配不保证排名，点击与成交仍取决于商品和承接。</p>
    </figure>
  </section>;
}
