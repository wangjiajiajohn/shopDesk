import { ArrowRight, CornerUpLeft, PackageSearch, Video, BarChart3, RefreshCw, Truck, Bot } from 'lucide-react';
import '../styles/playbook.css';

const stages = [
  { title: '选品', note: '市场需求 × 本地货源', Icon: PackageSearch },
  { title: '短视频制作', note: '展示价值 · 测试内容', Icon: Video },
  { title: '效果反馈', note: '流量 · 成交 · 利润 · 投入', Icon: BarChart3 },
  { title: '持续优化', note: '调整商品与内容，再测试', Icon: RefreshCw },
];

export default function PlaybookOverview() {
  return <div className="playbook-overview">
    <header className="playbook-position">
      <h2>以 AI 为核心的 OPC 跨境公司</h2>
      <p>用自动化提高效率，用持续试错与迭代实现商业目标。</p>
      <div className="playbook-roadmap" aria-label="发展路径">
        <span><strong>前期</strong>服务自己的公司</span><ArrowRight size={20} aria-hidden="true" />
        <span><strong>后期</strong>形成产品与服务</span>
      </div>
    </header>
    <section className="playbook-basis" aria-labelledby="playbook-basis-heading">
      <h2 id="playbook-basis-heading">当前基础 · 低成本本地分销</h2>
      <dl>
        <div><dt>本地供给</dt><dd>约 8000 种商品 / 20 个品类</dd></div>
        <div><dt>供应商代办</dt><dd>代采购、代发货</dd></div>
        <div><dt>服务费</dt><dd>人民币 5 元 / 件</dd></div>
      </dl>
    </section>
    <figure className="playbook-loop" aria-labelledby="playbook-loop-heading">
      <figcaption><h2 id="playbook-loop-heading">当前优先建设的核心循环</h2><p>先把核心做好，再逐步扩展自动化。</p></figcaption>
      <ol>
        {stages.map(({ title, note, Icon }, index) => <li key={title}>
          <Icon size={28} strokeWidth={1.7} aria-hidden="true" /><h3>{title}</h3><p>{note}</p>
          {index < stages.length - 1 && <ArrowRight className="playbook-loop-arrow" size={24} aria-hidden="true" />}
        </li>)}
      </ol>
      <div className="playbook-feedback"><CornerUpLeft size={20} aria-hidden="true" /><span>结果回到选品与内容，进入下一轮验证</span></div>
      <p className="playbook-ai"><Bot size={20} aria-hidden="true" />AI 贯穿各环节：整理信息、辅助判断、制作内容、分析反馈。具体分工待细化。</p>
    </figure>
    <section className="playbook-support" aria-labelledby="playbook-support-heading">
      <Truck size={24} aria-hidden="true" />
      <div><h2 id="playbook-support-heading">支撑节点 · 后续逐步自动化</h2><p>上架、采购、发货、售后、财务。供应商目前在采购、发货时联系。</p></div>
    </section>
    <p className="playbook-next"><strong>数据能力核查</strong>FastMoss 本轮结果已收录于「知识库 → 平台能力收集」；口径与长期历史仍有缺口。</p>
  </div>;
}
