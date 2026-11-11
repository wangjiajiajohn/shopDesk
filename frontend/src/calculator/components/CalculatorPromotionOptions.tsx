import type { ReactNode } from 'react';
import type { CalculatorValues } from '../breakEven';
import CalculatorTabs from './CalculatorTabs';

type Source = 'creator' | 'external';
type Props = {
  source: Source;
  onSourceChange: (source: Source) => void;
  input: (id: keyof CalculatorValues, label: string, description?: string) => ReactNode;
};
const sources = [['creator', '达人'], ['external', '外部流量']] as const;
export default function CalculatorPromotionOptions({ source, onSourceChange, input }: Props) {
  return <details className="calculator-panel"><summary>后期推广费用 · 默认不使用</summary>
    
    <div className="calculator-promotion-inputs">
      <div>{input('roi', '广告 ROI')}</div>
      <div className="calculator-commission-row"><CalculatorTabs id="calc-commission-source" label="佣金来源" value={source} options={sources} onChange={onSourceChange}>{input(source, '佣金率')}</CalculatorTabs></div>
    </div>
    <p className="calculator-note calculator-promotion-note">ROI 或佣金率为 0 时不计费；启用后计入实际成本，压缩利润，不抬高基础建议价。</p>
  </details>;
}
