import React, { useRef } from 'react';

// Touch and pen activate on release, including after a captured card drag.
// Ignore a subsequent compatibility click; keyboard activation stays native.
export default function ActionButton({ onClick, disabled, ...props }) {
  const start = useRef(null), activated = useRef(-Infinity);
  return <button {...props} disabled={disabled} onPointerDown={e => {
    if (e.pointerType !== 'mouse') start.current = { x: e.clientX, y: e.clientY };
  }} onPointerCancel={() => { start.current = null; }} onPointerUp={e => {
    const point = start.current; start.current = null;
    if (disabled || e.pointerType === 'mouse' || !point || Math.hypot(e.clientX - point.x, e.clientY - point.y) > 8) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    e.preventDefault(); activated.current = performance.now(); onClick?.(e);
  }} onClick={e => { if (e.detail === 0 || performance.now() - activated.current > 500) onClick?.(e); }} />;
}
