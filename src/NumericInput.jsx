import React from 'react';
import { stepValue } from './table-utils.js';
import ActionButton from './ActionButton.jsx';

export default function NumericInput({ id, label, value, onChange, min = 0, max, step = 1, disabled = false, placeholder, scale = 1 }) {
  const increment = step === 'any' ? 1 : Number(step);
  return <div className="number-control">
    <input id={id} aria-label={label} type="number" min={min / scale} max={max == null ? undefined : max / scale} step={step === 'any' ? step : step / scale} value={value === '' ? '' : Number(value) / scale} disabled={disabled} placeholder={placeholder} onChange={e => onChange(e.target.value === '' ? '' : scale === 1 ? e.target.value : Number((Number(e.target.value) * scale).toFixed(6)))} />
    <span className="value-arrows">
      <ActionButton type="button" aria-label={'增加' + label} disabled={disabled || (value !== '' && Number(value) >= (max ?? Number.MAX_SAFE_INTEGER))} onClick={() => onChange(stepValue(value, 1, increment, max))}>▴</ActionButton>
      <ActionButton type="button" aria-label={'减少' + label} disabled={disabled || (value !== '' && Number(value) <= min)} onClick={() => onChange(Math.max(min, stepValue(value, -1, increment, max)))}>▾</ActionButton>
    </span>
  </div>;
}
