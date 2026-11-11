import { useState } from 'react';
import ConversionJourney from './ConversionJourney';
import ConversionTrafficGuide from './ConversionTrafficGuide';
import content from '../data/conversion-funnel.json';
import '../styles/conversion-funnel.css';

export default function ConversionFunnel() {
  const [active, setActive] = useState(0);
  const stage = content.stages[active];
  return <section className="page-content strategies-page conversion-page" aria-labelledby="conversion-heading">
    <h1 id="conversion-heading">经营转化漏斗</h1>
    <p className="conversion-intro">从被看见到再次购买，找到每一步的影响因素与优化动作。</p>
    <ConversionJourney active={active} onSelect={setActive} />
    <ConversionTrafficGuide />
    <details className="conversion-reading" id="conversion-detail">
      <summary>展开「{stage.title}」的详细因素、动作与指标</summary>
    <section className="conversion-detail" aria-live="polite" aria-labelledby="conversion-detail-heading">
      <header><h2 id="conversion-detail-heading">{stage.title}<span>{stage.question}</span></h2></header>
      <div className="conversion-columns">
        <section><h3>哪些因素影响</h3><ul>{stage.factors.map(text => <li key={text}>{text}</li>)}</ul></section>
        <section><h3>可以怎么优化</h3><ul>{stage.actions.map(text => <li key={text}>{text}</li>)}</ul></section>
        <section><h3>重点观察指标</h3><ul>{stage.metrics.map(text => <li key={text}>{text}</li>)}</ul></section>
      </div>
      <p className="conversion-note">{stage.note}</p>
    </section>
    </details>
    <details className="conversion-reading">
      <summary>问题诊断：遇到瓶颈先改哪里</summary>
    <section className="conversion-diagnosis" aria-labelledby="conversion-diagnosis-heading">
      <h2 id="conversion-diagnosis-heading">遇到问题，先改哪里</h2>
      <p>优先解决损失最大的环节；成交与售后稳定后，再扩大获客投入。</p>
      <div className="conversion-table-scroll" role="region" aria-label="经营问题诊断表，可横向滚动" tabIndex={0}>
        <table><caption>经营现象、优先环节与排查动作对照</caption>
          <thead><tr><th scope="col">经营现象</th><th scope="col">优先环节</th><th scope="col">排查与优化</th></tr></thead>
          <tbody>{content.diagnosis.map(([problem, node, action]) => <tr key={problem}><th scope="row">{problem}</th><td>{node}</td><td>{action}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
    </details>
    <details className="conversion-definitions"><summary>指标口径与使用说明</summary>
      <ul>
        <li>商品点击率＝商品点击次数÷对应商品曝光次数；点击后支付转化率＝支付买家数÷商品点击人数。以平台实际口径为准，比较时保持时间、人群、次数或人数口径一致。</li>
        <li>视频播放量、商品曝光量与去重触达人数不同；达人是内容来源，广告是分发方式，不应把重叠渠道直接相加。</li>
        <li>取消、退款、退货及回购应按同一订单批次或客户队列观察，并留足售后和复购时间，避免用今日退款除以今日订单。</li>
        <li>店铺表现、商品表现、内容表现和用户匹配分别起作用，不能用一个“店铺权重”概括全部排序。</li>
        <li>Product GMV Max 的归因可包含自然与达人订单；后台ROI不等于纯广告新增回报或净利润。同时观察实际结算收入及商品、平台、履约、售后、达人和广告成本。</li>
        <li>本页为本次讨论整理的经营方法，收录于2026年10月25日，以墨西哥TikTok Shop场景为主。功能和指标以当地店铺后台为准，不将国内抖音规则直接套用。</li>
      </ul>
      <p>平台依据：<a href="https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content" target="_blank" rel="noreferrer">TikTok推荐机制</a>、<a href="https://ads.tiktok.com/resources/help/article/creative-best-practices" target="_blank" rel="noreferrer">广告创意建议</a>、<a href="https://ads.tiktok.com/resources/help/article/about-product-gmv-max" target="_blank" rel="noreferrer">Product GMV Max说明</a>。</p>
    </details>
  </section>;
}
