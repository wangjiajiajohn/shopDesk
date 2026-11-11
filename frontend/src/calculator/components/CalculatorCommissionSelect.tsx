import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, UsersRound, Network } from 'lucide-react';

export type CommissionSource = 'creator' | 'external';
const currencies = [
  { code: 'creator', name: '达人带货', Icon: UsersRound },
  { code: 'external', name: '外部流量', Icon: Network },
] as const;
export default function CalculatorCommissionSelect({ id, label, value, onChange }: { id: string; label: string; value: CommissionSource; onChange: (value: CommissionSource) => void }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width?: number }>({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = trigger.current, popup = menu.current;
      if (!button || !popup) return;
      const rect = button.closest('.calculator-input-group')!.getBoundingClientRect();
      const styles = getComputedStyle(button);
      const margin = parseFloat(styles.getPropertyValue('--space-4'));
      const gap = parseFloat(styles.getPropertyValue('--space-2'));
      const drawer = button.closest('dialog, .calculator-promotion-stage')?.getBoundingClientRect();
      const leftBound = drawer ? drawer.left + margin : margin;
      const rightBound = drawer ? drawer.right - margin : innerWidth - margin;
      // A drawer menu follows the field width, and stays inside the drawer.
      const width = Math.min(drawer ? rect.width : popup.getBoundingClientRect().width, rightBound - leftBound);
      popup.style.width = `${width}px`;
      const { height } = popup.getBoundingClientRect();
      const below = rect.bottom + gap;
      setPosition({ width, left: Math.max(leftBound, Math.min(rect.right - width, rightBound - width)), top: Math.max(margin, below + height <= innerHeight - margin ? below : rect.top - gap - height) });
    };
    place();
    options.current[currencies.findIndex(currency => currency.code === value)]?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="calculator-input-group">
    <button ref={trigger} type="button" id={`${id}-currency-trigger`} className="calculator-currency-trigger calculator-channel-trigger" aria-label={`${label}，当前${currencies.find(item => item.code === value)?.name}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-currency-menu` : undefined} onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }}><span>{currencies.find(item => item.code === value)?.name}</span><ChevronDown aria-hidden="true" /></button>
    {open && createPortal(<div ref={menu} id={`${id}-currency-menu`} className="calculator-currency-menu calculator-page" role="listbox" aria-labelledby={`${id}-currency-trigger`} style={position}>
      {currencies.map(({ code, name, Icon }, index) => <button key={code} ref={node => { options.current[index] = node; }} type="button" role="option" tabIndex={-1} aria-selected={value === code} onClick={() => { onChange(code); setOpen(false); trigger.current?.focus(); }} onKeyDown={event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? currencies.length - 1 : event.key === 'ArrowDown' ? (index + 1) % currencies.length : event.key === 'ArrowUp' ? (index + currencies.length - 1) % currencies.length : null;
        if (next !== null) { event.preventDefault(); options.current[next]?.focus(); }
        if (event.key === 'Tab') { setOpen(false); trigger.current?.focus(); }
      }}><span className="calculator-currency-symbol"><Icon aria-hidden="true" /></span><span className="calculator-currency-name">{name}</span><span className="calculator-currency-code" aria-hidden="true" /><span className="calculator-currency-check">{value === code && <Check aria-hidden="true" />}</span></button>)}
    </div>, trigger.current?.closest('dialog, .calculator-promotion-stage') ?? document.body)}
  </div>;
}
