import React from 'react';
import { selectorStability } from '@sdk/stability.js';

export function Preview({ from, to, compact }) {
  return (
    <span className={'pv' + (compact ? ' compact' : '')}>
      <span className="pv-from">{from}</span>
      <span className="pv-arrow">→</span>
      <span className="pv-to">{to}</span>
    </span>
  );
}

const STAB = {
  stable: { icon: '●', text: 'Stable' },
  warning: { icon: '▲', text: 'Unstable' },
  fragile: { icon: '▲', text: 'Fragile' },
  invalid: { icon: '✕', text: 'Not valid' },
};

/** How reliable a selector is, in plain words. */
export function Stability({ selector, long }) {
  if (!selector) return null;
  const s = selectorStability(selector);
  const t = STAB[s.level];
  return (
    <span className={'stab ' + s.level} title={s.reason}>
      {t.icon} {t.text} <span className="stab-why">{s.reason}</span>
      {long && s.level !== 'stable' && s.level !== 'invalid' && <span className="stab-tip"> · prefer an id, name or class</span>}
    </span>
  );
}

/** A small error/warning marker for a table row, with the messages as a tooltip. */
export function RowIssues({ issues, errorsOnly }) {
  if (issues && errorsOnly) issues = { errors: issues.errors, warnings: [] };
  if (!issues || (!issues.errors.length && !issues.warnings.length)) return null;
  const msgs = [...issues.errors, ...issues.warnings].map((i) => i.message).join('\n');
  return (
    <div className={'row-issue ' + (issues.errors.length ? 'err' : 'warn')} title={msgs}>
      {issues.errors.length ? '✕ ' : '▲ '}
      {(issues.errors[0] || issues.warnings[0]).message}
    </div>
  );
}
