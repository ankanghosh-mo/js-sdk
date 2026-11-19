import React, { useState } from 'react';
import { queryLabel, issuesUnder } from '../config.js';

function AddInline({ label, placeholder, onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) {
    return (
      <button className="side-add" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  }
  const submit = () => {
    const v = text.trim();
    if (v) onAdd(v.startsWith('/') ? v : '/' + v);
    setText('');
    setOpen(false);
  };
  return (
    <div className="side-add-form">
      <input
        className="mono"
        autoFocus
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <button className="btn small primary" onClick={submit}>
        Add
      </button>
    </div>
  );
}

export default function Sidebar({ draft, validation, sel, setSel, edit }) {
  const fieldIssues = issuesUnder(validation, 'fields');
  const ruleCount = draft.fields.reduce((n, f) => n + f.names.length + f.columns.length + f.labels.length, 0);

  const addPage = (path) => {
    const existing = draft.pages.findIndex((p) => p.path === path && !p.query.length);
    if (existing >= 0) {
      setSel({ page: existing });
      return;
    }
    edit((d) => ({ ...d, pages: [...d.pages, { path, query: [], mappings: [], exclusions: [] }] }));
    setSel({ page: draft.pages.length });
  };

  return (
    <aside className="card side">
      <div className="side-title">What to mask</div>
      <button className={'side-item' + (sel === 'fields' ? ' sel' : '')} onClick={() => setSel('fields')}>
        <span>
          <b>Fields</b> <span className="side-sub">on every page</span>
        </span>
        <span className="count">
          {draft.fields.length}
          {fieldIssues.errors.length > 0 && <span className="dot err" title="has errors" />}
        </span>
      </button>
      <div className="side-hint">{ruleCount} names, headers and labels</div>

      <div className="side-sep" />
      <div className="side-title">Page exceptions</div>
      {draft.pages.length === 0 && <div className="side-empty">None yet. Most values are covered by Fields.</div>}
      {draft.pages.map((p, i) => {
        const iss = issuesUnder(validation, `pages[${i}]`);
        const isSel = sel && sel.page === i;
        return (
          <button key={i} className={'side-item mono' + (isSel ? ' sel' : '')} onClick={() => setSel({ page: i })}>
            <span className="side-path">
              {p.path === '/**' ? 'All pages (/**)' : p.path || '(no path)'}
              {queryLabel(p.query) && <span className="side-q">{queryLabel(p.query)}</span>}
            </span>
            <span className="count">
              {p.mappings.length + p.exclusions.length}
              {iss.errors.length > 0 && <span className="dot err" title="has errors" />}
              {!iss.errors.length && iss.warnings.length > 0 && <span className="dot warn" title="has warnings" />}
            </span>
          </button>
        );
      })}
      <AddInline label="Add page" placeholder="/profile or /customers/{id}" onAdd={addPage} />

      <div className="side-sep" />
      <div className="side-title">Pages not masked</div>
      {draft.excludedPages.length === 0 && <div className="side-empty">None.</div>}
      {draft.excludedPages.map((p, i) => (
        <div key={i} className="side-excl mono">
          {p}
          <button
            className="x"
            title="Mask this page again"
            onClick={() => edit((d) => ({ ...d, excludedPages: d.excludedPages.filter((_, j) => j !== i) }))}
          >
            ×
          </button>
        </div>
      ))}
      <AddInline
        label="Exclude a page"
        placeholder="/login or /help/**"
        onAdd={(path) => edit((d) => (d.excludedPages.includes(path) ? d : { ...d, excludedPages: [...d.excludedPages, path] }))}
      />
    </aside>
  );
}
