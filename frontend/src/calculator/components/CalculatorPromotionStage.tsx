import { ChevronDown, Megaphone } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = { enabled: boolean; children: ReactNode };
export default function CalculatorPromotionStage({ enabled, children }: Props) {
  return <details className="calculator-promotion-stage" data-locked={!enabled} onFocusCapture={event => {
    const primary = (event.target as Element).closest('.calculator-promotion-primary');
    const result = event.currentTarget.nextElementSibling;
    if (primary && result && result.getBoundingClientRect().bottom > window.innerHeight) primary.scrollIntoView({ block: 'center', behavior: 'auto' });
  }}>
    <summary><Megaphone className="calculator-promotion-icon" aria-hidden="true" /><span className="calculator-promotion-title"><strong>推广成本</strong><small>从利润中扣除，不影响标价</small></span><span className="calculator-promotion-action"><span className="calculator-promotion-show">{enabled ? '设置' : '先定价'}</span><span className="calculator-promotion-hide">收起</span><ChevronDown aria-hidden="true" /></span></summary>
    {!enabled && <p className="calculator-promotion-locked" role="status">先完成定价</p>}
    <fieldset disabled={!enabled} aria-label="推广费用（可选）"><div inert={!enabled}>{children}</div></fieldset>
  </details>;
}
