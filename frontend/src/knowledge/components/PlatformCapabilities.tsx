import { ArrowRight, Database, SearchCheck, ListChecks } from 'lucide-react';
import { useState } from 'react';
import collection from '../data/platform-capabilities.json';
import chuhaijiang from '../data/chuhaijiang-capabilities.json';
import tiktokShop from '../data/tiktok-shop-capabilities.json';
import '../styles/platform-capabilities.css';

const platforms = {
  fastmoss: { name: 'FastMoss', status: '初步盘点 · 待补全', account: '全球市场标准版', conclusion: '已收集部分页面与字段，完整目录仍待补齐', audit: collection },
  chuhaijiang: { name: '出海匠', status: '详细盘点进行中', account: 'Safari 已登录账号 · 完整套餐待核实', conclusion: '已扩展全平台目录与字段清单，未核实项逐项保留', audit: chuhaijiang },
  tiktokShop: { name: 'TikTok Shop 商家中心', status: '详细盘点进行中', account: '紫鸟 · 已登录墨西哥店铺', conclusion: '已按功能层级展开，逐项记录字段与核查状态', audit: tiktokShop },
};

export default function PlatformCapabilities() {
  const [selected, setSelected] = useState<keyof typeof platforms>('fastmoss');
  const { name: platformName, account, conclusion, audit } = platforms[selected];
  const isAssessment = (heading: string) => heading.includes('与现有选品策略');
  const inventory = audit.sections.filter(section => section.heading !== '结论' && section.heading !== '收集状态' && !isAssessment(section.heading));
  const assessments = audit.sections.filter(section => isAssessment(section.heading));
  return <section className="page-content strategies-page capability-page" aria-labelledby="capability-heading">
    <h1 id="capability-heading">平台能力收集</h1>
    <p className="capability-intro">当前先完整收集功能与数据，核对缺口后，再评估价值、重点与适用性。</p>
    <div className="capability-method" aria-label="评估路径">
      <span><Database size={20} aria-hidden="true" />完整收集</span><ArrowRight size={18} aria-hidden="true" />
      <span><SearchCheck size={20} aria-hidden="true" />核对缺口</span><ArrowRight size={18} aria-hidden="true" />
      <span><ListChecks size={20} aria-hidden="true" />评估价值与重点</span>
    </div>
    <nav className="capability-progress" aria-label="选择平台核查记录">
      {(Object.keys(platforms) as (keyof typeof platforms)[]).map(id => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}><strong>{platforms[id].name}</strong><span>{platforms[id].status}</span></button>)}
      <div><strong>郑和数据</strong><span>待调研 · 等待指令</span></div>
    </nav>
    <article key={selected} aria-labelledby="platform-audit-heading">
      <header className="capability-header"><h2 id="platform-audit-heading">{platformName}</h2><p>墨西哥市场 · {account} · 核查于 2026年10月15日</p></header>
      <div className="capability-conclusion"><strong>{conclusion}</strong><p>当前阶段：能力收集。清单按模块、子功能、筛选项、数据字段及获取条件展开；未核查项保留在目录中，完成收集后再开展评估。</p></div>
      {inventory.map((section, index) => <details className="capability-section" key={section.heading} open={index < 2}>
        <summary>{section.heading}</summary>
        {section.headers.length > 0 && <div className="capability-table-scroll" role="region" aria-label={section.heading} tabIndex={0}>
          <table aria-label={section.heading}><thead><tr>{section.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
            <tbody>{section.rows.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>}
        <div className="capability-notes">{section.paragraphs.map(text => <p key={text}>{text}</p>)}</div>
        {section.sources.length > 0 && <ul className="capability-sources">{section.sources.map(source => <li key={source.url}>{source.url.startsWith('https://seller-mx.tiktok.com/') && !source.url.includes('/university/') ? <span>{source.label} · 在紫鸟店铺环境查看</span> : <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>}</li>)}</ul>}
      </details>)}
      <details className="capability-section">
        <summary>此前初步判断 · 待完整收集后复核</summary>
        <p>以下保留此前讨论记录，不作为本阶段的最终评估结论。</p>
        {audit.sections.filter(section => section.heading === '结论').map(section => <p key={section.heading}>{section.paragraphs[0]}</p>)}
        {assessments.map(section => <div key={section.heading} className="capability-table-scroll" role="region" aria-label="此前策略对应记录" tabIndex={0}>
          <table><caption>{section.heading}</caption><thead><tr>{section.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
            <tbody>{section.rows.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>)}
      </details>
    </article>
  </section>;
}
