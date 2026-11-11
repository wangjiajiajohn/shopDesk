
type StrategyContent = {
  title: string;
  subtitle: string;
  sourceFile: string;
  sourceNote?: string;
  groups?: { id: string; heading: string; sectionIds: string[] }[];
  sections: { id: string; heading: string; blocks: { type: string; text: string }[] }[];
};

export default function StrategyDocument({ strategy, label }: { strategy: StrategyContent; label: string }) {
  const content = (section: StrategyContent['sections'][number]) => section.blocks[0]?.type === 'bullet'
    ? <ul>{section.blocks.map((block, index) => <li key={index}>{block.text}</li>)}</ul>
    : section.blocks.map((block, index) => <p key={index}>{block.text}</p>);
  const groups = strategy.groups?.map(group => ({ ...group, sections: strategy.sections.filter(section => group.sectionIds.includes(section.id)) }));
  return <div className="strategy-document-strategy">
    <header className="strategy-document-heading">
      <h2>{strategy.title}</h2>
      <p>{strategy.subtitle}</p>
      <p className="strategy-document-source">{strategy.sourceNote ?? `来源：${strategy.sourceFile} · 用户提供`}</p>
    </header>
    <div className="strategy-document-layout">
      <nav className={`strategy-document-contents${groups ? ' strategy-document-contents-grouped' : ''}`} aria-label={`${label}章节`}>
        {groups ? groups.map(group => <div className="strategy-index-group" key={group.id}>
          <a className="strategy-index-parent" href={`#${group.id}`}>{group.heading}</a>
          <ul>{group.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.heading}</a></li>)}</ul>
        </div>) : strategy.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.heading}</a>)}
      </nav>
      <article className="strategy-document-article" aria-label={`${label}正文`}>
        {groups ? groups.map(group => <section className="strategy-document-group" key={group.id} id={group.id} tabIndex={-1} aria-labelledby={`${group.id}-heading`}>
          <h3 id={`${group.id}-heading`}>{group.heading}</h3>
          {group.sections.map(section => <section key={section.id} id={section.id} tabIndex={-1} aria-labelledby={`${section.id}-heading`}>
            <h4 id={`${section.id}-heading`}>{section.heading}</h4>{content(section)}
          </section>)}
        </section>) : strategy.sections.map(section => <section key={section.id} id={section.id} tabIndex={-1} aria-labelledby={`${section.id}-heading`}>
          <h3 id={`${section.id}-heading`}>{section.heading}</h3>
          {content(section)}
        </section>)}
      </article>
    </div>
  </div>;
}
