import React, { useEffect, useState } from 'react';
import { ChipInput } from '../components/common.jsx';
import { issuesUnder, queryLabel } from '../config.js';
import { describeMasking, previewOf } from '../presets.js';
import { Preview, RowIssues, Stability } from './bits.jsx';

const TARGETS = [
  { id: 'text', label: 'Text' },
  { id: 'value', label: 'Input box / dropdown' },
  { id: 'attr', label: 'Attribute (e.g. tooltip)' },
  { id: 'column', label: 'Table column' },
  { id: 'title', label: 'Page title (browser tab)' },
];
const targetLabel = (t) => (TARGETS.find((x) => x.id === t) || TARGETS[0]).label;

const EMPTY_MAP = { selector: '', target: 'text', attr: 'title', column: '', after: '', field: '' };
const EMPTY_EXCL = { selector: '', containing: '', except: [] };

export default function PageView({ draft, edit, validation, index, setSel }) {
  const page = draft.pages[index];
  const [m, setM] = useState(EMPTY_MAP);
  const [editingM, setEditingM] = useState(null);
  const [x, setX] = useState(EMPTY_EXCL);
  const [editingX, setEditingX] = useState(null);
  const [err, setErr] = useState('');
  const [errX, setErrX] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setM({ ...EMPTY_MAP, field: draft.fields[0]?.code || '' });
    setEditingM(null);
    setX(EMPTY_EXCL);
    setEditingX(null);
    setErr('');
    setErrX('');
    setShowSettings(false);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!page) return null;
  const base = `pages[${index}]`;
  const setPage = (fn) => edit((d) => ({ ...d, pages: d.pages.map((p, i) => (i === index ? fn(p) : p)) }));
  const field = draft.fields.find((f) => f.code === m.field);
  const pv = field ? previewOf(field, m.after.trim() || null) : null;

  // ---- mappings ----
  const submitMapping = () => {
    if (m.target !== 'title' && !m.selector.trim()) return setErr('Enter the element: its id (#aadhaarNo), name (input[name=pan]) or class (.pan).');
    if (!m.field) return setErr('Choose which field it is.');
    if (m.target === 'attr' && !m.attr.trim()) return setErr('Enter the attribute name, for example title.');
    if (m.target === 'column' && !m.column.trim()) return setErr('Enter the column header, for example PAN.');
    const out = { selector: m.target === 'title' ? 'title' : m.selector.trim(), target: m.target, field: m.field };
    if (m.target === 'attr') out.attr = m.attr.trim();
    if (m.target === 'column') out.column = m.column.trim();
    if (m.target !== 'column' && m.after.trim()) out.after = m.after.trim();
    setPage((p) => ({ ...p, mappings: editingM === null ? [...p.mappings, out] : p.mappings.map((y, i) => (i === editingM ? out : y)) }));
    setM({ ...EMPTY_MAP, field: m.field });
    setEditingM(null);
    setErr('');
  };
  const editMapping = (i) => {
    const y = page.mappings[i];
    setM({ ...EMPTY_MAP, ...y, attr: y.attr || 'title', column: y.column || '', after: y.after || '' });
    setEditingM(i);
    setErr('');
  };

  // ---- exclusions ----
  const submitExclusion = () => {
    if (!x.selector.trim()) return setErrX('Enter the section to keep visible: its id (#internalNotes) or class (.card).');
    const out = { selector: x.selector.trim(), except: x.except };
    if (x.containing.trim()) out.containing = x.containing.trim();
    setPage((p) => ({ ...p, exclusions: editingX === null ? [...p.exclusions, out] : p.exclusions.map((y, i) => (i === editingX ? out : y)) }));
    setX(EMPTY_EXCL);
    setEditingX(null);
    setErrX('');
  };

  const deletePage = () => {
    if (!window.confirm(`Delete the page ${page.path} and its ${page.mappings.length + page.exclusions.length} rule(s)?`)) return;
    edit((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== index) }));
    setSel('fields');
  };

  return (
    <section className="card main">
      <div className="mhead">
        <h2>
          {page.path === '/**' ? 'On all pages' : 'On'} <code>{page.path === '/**' ? '/**' : page.path}</code>
          {queryLabel(page.query) && <code className="q">{queryLabel(page.query)}</code>}
        </h2>
        <span className="grow" />
        <button className="btn small ghost" onClick={() => setShowSettings((s) => !s)}>
          Page settings
        </button>
      </div>
      <p className="hint">
        Exceptions for this page only: values the app-wide fields don't catch, and sections to keep visible. Find an element with{' '}
        <b>right-click → Inspect</b> on the page.
      </p>

      {showSettings && (
        <div className="settings">
          <label className="lbl">
            Page address
            <input className="mono" value={page.path} onChange={(e) => setPage((p) => ({ ...p, path: e.target.value }))} />
            <span className="muted small">
              <code>{'{id}'}</code> = any one part, <code>/**</code> at the end = everything below
            </span>
          </label>
          <div className="lbl">
            Only when the address has
            {page.query.map((q, qi) => (
              <div className="qrow" key={qi}>
                <input className="mono" placeholder="action" value={q.name || ''} onChange={(e) => setPage((p) => ({ ...p, query: p.query.map((y, j) => (j === qi ? { ...y, name: e.target.value } : y)) }))} />
                <span>=</span>
                <input className="mono" placeholder="view" value={q.equals ?? ''} onChange={(e) => setPage((p) => ({ ...p, query: p.query.map((y, j) => (j === qi ? { name: y.name, equals: e.target.value } : y)) }))} />
                <button className="icon danger" onClick={() => setPage((p) => ({ ...p, query: p.query.filter((_, j) => j !== qi) }))}>
                  🗑
                </button>
              </div>
            ))}
            <button className="link" onClick={() => setPage((p) => ({ ...p, query: [...p.query, { name: '', equals: '' }] }))}>
              + add a condition (e.g. ?action=view)
            </button>
          </div>
          <button className="btn small danger ghost" onClick={deletePage}>
            Delete this page
          </button>
        </div>
      )}

      {/* ---------- add a mapping ---------- */}
      <div className={'form' + (editingM !== null ? ' editing' : '')}>
        <div className="form-title">{editingM === null ? 'Add a mapping' : `Edit mapping ${editingM + 1}`}</div>
        <div className="row map-row">
          <label className="lbl">
            {m.target === 'column' ? 'Table on the page (id or class)' : 'Element on the page'}
            <input
              className="mono"
              disabled={m.target === 'title'}
              value={m.target === 'title' ? 'page title' : m.selector}
              placeholder={m.target === 'column' ? '#custTable' : '#aadhaarNo  or  input[name=pan]  or  .pan'}
              onChange={(e) => setM({ ...m, selector: e.target.value })}
            />
          </label>
          <label className="lbl">
            Value is in
            <select value={m.target} onChange={(e) => setM({ ...m, target: e.target.value })}>
              {TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {m.target === 'attr' && (
            <label className="lbl">
              Attribute name
              <input className="mono" value={m.attr} onChange={(e) => setM({ ...m, attr: e.target.value })} />
            </label>
          )}
          {m.target === 'column' && (
            <label className="lbl">
              Column header
              <input value={m.column} placeholder="PAN" onChange={(e) => setM({ ...m, column: e.target.value })} />
            </label>
          )}
          {m.target !== 'column' && (
            <label className="lbl">
              <span>
                Only the part after the label <span className="muted">(optional)</span>
              </span>
              <input value={m.after} placeholder="Aadhaar:" onChange={(e) => setM({ ...m, after: e.target.value })} />
            </label>
          )}
        </div>
        <div className="row map-row2">
          <label className="lbl">
            It is
            <select value={m.field} onChange={(e) => setM({ ...m, field: e.target.value })}>
              {!m.field && <option value="">choose a field…</option>}
              {draft.fields.filter((f) => f.code).map((f) => (
                <option key={f.code} value={f.code}>
                  {f.code} · {describeMasking(f.masking)}
                </option>
              ))}
            </select>
          </label>
          <div className="lbl">
            Preview
            {pv ? <Preview from={pv.from} to={pv.to} /> : <span className="pv empty">choose a field</span>}
          </div>
          <div className="form-btns">
            {editingM !== null && (
              <button
                className="btn ghost"
                onClick={() => {
                  setM({ ...EMPTY_MAP, field: m.field });
                  setEditingM(null);
                }}
              >
                Cancel
              </button>
            )}
            <button className="btn primary" onClick={submitMapping}>
              {editingM === null ? 'Add mapping' : 'Save'}
            </button>
          </div>
        </div>
        <div className="form-note">
          {m.target !== 'title' && m.selector.trim() ? <Stability selector={m.selector.trim()} long /> : <span className="muted">Tip: an id, a name or a class stays stable when the page layout changes.</span>}
        </div>
        {err && <div className="form-error block">{err}</div>}
      </div>

      {page.mappings.length === 0 ? (
        <div className="empty">No mappings on this page.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Element</th>
              <th>Value is in</th>
              <th>Field</th>
              <th>Preview</th>
              <th>Selector</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {page.mappings.map((y, i) => {
              const f = draft.fields.find((ff) => ff.code === y.field);
              const p = f ? previewOf(f, y.after || null) : null;
              const iss = issuesUnder(validation, `${base}.mappings[${i}]`);
              return (
                <tr key={i} className={editingM === i ? 'row-editing' : iss.errors.length ? 'row-err' : iss.warnings.length ? 'row-warn' : ''}>
                  <td className="mono">
                    {y.target === 'title' ? 'page title' : y.selector}
                    <RowIssues issues={iss} errorsOnly />
                  </td>
                  <td>
                    {y.target === 'attr' ? (
                      <>
                        Attribute <span className="mono">{y.attr}</span>
                      </>
                    ) : y.target === 'column' ? (
                      <>Column “{y.column}”</>
                    ) : (
                      targetLabel(y.target)
                    )}
                    {y.after && <div className="sub">after “{y.after}”</div>}
                  </td>
                  <td>
                    <span className="tag">{y.field || '?'}</span>
                    {f && <div className="sub">{describeMasking(f.masking)}</div>}
                  </td>
                  <td>{p ? <Preview from={p.from} to={p.to} compact /> : <span className="sub">—</span>}</td>
                  <td>{y.target !== 'title' && <Stability selector={y.selector} />}</td>
                  <td className="acts">
                    <button className="icon" title="Edit" onClick={() => editMapping(i)}>
                      ✎
                    </button>
                    <button className="icon danger" title="Delete" onClick={() => setPage((pp) => ({ ...pp, mappings: pp.mappings.filter((_, j) => j !== i) }))}>
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ---------- keep visible ---------- */}
      <div className="sub-head">
        <h3>Keep visible on this page</h3>
        <span className="muted">Nothing inside these sections is masked, except what you list under “Still mask”.</span>
      </div>
      <div className={'form' + (editingX !== null ? ' editing' : '')}>
        <div className="row excl-row">
          <label className="lbl">
            Section (id or class)
            <input className="mono" value={x.selector} placeholder="#internalNotes or .card" onChange={(e) => setX({ ...x, selector: e.target.value })} />
          </label>
          <label className="lbl">
            Only the one containing <span className="muted">optional</span>
            <input className="mono" value={x.containing} placeholder="button[name=verifyKyc]" onChange={(e) => setX({ ...x, containing: e.target.value })} />
          </label>
          <div className="lbl">
            Still mask inside <span className="muted">optional</span>
            <ChipInput mono values={x.except} placeholder=".pan" onChange={(except) => setX({ ...x, except })} />
          </div>
          <div className="form-btns">
            {editingX !== null && (
              <button
                className="btn ghost"
                onClick={() => {
                  setX(EMPTY_EXCL);
                  setEditingX(null);
                }}
              >
                Cancel
              </button>
            )}
            <button className="btn primary" onClick={submitExclusion}>
              {editingX === null ? 'Keep visible' : 'Save'}
            </button>
          </div>
        </div>
        {x.selector.trim() && (
          <div className="form-note">
            <Stability selector={x.selector.trim()} long />
          </div>
        )}
        {errX && <div className="form-error block">{errX}</div>}
      </div>
      {page.exclusions.length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Section kept visible</th>
              <th>Only the one containing</th>
              <th>Still masked inside</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {page.exclusions.map((y, i) => {
              const iss = issuesUnder(validation, `${base}.exclusions[${i}]`);
              return (
                <tr key={i} className={editingX === i ? 'row-editing' : iss.errors.length ? 'row-err' : ''}>
                  <td className="mono">
                    {y.selector}
                    <RowIssues issues={iss} />
                  </td>
                  <td className="mono">{y.containing || <span className="sub">every match</span>}</td>
                  <td className="mono">{y.except && y.except.length ? y.except.join(', ') : <span className="sub">nothing</span>}</td>
                  <td className="acts">
                    <button
                      className="icon"
                      title="Edit"
                      onClick={() => {
                        setX({ selector: y.selector, containing: y.containing || '', except: [...(y.except || [])] });
                        setEditingX(i);
                      }}
                    >
                      ✎
                    </button>
                    <button className="icon danger" title="Delete" onClick={() => setPage((pp) => ({ ...pp, exclusions: pp.exclusions.filter((_, j) => j !== i) }))}>
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

    </section>
  );
}
