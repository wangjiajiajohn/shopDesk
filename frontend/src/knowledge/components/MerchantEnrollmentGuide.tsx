import { ArrowUpRight } from 'lucide-react';
import guide from '../data/merchant-enrollment.json';
import '../styles/merchant-enrollment.css';

export default function MerchantEnrollmentGuide() {
  const chapters = guide.toc.filter(item => item.level === 1);
  return <section className="page-content strategies-page merchant-enrollment-page" aria-labelledby="merchant-enrollment-heading">
    <h1 id="merchant-enrollment-heading">商家入驻指南</h1>
    <header className="strategy-document-heading merchant-enrollment-source">
      <h2>{guide.title}</h2>
      <p>来源：{guide.sourceAuthor} · <a href={guide.sourceUrl} target="_blank" rel="noopener noreferrer">查看飞书原文 <ArrowUpRight size={14} aria-hidden="true" /></a></p>
      <p className="strategy-document-source">原文最近修改：{guide.sourceModifiedLabel} · 收录日期：{guide.importedOn} · 已保存正文、表格、{guide.imageCount} 张配图及文内链接。</p>
      <p className="strategy-document-source">以下为收录时的原文快照。政策、资质、税务与费用等表述保留原文口径；后续变化以来源文档及平台最新公告为准。</p>
    </header>
    <div className="strategy-document-layout">
      <nav className="strategy-document-contents" aria-label="商家入驻指南章节">
        {chapters.map((item, index) => <a key={item.id} href={`#${item.id}`}>{index === 0 ? '入驻联系信息与注意事项' : item.title}</a>)}
      </nav>
      {/* Generated from the archived Markdown with source HTML escaped and only line breaks restored. */}
      <article className="strategy-document-article merchant-enrollment-article" aria-label="墨西哥商家入驻指南原文" dangerouslySetInnerHTML={{ __html: guide.html }} />
    </div>
  </section>;
}
