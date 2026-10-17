import React from 'react';

// Paths, rather than font glyphs, keep icons monochrome on every platform.
const paths = {
  close: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h11v11H9zM5 15H3V3h12v2',
  reset: 'M4 10a8 8 0 1 1 1 8M4 3v7h7',
  undo: 'M9 5L3 11l6 6M3 11h11a6 6 0 0 1 6 6',
  external: 'M7 17L19 5M7 5h12v12',
  up: 'M12 20V4M5 11l7-7 7 7',
  down: 'M12 4v16M5 13l7 7 7-7',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4M12 18v1',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
};
const fills = {
  spade: 'M12 2C9 6 3 9 3 14a5 5 0 0 0 8 4l-2 4h6l-2-4a5 5 0 0 0 8-4c0-5-6-8-9-12Z',
  heart: 'M12 21L3 12C-2 5 7 0 12 6c5-6 14-1 9 6Z',
  diamond: 'M12 2l9 10-9 10-9-10Z',
  club: 'M12 2a5 5 0 0 0-4 8 5 5 0 1 0 3 8l-2 4h6l-2-4a5 5 0 1 0 3-8 5 5 0 0 0-4-8Z',
  caretUp: 'M5 16l7-9 7 9Z',
  caretDown: 'M5 8l7 9 7-9Z',
};
export default function Icon({ name, className = '' }) {
  return <svg className={'ui-icon ' + className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill={fills[name] ? 'currentColor' : 'none'} stroke={fills[name] ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={fills[name] || paths[name]} />
    {name === 'settings' && <circle cx="12" cy="12" r="3" />}
  </svg>;
}
