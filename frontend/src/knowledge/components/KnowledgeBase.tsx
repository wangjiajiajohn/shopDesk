import { useState } from 'react';
import { ArrowDown, ArrowUp, Target, Network, ListTree, Combine, RefreshCw } from 'lucide-react';
import methodologyDocument from '../方法论.md?raw';
import guide from '../data/methodology-guide.json';

const steps = methodologyDocument.trim().split('\n').filter(Boolean).slice(1).map(line => {
  const [, title, description] = line.replace(/^\d+\. /, '').split('**');
  return { title, description: description.replace(/^：/, '') };
});
const icons = [Target, Network, ListTree, Combine, RefreshCw];

export default function KnowledgeBase() {
  const [active, setActive] = useState(0);
  const ActiveIcon = icons[active];
  return <section className="page-content strategies-page methodology-page" aria-labelledby="methodology-heading">
    <h1 id="methodology-heading">万能心法</h1>
    <p className="methodology-intro">明确目标 → 建立全貌 → 逐项细化 → 形成方案 → 执行修正</p>
    <section className="methodology-rationale" aria-labelledby="methodology-why-heading">
      <h2 id="methodology-why-heading">为什么按这个顺序推进</h2>
      <p>{guide.why}</p>
    </section>
    <div className="methodology-layout">
      <figure className="methodology-diagram" aria-labelledby="methodology-caption">
        <figcaption id="methodology-caption">方法论 · 从整体到细节，再用实践修正</figcaption>
        <ol className="methodology-flow">
          {steps.map((step, index) => {
            const Icon = icons[index];
            return <li key={step.title}>
              <button aria-pressed={active === index} aria-controls="methodology-detail" onClick={() => setActive(index)}>
                <span className="methodology-node-icon"><Icon size={24} strokeWidth={1.7} aria-hidden="true" /></span>
                <span><span className="methodology-step">{index + 1} / {steps.length}</span><strong>{step.title}</strong></span>
              </button>
              {index < steps.length - 1 && <ArrowDown className="methodology-connector" size={24} aria-hidden="true" />}
            </li>;
          })}
        </ol>
        <button className="methodology-return" onClick={() => setActive(0)} aria-label="返回查看明确目标与范围">
          <ArrowUp size={18} aria-hidden="true" /><span>实践反馈 · 回到前面的阶段调整</span>
        </button>
      </figure>
      <section id="methodology-detail" className="methodology-detail" aria-live="polite" aria-labelledby="methodology-detail-heading">
        <ActiveIcon size={32} strokeWidth={1.7} aria-hidden="true" />
        <p className="methodology-position">查看第 {active + 1} 阶段</p>
        <h2 id="methodology-detail-heading">{steps[active].title}</h2>
        <p>{steps[active].description}</p>
        <div className="methodology-instructions">
          <h3>为什么做这一步</h3>
          <p>{guide.steps[active].why}</p>
          <h3>这一步具体做什么</h3>
          <ul>{guide.steps[active].actions.map(action => <li key={action}>{action}</li>)}</ul>
          <h3>这一步形成什么结果</h3>
          <p>{guide.steps[active].output}</p>
        </div>
      </section>
    </div>
  </section>;
}
