import React, { useState } from 'react';
import { selectorStability } from '@sdk/stability.js';
import { mask, sampleFor } from '@sdk/masking.js';
import { fnDef } from '../config.js';

/** Tag-style list editor: Enter, comma or Tab adds; Backspace on an empty box removes the last one. */
export function ChipInput({ values, onChange, placeholder, mono }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const parts = String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s, i, a) => a.indexOf(s) === i && !values.includes(s));
    if (parts.length) onChange([...values, ...parts]);
    setText('');
  };
  return (
    <div className={'chips' + (mono ? ' mono' : '')} onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
      {values.map((v, i) => (
        <span className="chip" key={v + i}>
          {v}
          <button type="button" className="chip-x" title="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        placeholder={values.length ? '' : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (e.key === 'Tab' && text.trim())) {
            if (text.trim()) {
              e.preventDefault();
              add(text);
            }
          } else if (e.key === 'Backspace' && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
    </div>
  );
}

const LEVEL_TEXT = { stable: 'Stable', warning: 'Unstable', fragile: 'Fragile', invalid: 'Invalid' };

export function StabilityBadge({ selector }) {
  const s = selectorStability(selector);
  return (
    <span className={'stab stab-' + s.level} title={s.reason}>
      <span className="stab-dot">{s.level === 'stable' ? '●' : '▲'}</span> {LEVEL_TEXT[s.level]} <span className="stab-reason">{s.reason}</span>
    </span>
  );
}

/** "pages[1].mappings[3].selector" → "/profile › mapping 4 › selector" (null if the path is unknown). */
export function describePath(path, draft) {
  if (!draft || typeof path !== 'string') return null;
  let m = /^fields\[(\d+)\](?:\.(\w+))?/.exec(path);
  if (m) return `field ${draft.fields[+m[1]]?.code || '#' + (+m[1] + 1)}${m[2] ? ' › ' + m[2] : ''}`;
  m = /^pages\[(\d+)\](?:\.(mappings|exclusions|query)\[(\d+)\])?(?:\.(\w+))?/.exec(path);
  if (m) {
    const page = draft.pages[+m[1]];
    const parts = [`page ${page?.path || '#' + (+m[1] + 1)}`];
    if (m[2]) parts.push(`${{ mappings: 'mapping', exclusions: 'exclusion', query: 'condition' }[m[2]]} ${+m[3] + 1}`);
    if (m[4]) parts.push(m[4]);
    return parts.join(' › ');
  }
  m = /^excludedPages\[(\d+)\]/.exec(path);
  if (m) return `excluded page ${draft.excludedPages[+m[1]] || '#' + (+m[1] + 1)}`;
  return null;
}

/** Errors (red) and warnings (amber) from the backend's validation. */
export function Issues({ issues, showPath, draft, onJump }) {
  if (!issues || (!issues.errors.length && !issues.warnings.length)) return null;
  const row = (i, k, kind) => {
    const where = draft ? describePath(i.path, draft) : null;
    return (
      <li
        className={'issue ' + kind + (onJump ? ' jump' : '')}
        key={kind + k}
        onClick={onJump ? () => onJump(i.path) : undefined}
        title={onJump ? 'Go there' : undefined}
      >
        <span className="issue-icon">{kind === 'err' ? '✖' : '▲'}</span>
        {showPath && i.path && <code className="issue-path">{i.path}</code>}
        {where && <span className="issue-where">{where}:</span>} {i.message}
      </li>
    );
  };
  return (
    <ul className="issues">
      {issues.errors.map((i, k) => row(i, k, 'err'))}
      {issues.warnings.map((i, k) => row(i, k, 'warn'))}
    </ul>
  );
}

/** Masks a value with a field's masking (unknown function masks fully, like the engine). */
export function maskWith(field, value) {
  if (!field) return '';
  return mask(value, field.masking?.function, field.masking?.params || {});
}

export function sampleOf(samples, code) {
  return samples[code] ?? sampleFor(code);
}

/** "sample → masked" in one line. */
export function PreviewLine({ original, masked }) {
  return (
    <span className="preview">
      <span className="preview-in">{original}</span>
      <span className="preview-arrow">→</span>
      <span className="preview-out">{masked}</span>
    </span>
  );
}

/** Function select plus its parameter inputs. */
export function MaskingEditor({ masking, onChange, functions }) {
  const def = fnDef(masking.function);
  const setParam = (key, v) => onChange({ ...masking, params: { ...masking.params, [key]: v } });
  return (
    <div className="masking">
      <label className="lbl">
        Masking
        <select
          value={masking.function}
          onChange={(e) => {
            const fn = e.target.value;
            const params = {};
            for (const d of fnDef(fn)?.params || []) if (d.default !== '') params[d.key] = d.default;
            onChange({ function: fn, params });
          }}
        >
          {functions.map((f) => (
            <option key={f.code} value={f.code}>
              {f.label}
            </option>
          ))}
          {!def && <option value={masking.function}>{masking.function} (unknown)</option>}
        </select>
      </label>
      {(def?.params || []).map((d) => {
        const v = masking.params?.[d.key];
        if (d.type === 'bool') {
          return (
            <label key={d.key} className="lbl check">
              <input type="checkbox" checked={v === true || String(v) === 'true'} onChange={(e) => setParam(d.key, e.target.checked)} />
              {d.label}
            </label>
          );
        }
        if (d.type === 'enum') {
          return (
            <label key={d.key} className="lbl">
              {d.label}
              <select value={v ?? d.default} onChange={(e) => setParam(d.key, e.target.value)}>
                {d.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (d.type === 'int') {
          return (
            <label key={d.key} className="lbl narrow">
              {d.label}
              <input
                type="number"
                min="0"
                value={v ?? ''}
                placeholder={String(d.default)}
                onChange={(e) => setParam(d.key, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              />
            </label>
          );
        }
        return (
          <label key={d.key} className={'lbl' + (d.type === 'char' ? ' tiny' : ' wide')}>
            {d.label}
            <input
              className="mono"
              value={v ?? ''}
              maxLength={d.type === 'char' ? 1 : undefined}
              placeholder={d.default === '' ? 'optional' : String(d.default)}
              onChange={(e) => setParam(d.key, e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}
