import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, DOWN_MESSAGE } from './api.js';
import { cleanConfig, normalize, store } from './config.js';
import Sidebar from './views/Sidebar.jsx';
import FieldsView from './views/FieldsView.jsx';
import PageView from './views/PageView.jsx';
import ApprovalPanel from './views/ApprovalPanel.jsx';

const SAVE_DELAY = 700;
const STATUS_LABEL = { DRAFT: 'DRAFT', PENDING_APPROVAL: 'PENDING APPROVAL', APPROVED: 'APPROVED' };
const STEP_OF = { DRAFT: 0, PENDING_APPROVAL: 1, APPROVED: 2 };
const STEPS = ['Map fields', 'Approve', 'Download JS'];

function latestVersionOf(app) {
  const vs = app?.versions || [];
  return vs.length ? Math.max(...vs.map((v) => v.version)) : null;
}

export default function App() {
  const [apps, setApps] = useState([]);
  const [appId, setAppId] = useState(null);
  const [app, setApp] = useState(null); // the backend's app (status, validation, versions)
  const [draft, setDraft] = useState(null); // the config being edited
  const [down, setDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('idle'); // idle | dirty | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [sel, setSel] = useState('fields'); // 'fields' or { page: index }
  const [name, setNameState] = useState(() => store.get('ddm.name') || '');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [newApp, setNewApp] = useState(null); // { id, name, error } while the dialog is open

  const draftRef = useRef(null);
  const appIdRef = useRef(null);
  const seqRef = useRef(0); // bumped on every edit
  const savedSeqRef = useRef(0); // the edit the backend has
  const timerRef = useRef(null);
  const inflightRef = useRef(null);

  const setName = (v) => {
    setNameState(v);
    store.set('ddm.name', v);
  };

  const adopt = useCallback((a) => {
    setApp(a);
    const d = normalize(a.draft, a);
    draftRef.current = d;
    setDraft(d);
  }, []);

  const fail = useCallback((e) => {
    if (e.down) setDown(true);
  }, []);

  // ---- autosave ---------------------------------------------------------------------------------
  const save = useCallback(async () => {
    clearTimeout(timerRef.current);
    while (inflightRef.current) await inflightRef.current;
    if (seqRef.current === savedSeqRef.current || !draftRef.current) return true;
    const seq = seqRef.current;
    const id = appIdRef.current;
    const body = cleanConfig(draftRef.current);
    setSaveState('saving');
    let ok = true;
    const p = (async () => {
      try {
        const res = await api.saveDraft(id, body);
        if (appIdRef.current !== id) return;
        savedSeqRef.current = seq;
        setDown(false);
        setSaveError('');
        if (seqRef.current === seq) {
          // Nothing changed meanwhile: the backend's copy is the truth.
          adopt(res);
          setSaveState('saved');
        } else {
          setApp(res);
          setSaveState('dirty');
        }
        setApps((list) => list.map((x) => (x.id === res.id ? { ...x, status: res.status } : x)));
      } catch (e) {
        ok = false;
        fail(e);
        setSaveError(e.message);
        setSaveState('error');
      }
    })();
    inflightRef.current = p;
    await p;
    inflightRef.current = null;
    if (ok && seqRef.current !== savedSeqRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, SAVE_DELAY);
    }
    return ok && seqRef.current === savedSeqRef.current;
  }, [adopt, fail]);

  const edit = useCallback(
    (updater) => {
      if (!draftRef.current) return;
      const next = typeof updater === 'function' ? updater(draftRef.current) : updater;
      draftRef.current = next;
      setDraft(next);
      seqRef.current += 1;
      setSaveState('dirty');
      setActionError('');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, SAVE_DELAY);
    },
    [save]
  );

  // ---- loading ----------------------------------------------------------------------------------
  const loadApp = useCallback(
    async (id) => {
      appIdRef.current = id;
      setAppId(id);
      store.set('ddm.app', id);
      setSel('fields');
      setActionError('');
      try {
        const a = await api.getApp(id);
        if (appIdRef.current !== id) return;
        seqRef.current = 0;
        savedSeqRef.current = 0;
        adopt(a);
        setSaveState('idle');
        setDown(false);
      } catch (e) {
        fail(e);
        if (!e.down) setActionError(e.message);
      }
    },
    [adopt, fail]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listApps();
      setApps(list || []);
      setDown(false);
      const remembered = store.get('ddm.app');
      const pick = (list || []).find((x) => x.id === appIdRef.current) || (list || []).find((x) => x.id === remembered) || (list || [])[0];
      if (pick) await loadApp(pick.id);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [loadApp, fail]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // While the backend is down, try again every 5 s; then send unsaved edits or reload.
  useEffect(() => {
    if (!down) return undefined;
    const t = setInterval(async () => {
      try {
        const list = await api.listApps();
        setApps(list || []);
        setDown(false);
        if (seqRef.current !== savedSeqRef.current && appIdRef.current) save();
        else if (appIdRef.current) loadApp(appIdRef.current);
        else loadAll();
      } catch (e) {
        /* still down */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [down, save, loadApp, loadAll]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const h = (e) => {
      if (seqRef.current !== savedSeqRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const switchApp = async (id) => {
    if (id === '__new__') {
      setNewApp({ id: '', name: '', error: '' });
      return;
    }
    if (seqRef.current !== savedSeqRef.current) await save();
    loadApp(id);
  };

  const createApp = async () => {
    const id = newApp.id.trim();
    const nm = newApp.name.trim();
    if (!id || !nm) {
      setNewApp({ ...newApp, error: 'Enter an id and a name.' });
      return;
    }
    try {
      if (seqRef.current !== savedSeqRef.current) await save();
      const a = await api.createApp(id, nm);
      setNewApp(null);
      const list = await api.listApps().catch(() => null);
      setApps(list || ((l) => [...l, { id: a.id, name: a.name, status: a.status, latestVersion: null }]));
      await loadApp(a.id);
    } catch (e) {
      fail(e);
      setNewApp({ ...newApp, error: e.message });
    }
  };

  // Submit / approve / reject: send pending edits first, then act; the returned app is the truth.
  const run = async (what, call) => {
    setBusy(true);
    setActionError('');
    try {
      const saved = await save();
      if (!saved) throw new Error('The draft could not be saved, so it was not ' + (what === 'submit' ? 'submitted.' : what + 'd.'));
      const a = await call();
      adopt(a);
      setApps((list) => list.map((x) => (x.id === a.id ? { ...x, status: a.status, latestVersion: latestVersionOf(a) } : x)));
      return true;
    } catch (e) {
      fail(e);
      setActionError(e.message);
      if (appIdRef.current) api.getApp(appIdRef.current).then((a) => seqRef.current === savedSeqRef.current && adopt(a)).catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ---- render -----------------------------------------------------------------------------------
  const status = app?.status;
  const step = STEP_OF[status] ?? 0;
  const latest = latestVersionOf(app);
  const validation = app?.validation;
  const errCount = validation?.errors?.length || 0;
  const warnCount = validation?.warnings?.length || 0;

  const saveText = {
    idle: '',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'Saved',
    error: `Not saved: ${saveError}`,
  }[saveState];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          DDM Console <span className="brand-sub">· Browser SDK</span>
        </div>
        <label className="app-picker">
          <span>Application</span>
          <select value={appId || ''} onChange={(e) => switchApp(e.target.value)}>
            {!appId && <option value="">—</option>}
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.id})
              </option>
            ))}
            <option value="__new__">+ New application…</option>
          </select>
        </label>
        {status && <span className={'pill ' + status.toLowerCase()}>{STATUS_LABEL[status] || status}</span>}
        {app && <span className="version-info">{latest ? `Approved: v${latest}` : 'No approved version'}</span>}
        {saveText && (
          <span className={'save-state ' + saveState} title={saveState === 'error' ? saveError : ''}>
            {saveText}
            {saveState === 'error' && (
              <button className="retry" onClick={save}>
                Retry
              </button>
            )}
          </span>
        )}
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={(i < step || status === 'APPROVED' ? 'done' : '') + (i === step ? ' current' : '')}
            >
              <span className="step-num">{i < step || (status === 'APPROVED' && i === 2) ? '✓' : i + 1}</span>
              {s}
              {i < STEPS.length - 1 && <span className="step-line" />}
            </li>
          ))}
        </ol>
      </header>

      {down && (
        <div className="banner">
          <strong>{DOWN_MESSAGE}.</strong> Start the backend; this page retries every 5 seconds.
          {seqRef.current !== savedSeqRef.current && ' Your unsaved changes are kept here and will be saved when it is back.'}
          <button className="btn small" onClick={() => (appIdRef.current ? save().then(() => loadApp(appIdRef.current)) : loadAll())}>
            Retry now
          </button>
        </div>
      )}

      {app && draft ? (
        <div className="workspace">
          <Sidebar draft={draft} validation={validation} sel={sel} setSel={setSel} edit={edit} />
          {sel === 'fields' || !draft.pages[sel.page] ? (
            <FieldsView draft={draft} edit={edit} validation={validation} />
          ) : (
            <PageView draft={draft} edit={edit} validation={validation} index={sel.page} setSel={setSel} />
          )}
          <ApprovalPanel
            app={app}
            draft={draft}
            validation={validation}
            name={name}
            setName={setName}
            run={run}
            busy={busy}
            actionError={actionError}
            onJump={(p) => {
              const m = /^pages\[(\d+)\]/.exec(p || '');
              setSel(m ? { page: +m[1] } : 'fields');
            }}
          />
        </div>
      ) : (
        <main>
          <div className="empty big">
            {loading ? 'Loading…' : down ? 'Waiting for the backend…' : actionError || 'No application yet. Create one with "+ New application" above.'}
            {!loading && !down && !apps.length && (
              <div>
                <button className="btn primary" onClick={() => setNewApp({ id: '', name: '', error: '' })}>
                  + New application
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {newApp && (
        <div className="modal-bg" onClick={() => setNewApp(null)}>
          <form
            className="modal card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              createApp();
            }}
          >
            <h3 className="card-title">New application</h3>
            <label className="lbl">
              Id <span className="muted">(used in file names, e.g. dam-portal)</span>
              <input
                className="mono"
                autoFocus
                value={newApp.id}
                onChange={(e) => setNewApp({ ...newApp, id: e.target.value.trim().toLowerCase(), error: '' })}
              />
            </label>
            <label className="lbl">
              Name
              <input value={newApp.name} placeholder="DAM Portal" onChange={(e) => setNewApp({ ...newApp, name: e.target.value, error: '' })} />
            </label>
            {newApp.error && <div className="error-box">{newApp.error}</div>}
            <div className="actions right">
              <button type="button" className="btn ghost" onClick={() => setNewApp(null)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
