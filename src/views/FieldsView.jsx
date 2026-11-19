import React, { useState } from 'react';
import { MASKING_FUNCTIONS } from '@sdk/masking.js';
import { ChipInput, MaskingEditor } from '../components/common.jsx';
import { issuesUnder } from '../config.js';
import { CUSTOM, PRESETS, describeMasking, maskingOfPreset, presetOf, previewOfMasking } from '../presets.js';
import { Preview, RowIssues } from './bits.jsx';

const EMPTY = { code: '', masking: maskingOfPreset('last4'), names: [], columns: [], labels: [], reveal: false };

export default function FieldsView({ draft, edit, validation }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // index being edited, or null when adding
  const [formError, setFormError] = useState('');
  const preset = presetOf(form.masking);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setFormError('');
  };

  const startEdit = (i) => {
    const f = draft.fields[i];
    setForm({ code: f.code, masking: { function: f.masking.function, params: { ...f.masking.params } }, names: [...f.names], columns: [...f.columns], labels: [...f.labels], reveal: f.reveal });
    setEditing(i);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancel = () => {
    setForm(EMPTY);
    setEditing(null);
    setFormError('');
  };

  const submit = () => {
    const code = form.code.trim();
    if (!code) return setFormError('Give the field a name, for example AADHAAR.');
    if (draft.fields.some((f, i) => i !== editing && f.code === code)) return setFormError(`There is already a field ${code}.`);
    const field = { ...form, code };
    edit((d) => {
      if (editing === null) return { ...d, fields: [...d.fields, field] };
      const old = d.fields[editing].code;
      const fields = d.fields.map((f, i) => (i === editing ? field : f));
      const pages = old === code ? d.pages : d.pages.map((p) => ({ ...p, mappings: p.mappings.map((m) => (m.field === old ? { ...m, field: code } : m)) }));
      return { ...d, fields, pages };
    });
    cancel();
  };

  const remove = (i) => {
    const code = draft.fields[i].code;
    const used = draft.pages.reduce((n, p) => n + p.mappings.filter((m) => m.field === code).length, 0);
    if (!window.confirm(`Delete field ${code}?${used ? `\nIt is used by ${used} page mapping(s); they will show an error until you change them.` : ''}`)) return;
    edit((d) => ({ ...d, fields: d.fields.filter((_, j) => j !== i) }));
    if (editing === i) cancel();
  };

  const pv = previewOfMasking(form.code, form.masking);

  return (
    <section className="card main">
      <div className="mhead">
        <h2>Fields masked on every page</h2>
      </div>
      <p className="hint">
        Add each kind of personal data once. DDM masks it on <b>every page</b> wherever an element's <b>id, name or class</b> matches one of
        its names, in any table column with one of its headers, and next to one of its labels.
      </p>

      <div className={'form' + (editing !== null ? ' editing' : '')}>
        <div className="form-title">{editing === null ? 'Add a field' : `Edit field ${draft.fields[editing]?.code}`}</div>
        <div className="row fields-row">
          <label className="lbl">
            Field
            <input className="mono" value={form.code} placeholder="AADHAAR" onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} />
          </label>
          <label className="lbl">
            How it should look
            <select
              value={preset}
              onChange={(e) => set({ masking: e.target.value === CUSTOM ? { ...form.masking } : maskingOfPreset(e.target.value) })}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
          </label>
          <div className="lbl">
            Preview
            <Preview from={pv.from} to={pv.to} />
          </div>
        </div>
        {preset === CUSTOM && (
          <div className="custom-box">
            <MaskingEditor masking={form.masking} functions={MASKING_FUNCTIONS} onChange={(masking) => set({ masking })} />
          </div>
        )}

        <div className="find-title">Find it on every page by</div>
        <div className="find-grid">
          <div className="find-label">
            Names <span className="muted">id, name or class</span>
          </div>
          <ChipInput mono values={form.names} placeholder="aadhaar, aadhaarNo …  (Enter to add)" onChange={(names) => set({ names })} />
          <div className="find-label">
            Table column headers <span className="muted">any table</span>
          </div>
          <ChipInput values={form.columns} placeholder="Aadhaar No …" onChange={(columns) => set({ columns })} />
          <div className="find-label">
            Labels <span className="muted">value next to it</span>
          </div>
          <ChipInput values={form.labels} placeholder="Aadhaar No …" onChange={(labels) => set({ labels })} />
        </div>

        <div className="form-foot">
          <label className="check">
            <input type="checkbox" checked={form.reveal} onChange={(e) => set({ reveal: e.target.checked })} />
            Users can click a masked value to see it for 5 seconds
          </label>
          <span className="grow" />
          {formError && <span className="form-error">{formError}</span>}
          {editing !== null && (
            <button className="btn ghost" onClick={cancel}>
              Cancel
            </button>
          )}
          <button className="btn primary" onClick={submit}>
            {editing === null ? 'Add field' : 'Save field'}
          </button>
        </div>
      </div>

      {draft.fields.length === 0 ? (
        <div className="empty">No fields yet. Start with AADHAAR, PAN, MOBILE or EMAIL.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Field</th>
              <th>How it looks</th>
              <th>Found by</th>
              <th>Preview</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.fields.map((f, i) => {
              const p = previewOfMasking(f.code, f.masking);
              const iss = issuesUnder(validation, `fields[${i}]`);
              return (
                <tr key={i} className={editing === i ? 'row-editing' : iss.errors.length ? 'row-err' : ''}>
                  <td>
                    <span className="tag">{f.code || '?'}</span>
                    {f.reveal && <div className="sub">click to reveal</div>}
                    <RowIssues issues={iss} />
                  </td>
                  <td>{describeMasking(f.masking)}</td>
                  <td className="found">
                    {f.names.length > 0 && (
                      <div>
                        <span className="found-k">names</span> <span className="mono">{f.names.join(', ')}</span>
                      </div>
                    )}
                    {f.columns.length > 0 && (
                      <div>
                        <span className="found-k">columns</span> {f.columns.join(', ')}
                      </div>
                    )}
                    {f.labels.length > 0 && (
                      <div>
                        <span className="found-k">labels</span> {f.labels.join(', ')}
                      </div>
                    )}
                    {!f.names.length && !f.columns.length && !f.labels.length && <span className="sub">only where a page maps it</span>}
                  </td>
                  <td>
                    <Preview from={p.from} to={p.to} compact />
                  </td>
                  <td className="acts">
                    <button className="icon" title="Edit" onClick={() => startEdit(i)}>
                      ✎
                    </button>
                    <button className="icon danger" title="Delete" onClick={() => remove(i)}>
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
