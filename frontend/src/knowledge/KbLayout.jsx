import React from 'react';

// 知识库作用域设计系统与六个专题样式（从原 KnowledgeView 迁移，保证只在知识库页面生效）
import './styles/kb-scope.css';
import './styles/strategies.css';
import './styles/conversion-funnel.css';
import './styles/platform-capabilities.css';
import './styles/merchant-enrollment.css';
import './styles/supplier-channels.css';
import './styles/playbook.css';

// 所有 Movae 知识库页面运行在独立设计系统作用域内，避免玫红主题污染工作台
export default function KbLayout({ children }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">知识库</h2>
        <p className="text-xs text-slate-500 mt-0.5">运营方法论与平台资料 · 从 Movae 整体迁入</p>
      </div>
      <div className="kb-scope">{children}</div>
    </div>
  );
}
