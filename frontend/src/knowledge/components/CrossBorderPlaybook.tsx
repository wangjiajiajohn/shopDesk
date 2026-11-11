import StrategyDocument from './StrategyDocument';
import playbook from '../data/cross-border-playbook.json';
import PlaybookOverview from './PlaybookOverview';

export default function CrossBorderPlaybook() {
  return <section className="page-content strategies-page" aria-labelledby="cross-border-heading">
    <h1 id="cross-border-heading">跨境电商打法</h1>
    <PlaybookOverview />
    <details className="playbook-record"><summary>查看详细说明与讨论记录</summary><StrategyDocument strategy={playbook} label="跨境电商打法" /></details>
  </section>;
}
