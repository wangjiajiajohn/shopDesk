import { SlidersHorizontal, X } from 'lucide-react';
import { useCalculatorMobile } from '../useCalculatorMobile';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export default function CalculatorCostSidebar({ children, mobileSettings, open, setOpen, canFinish }: { children: ReactNode; mobileSettings?: ReactNode; open: boolean; setOpen: (open: boolean) => void; canFinish: boolean }) {
  const mobile = useCalculatorMobile();
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Tab') setKeyboardFocus(true); };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { if (!mobile) setOpen(false); }, [mobile, setOpen]);
  useLayoutEffect(() => {
    if (!mobile || !open || !dialog.current) return;
    const body = document.body;
    const root = document.documentElement;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow };
    const previousAnchor = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';
    // Freeze the visual page as well as touch scrolling while the keyboard is open.
    Object.assign(body.style, { position: 'fixed', top: `${-scroll.y}px`, left: `${-scroll.x}px`, width: '100%', overflow: 'hidden' });
    dialog.current.showModal();
    dialog.current.focus({ preventScroll: true });
    return () => {
      Object.assign(body.style, previous);
      window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
      requestAnimationFrame(() => {
        entry.current?.focus({ preventScroll: true });
        window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
        root.style.overflowAnchor = previousAnchor;
      });
    };
  }, [mobile, open]);
  const finishClose = () => {
    window.clearTimeout(closeTimer.current);
    dialog.current?.close();
    closing.current = false;
    setIsClosing(false);
    setOpen(false);
  };
  const close = () => {
    const panel = dialog.current;
    if (!panel?.open || closing.current) return;
    if (document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)) document.activeElement.blur();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return; }
    closing.current = true;
    setIsClosing(true);
    // Keep the native dialog and scroll lock alive through the CSS exit animation.
    const duration = parseFloat(getComputedStyle(panel).getPropertyValue('--calculator-drawer-exit-duration'));
    closeTimer.current = window.setTimeout(finishClose, (Number.isFinite(duration) ? duration : 240) + 100);
  };
  if (!mobile) return <div className="calculator-decision-inputs">{children}</div>;
  return <div className="calculator-cost-access" onPointerDownCapture={() => setKeyboardFocus(false)}>
    <button ref={entry} type="button" className="calculator-cost-entry" data-keyboard-focus={keyboardFocus} onKeyDown={() => setKeyboardFocus(true)} aria-label="成本设置" title="成本设置" aria-haspopup="dialog" aria-expanded={open} aria-controls="calculator-cost-sidebar" onClick={() => setOpen(true)}><span className="calculator-cost-entry-pill"><SlidersHorizontal aria-hidden="true" /><span>成本设置</span></span></button>
    <dialog ref={dialog} id="calculator-cost-sidebar" className="calculator-cost-sidebar" data-closing={isClosing} onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'calculator-cost-exit') finishClose(); }} tabIndex={-1} aria-labelledby="calculator-cost-sidebar-heading" onPointerDown={event => {
      swipe.current = event.pointerType === 'touch' && !(event.target as Element).closest('input, button, select, summary, [role="listbox"]') ? { x: event.clientX, y: event.clientY } : null;
    }} onPointerCancel={() => { swipe.current = null; }} onPointerUp={event => {
      const start = swipe.current;
      swipe.current = null;
      if (start && event.clientX - start.x > 48 && Math.abs(event.clientY - start.y) < (event.clientX - start.x) / 2) close();
    }} onClose={() => { closing.current = false; setIsClosing(false); setOpen(false); }} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX > box.right || event.clientX < box.left || event.clientY < box.top || event.clientY > box.bottom) close(); } }}>
      <header className="calculator-cost-sidebar-heading"><h2 id="calculator-cost-sidebar-heading">第一步 · 定价</h2><button type="button" className="calculator-cost-close" aria-label="关闭成本设置" onClick={close}><span><X aria-hidden="true" strokeWidth={2} /></span></button></header>
      <div className="calculator-cost-sidebar-body">
        {mobileSettings}
        <div className="calculator-decision-inputs">{children}</div>
      </div>
      <footer className="calculator-cost-sidebar-footer"><button type="button" className="calculator-cost-toggle calculator-cost-done" disabled={!canFinish} onClick={close}>完成，查看定价结果</button></footer>
    </dialog>
  </div>;
}
