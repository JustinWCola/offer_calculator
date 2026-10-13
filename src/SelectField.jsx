import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function SelectField({ offer, field, label, options, update, wide = false, compact = false }) {
  const id = `${offer.id}-${field}`, button = useRef(null), popup = useRef(null), anchor = useRef(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0), [position, setPosition] = useState({});
  const selected = Math.max(0, options.findIndex(([value]) => String(value) === String(offer.input[field])));
  function show() {
    const rect = button.current.getBoundingClientRect(), height = Math.min(options.length * 38 + 12, 260);
    anchor.current = rect;
    setPosition({ left: Math.min(rect.left, innerWidth - Math.max(rect.width, 210) - 8), width: Math.max(rect.width, 210), top: rect.bottom + height + 8 > innerHeight ? Math.max(8, rect.top - height - 5) : rect.bottom + 5 });
    setActive(selected); setOpen(true);
  }
  function choose(index) { update(field, options[index][0]); setOpen(false); button.current.focus({ preventScroll: true }); }
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!button.current?.contains(e.target) && !popup.current?.contains(e.target)) setOpen(false); };
    const scroll = e => {
      if (popup.current?.contains(e.target)) return;
      const rect = button.current?.getBoundingClientRect();
      if (rect && Math.abs(rect.top - anchor.current.top) > 1) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', close); document.addEventListener('scroll', scroll, true); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize); };
  }, [open]);
  useEffect(() => {
    const list = popup.current, option = list?.children[active];
    if (!open || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [open, active]);
  const keyboard = e => {
    if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
      e.preventDefault(); if (!open) { show(); return; }
      setActive(i => e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) choose(active); else show(); }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
  };
  return <div className={`field ${wide ? 'field-wide' : ''} ${compact ? 'tax-symbol-field' : ''}`}>
    <label className={compact ? 'sr-only' : 'field-label'} id={id + '-label'} htmlFor={id}>{label}</label>
    <button id={id} ref={button} className={compact ? 'tax-symbol' : 'pixel-select'} title={compact ? (label + '：' + options[selected][1]) : undefined} role="combobox" aria-labelledby={id + '-label'} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id + '-options' : undefined} aria-activedescendant={open ? id + '-option-' + active : undefined} onKeyDown={keyboard} onClick={() => open ? setOpen(false) : show()}>
      {compact ? <><span aria-hidden="true">{{ separate: '单', equity: '股', comprehensive: '综', none: '免' }[options[selected][0]]}</span><span className="sr-only">{options[selected][1]}</span></> : <><span>{options[selected][1]}</span><span aria-hidden="true">▾</span></>}
    </button>
    {open && createPortal(<div ref={popup} className="pixel-options" style={position} id={id + '-options'} role="listbox" aria-labelledby={id + '-label'}>
      {options.map(([value, title], index) => <div key={value} id={id + '-option-' + index} role="option" aria-selected={index === selected} className={index === active ? 'active' : ''} onPointerMove={() => setActive(index)} onPointerDown={e => e.preventDefault()} onClick={() => choose(index)}><span>{title}</span><span>{index === selected ? '◆' : ''}</span></div>)}
    </div>, document.body)}
  </div>;
}
