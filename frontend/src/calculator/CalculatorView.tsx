import React from 'react';
import BreakEvenCalculator from './components/BreakEvenCalculator';
import './tokens.css';
import './calculator.css';
import './calculator-decision.css';

class CalculatorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="calculator-public-error">
        <h1>计算器暂时无法显示</h1>
        <button onClick={() => location.reload()}>重新加载</button>
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function CalculatorView() {
  return (
    <CalculatorBoundary>
      <BreakEvenCalculator />
    </CalculatorBoundary>
  );
}
