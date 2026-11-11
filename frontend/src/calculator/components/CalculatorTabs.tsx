import { useRef, type ReactNode } from 'react';

type Props<T extends string> = { id: string; label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void; children: ReactNode };
export default function CalculatorTabs<T extends string>({ id, label, value, options, onChange, children }: Props<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return <>
    <div className="calculator-tabs" role="tablist" aria-label={label}>
      {options.map(([key, text], index) => <button key={key} ref={node => { buttons.current[index] = node; }} type="button" role="tab" id={`${id}-tab-${key}`} aria-selected={value === key} aria-controls={`${id}-panel`} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowLeft' ? (index + options.length - 1) % options.length : event.key === 'ArrowRight' ? (index + 1) % options.length : null;
        if (next !== null) { event.preventDefault(); onChange(options[next][0]); buttons.current[next]?.focus(); }
      }}>{text}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value}`}>{children}</div>
  </>;
}
