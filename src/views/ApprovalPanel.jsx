import React, { useState } from 'react';
import { api } from '../api.js';
import { formatBytes, formatTime } from '../config.js';
import { describePath } from '../components/common.jsx';

function IssueList({ items, kind, draft, onJump }) {
  return (
    <ul className={'plist ' + kind}>
      {items.map((i, k) => (
        <li key={k} onClick={() => onJump(i.path)} title="Go there">
          <b>{describePath(i.path, draft) || 'config'}</b>: {i.message}
        </li>
      ))}
    </ul>
  );
}

export default function ApprovalPanel({ app, draft, validation, name, setName, run, busy, actionError, onJump }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const status = app.status;
  const errors = validation?.errors || [];
  const warnings = validation?.warnings || [];
  const versions = [...(app.versions || [])].sort((a, b) => b.version - a.version);
  const latest = versions[0];
  const noName = !name.trim();

  const names = draft.fields.reduce((n, f) => n + f.names.length + f.columns.length + f.labels.length, 0);
  const mappings = draft.pages.reduce((n, p) => n + p.mappings.length, 0);
  const sections = draft.pages.reduce((n, p) => n + p.exclusions.length, 0);
  const snippet = latest ? `<script src="/ddm/ddm-sdk.js" integrity="${latest.integrity}" crossorigin="anonymous"></script>` : '';

  return (
    <aside className="right">
      <div className="card panel">
        <div className="side-title">Approval</div>
        <div className={'state state-' + status.toLowerCase()}>
          {status === 'DRAFT' && (
            <>
              <b>Draft</b> · your changes are saved, not live yet
            </>
          )}
          {status === 'PENDING_APPROVAL' && (
            <>
              <b>Waiting for approval</b> · submitted by {app.submittedBy}
            </>
          )}
          {status === 'APPROVED' && (
            <>
              <b>Version {latest?.version} is approved</b> · by {latest?.approvedBy}
            </>
          )}
        </div>
        {app.rejection && status === 'DRAFT' && (
          <div className="note err">
            Rejected by {app.rejection.by || '—'}: {typeof app.rejection === 'string' ? app.rejection : app.rejection.reason || 'no reason given'}
          </div>
        )}

        <div className="stats">
          <div>
            <span>Fields</span>
            <b>{draft.fields.length}</b>
          </div>
          <div>
            <span>Names, headers, labels</span>
            <b>{names}</b>
          </div>
          <div>
            <span>Page mappings</span>
            <b>{mappings}</b>
          </div>
          <div>
            <span>Sections kept visible</span>
            <b>{sections}</b>
          </div>
          <div>
            <span>Pages not masked</span>
            <b>{draft.excludedPages.length}</b>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="note err">
            <b>
              {errors.length} problem{errors.length > 1 ? 's' : ''} to fix before submitting
            </b>
            <IssueList items={errors} kind="err" draft={draft} onJump={onJump} />
          </div>
        )}
        {warnings.length > 0 && (
          <div className="note warn">
            <b>
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </b>{' '}
            (you can still submit)
            <IssueList items={warnings} kind="warn" draft={draft} onJump={onJump} />
          </div>
        )}

        <label className="lbl">
          Your name
          <input value={name} placeholder="needed to submit or approve" onChange={(e) => setName(e.target.value)} />
        </label>

        {status === 'DRAFT' && (
          <button
            className="btn primary full"
            disabled={busy || noName || errors.length > 0}
            title={errors.length ? 'Fix the problems first' : noName ? 'Enter your name' : ''}
            onClick={() => run('submit', () => api.submit(app.id, name.trim()))}
          >
            Submit for approval
          </button>
        )}
        {status === 'PENDING_APPROVAL' && (
          <div className="two">
            <button className="btn success" disabled={busy || noName} onClick={() => run('approve', () => api.approve(app.id, name.trim()))}>
              Approve
            </button>
            <button className="btn ghost danger" disabled={busy} onClick={() => setRejecting((r) => !r)}>
              Reject…
            </button>
          </div>
        )}
        {status === 'PENDING_APPROVAL' && rejecting && (
          <div className="reject">
            <input value={reason} placeholder="Why? (shown to the submitter)" onChange={(e) => setReason(e.target.value)} autoFocus />
            <button
              className="btn danger"
              disabled={busy || noName}
              onClick={async () => {
                if (await run('reject', () => api.reject(app.id, name.trim(), reason.trim()))) {
                  setRejecting(false);
                  setReason('');
                }
              }}
            >
              Reject
            </button>
          </div>
        )}
        {status === 'APPROVED' && <div className="muted small">Edit anything to start the next version.</div>}
        {actionError && <div className="note err">{actionError}</div>}
      </div>

      <div className="card panel">
        <div className="side-title">Download &amp; install</div>
        {latest ? (
          <>
            <a className="btn primary full" href={api.sdkUrl(app.id, latest.version)} download={latest.fileName}>
              ⬇ Download {latest.fileName}
            </a>
            <div className="muted small center">
              v{latest.version} · approved by {latest.approvedBy} · {formatTime(latest.approvedAt)} · {formatBytes(latest.sizeBytes)}
            </div>
            <div className="install">
              <div className="install-step">
                <b>1.</b> Save the file in your app as <code>/ddm/ddm-sdk.js</code>
              </div>
              <div className="install-step">
                <b>2.</b> Add this line once, <b>first in &lt;head&gt;</b> of the common header page:
              </div>
              <pre>{snippet}</pre>
              <button
                className="btn small"
                onClick={() => {
                  navigator.clipboard?.writeText(snippet).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            {versions.length > 1 && (
              <div className="old">
                <button className="link" onClick={() => setShowOld((s) => !s)}>
                  {showOld ? 'Hide' : 'Show'} earlier versions ({versions.length - 1})
                </button>
                {showOld &&
                  versions.slice(1).map((v) => (
                    <div className="old-row" key={v.version}>
                      <span>
                        v{v.version} · {v.approvedBy} · {formatTime(v.approvedAt)}
                      </span>
                      <a href={api.sdkUrl(app.id, v.version)} download={v.fileName}>
                        Download
                      </a>
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button className="btn locked full" disabled>
              🔒 Download the JS
            </button>
            <div className="muted small center">Available after the first version is approved. The mappings are built into the file.</div>
          </>
        )}
      </div>
    </aside>
  );
}
