import { ArrowDown, ArrowRight, Check, Eye, MousePointer2, ShoppingBag, PackageCheck, Repeat2, Video, Search, Image, Tags, Wallet, ShieldCheck, Ruler, Truck, Heart, Store, CornerUpLeft, type LucideIcon } from 'lucide-react';
import content from '../data/conversion-funnel.json';

type DiagramStage = { Icon: LucideIcon; factors: { Icon: LucideIcon; title: string; label: string }[]; actions: string[]; metrics: string; outcome: string };
const diagrams: DiagramStage[] = [
  { Icon: Eye, factors: [{ Icon: Video, title: '内容与分发', label: '自有短视频 · 达人 · 广告' }, { Icon: Search, title: '搜索 SEO 与商城', label: '搜索词匹配 · 商品与店铺表现' }], actions: ['做能留住目标买家的内容', '补齐搜索信息，验证获客渠道'], metrics: '曝光 / 触达 · 观看留存 · CPM', outcome: '被合适的人看见' },
  { Icon: MousePointer2, factors: [{ Icon: Image, title: '展示与卖点', label: '主图 · 标题 · 使用场景' }, { Icon: Tags, title: '价格与人群', label: '优惠可见 · 需求匹配' }], actions: ['商品看得清，购买理由说得透', '价格表达清楚，商品与内容一致'], metrics: '商品点击率 CTR · 点击成本 CPC', outcome: '愿意进一步了解' },
  { Icon: ShoppingBag, factors: [{ Icon: Wallet, title: '到手成本', label: '价格 · 运费 · 配送时间' }, { Icon: ShieldCheck, title: '购买信心', label: '评价 · 详情 · 规格 · 库存' }], actions: ['说清到手价、运费与配送', '用实拍和规格解答购买顾虑'], metrics: '支付转化率 · 获客成本 · 单笔利润', outcome: '愿意支付下单' },
  { Icon: PackageCheck, factors: [{ Icon: Ruler, title: '实物与预期', label: '质量 · 尺寸 · 描述一致' }, { Icon: Truck, title: '履约与处理', label: '包装 · 物流 · 客服响应' }], actions: ['质检与准确说明，减少落差', '按退货原因修正，及时解决问题'], metrics: '退货退款率 · 投诉率 · 处理时长', outcome: '收货符合预期' },
  { Icon: Repeat2, factors: [{ Icon: Heart, title: '满意与信任', label: '使用体验 · 服务体验' }, { Icon: Store, title: '再次购买机会', label: '复购周期 · 新款 · 再次触达' }], actions: ['稳定品质和服务，积累信任', '按品类周期触达，提供相关款式'], metrics: '回购率 · 回购周期 · 老客利润', outcome: '愿意再次购买' },
];

export default function ConversionJourney({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  return <figure className="conversion-map" aria-labelledby="conversion-map-caption">
    <figcaption id="conversion-map-caption"><strong>一张图，看清五个经营环节</strong><span>点击中间节点，可在下方展开详细说明</span></figcaption>
    <div className="conversion-map-head" aria-hidden="true"><span>影响因素</span><span>经营路径</span><span>优化动作与观察指标</span></div>
    <ol className="conversion-map-rows">
      {diagrams.map(({ Icon, factors, actions, metrics, outcome }, index) => {
        const inset = index * 20;
        return <li key={content.stages[index].id} className="conversion-map-row" data-active={active === index}>
          <div className="conversion-factor-groups">
            {factors.map(({ Icon: FactorIcon, title, label }) => <div className="conversion-factor" key={title}><FactorIcon size={24} strokeWidth={1.6} aria-hidden="true" /><span><strong>{title}</strong><small>{label}</small></span></div>)}
            <ArrowRight className="conversion-input-arrow" size={20} aria-hidden="true" />
          </div>
          <div className="conversion-band-wrap">
            <button type="button" className="conversion-band" aria-label={`查看${content.stages[index].title}环节`} aria-pressed={active === index} aria-controls="conversion-detail" onClick={() => onSelect(index)}>
              <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="conversion-band-shape" aria-hidden="true"><polygon points={`${inset},0 ${300-inset},0 ${280-inset},120 ${20+inset},120`} /></svg>
              <span className="conversion-band-content"><Icon size={28} strokeWidth={1.6} aria-hidden="true" /><strong>{content.stages[index].title}{active === index && <Check size={16} aria-hidden="true" />}</strong><small>{outcome}</small></span>
            </button>
            {index < diagrams.length - 1 && <ArrowDown className="conversion-stage-arrow" size={16} aria-hidden="true" />}
          </div>
          <div className="conversion-action-group"><ArrowRight className="conversion-output-arrow" size={20} aria-hidden="true" /><ul>{actions.map(action => <li key={action}>{action}</li>)}</ul><p><span>观察</span>{metrics}</p></div>
        </li>;
      })}
    </ol>
    <p className="conversion-map-feedback"><CornerUpLeft size={20} aria-hidden="true" /><strong>反馈到前面</strong><span>售后问题修正商品与承诺，老客需求指导选品与内容</span></p>
    <p className="conversion-map-note">形状为经营路径示意，宽度不代表人数或转化率；达人内容也可获得自然推荐或付费放大。</p>
  </figure>;
}
