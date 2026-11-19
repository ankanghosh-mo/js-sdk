// A tiny in-memory stand-in for the backend REST API (CONTRACT.md section 3), for trying the admin UI
// without the Java backend. Plain Node http on port 8096. Validation is a rough subset of the real one.
//   node mock/mock-server.mjs           then   VITE_API_TARGET=http://localhost:8096 npm run dev
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { selectorStability } from '../../sdk/src/stability.js';

const PORT = Number(process.env.MOCK_PORT || 8096);
const here = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.resolve(here, '../../backend/src/main/resources/seed/dam-portal.json'), 'utf8'));

const apps = new Map();
const files = new Map(); // `${id}/${n}` -> js text

function newApp(id, name, draft) {
  return {
    id,
    name,
    status: 'DRAFT',
    draft: draft || { schemaVersion: 1, application: { id, name }, routing: 'history', fields: [], pages: [], excludedPages: [] },
    draftUpdatedAt: new Date().toISOString(),
    submittedBy: null,
    rejection: null,
    versions: [],
  };
}
apps.set('dam-portal', newApp('dam-portal', 'DAM Portal', seed));

const VALUE_LIKE = [/\d{6,}/, /[A-Za-z]{5}\d{4}[A-Za-z]/, /@.*\./];
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const TARGETS = ['text', 'value', 'attr', 'column', 'title'];

function validate(c) {
  const errors = [];
  const warnings = [];
  const err = (p, m) => errors.push({ path: p, message: m });
  const warn = (p, m) => warnings.push({ path: p, message: m });
  const handle = (p, s) => {
    if (s && VALUE_LIKE.some((re) => re.test(s))) err(p, 'looks like a real value (digits, PAN or email): use a name, not a value');
  };
  const selector = (p, s) => {
    handle(p, s);
    const st = selectorStability(s);
    if (st.level === 'invalid') err(p, st.reason);
    else if (st.level !== 'stable') warn(p, `${st.level}: ${st.reason}`);
  };
  const codes = new Set();
  const names = new Map();
  (c.fields || []).forEach((f, i) => {
    if (!CODE.test(f.code || '')) err(`fields[${i}].code`, 'a letter, then letters, digits or _; 2–64 characters; upper case');
    else if (codes.has(f.code)) err(`fields[${i}].code`, `duplicate field code ${f.code}`);
    codes.add(f.code);
    (f.names || []).forEach((n, k) => {
      const key = String(n).toLowerCase().replace(/[_-]/g, '');
      if (names.has(key) && names.get(key) !== f.code) err(`fields[${i}].names[${k}]`, `"${n}" already belongs to ${names.get(key)}`);
      names.set(key, f.code);
    });
    (f.labels || []).forEach((l, k) => handle(`fields[${i}].labels[${k}]`, l));
  });
  (c.pages || []).forEach((p, i) => {
    const b = `pages[${i}]`;
    if (!String(p.path || '').startsWith('/')) err(`${b}.path`, 'must start with /');
    (p.query || []).forEach((q, k) => {
      if (!q.name) err(`${b}.query[${k}].name`, 'name is required');
    });
    (p.mappings || []).forEach((m, k) => {
      const mb = `${b}.mappings[${k}]`;
      if (!TARGETS.includes(m.target)) err(`${mb}.target`, 'unknown target');
      if (m.target !== 'title') selector(`${mb}.selector`, m.selector);
      if (m.target === 'attr' && !m.attr) err(`${mb}.attr`, 'attribute name is required');
      if (m.target === 'column' && !m.column) err(`${mb}.column`, 'column header is required');
      handle(`${mb}.after`, m.after);
      if (!codes.has(m.field)) err(`${mb}.field`, m.field ? `unknown field ${m.field}` : 'choose a field');
    });
    (p.exclusions || []).forEach((x, k) => {
      const xb = `${b}.exclusions[${k}]`;
      selector(`${xb}.selector`, x.selector);
      if (x.containing) selector(`${xb}.containing`, x.containing);
      (x.except || []).forEach((e, j) => selector(`${xb}.except[${j}]`, e));
    });
  });
  (c.excludedPages || []).forEach((x, i) => {
    if (!String(x).startsWith('/')) err(`excludedPages[${i}]`, 'must start with /');
  });
  return { errors, warnings };
}

const view = (a) => ({ ...a, validation: validate(a.draft) });

function send(res, code, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': typeof body === 'string' ? 'application/javascript' : 'application/json', ...headers });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        resolve(null);
      }
    });
  });
}

function build(a, n) {
  const runtime = { v: 3, app: a.id, generatedAt: new Date().toISOString(), routing: a.draft.routing, draft: a.draft };
  const js = `/* DDM browser SDK (MOCK build) app=${a.id} v${n} */\n(function(__DDM_CONFIG__){ /* engine */ })(${JSON.stringify(runtime)});\n`;
  const sha = crypto.createHash('sha256').update(js).digest('base64');
  files.set(`${a.id}/${n}`, js);
  return { sha, size: Buffer.byteLength(js) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // api, apps, id, ...
  if (parts[0] !== 'api' || parts[1] !== 'apps') return send(res, 404, { error: 'not found' });
  const id = parts[2];
  const a = id ? apps.get(id) : null;
  try {
    if (!id && req.method === 'GET') {
      return send(res, 200, [...apps.values()].map((x) => ({ id: x.id, name: x.name, status: x.status, latestVersion: x.versions.length || null })));
    }
    if (!id && req.method === 'POST') {
      const b = await readBody(req);
      if (!b || !b.id || !b.name) return send(res, 400, { error: 'id and name are required' });
      if (apps.has(b.id)) return send(res, 409, { error: `application ${b.id} already exists` });
      const x = newApp(b.id, b.name);
      apps.set(b.id, x);
      return send(res, 200, view(x));
    }
    if (!a) return send(res, 404, { error: `no application ${id}` });
    const action = parts[3];
    if (!action && req.method === 'GET') return send(res, 200, view(a));
    if (action === 'draft' && req.method === 'PUT') {
      const b = await readBody(req);
      if (!b) return send(res, 400, { error: 'invalid JSON' });
      a.draft = b;
      a.draftUpdatedAt = new Date().toISOString();
      a.status = 'DRAFT';
      return send(res, 200, view(a));
    }
    if (action === 'submit' && req.method === 'POST') {
      const b = (await readBody(req)) || {};
      if (a.status !== 'DRAFT') return send(res, 409, { error: 'only a DRAFT can be submitted' });
      if (validate(a.draft).errors.length) return send(res, 409, { error: 'the draft has errors' });
      a.status = 'PENDING_APPROVAL';
      a.submittedBy = b.by || null;
      a.rejection = null;
      return send(res, 200, view(a));
    }
    if (action === 'approve' && req.method === 'POST') {
      const b = (await readBody(req)) || {};
      if (a.status !== 'PENDING_APPROVAL') return send(res, 409, { error: 'not PENDING_APPROVAL' });
      const n = a.versions.length + 1;
      const { sha, size } = build(a, n);
      a.versions.push({
        version: n,
        approvedBy: b.by || null,
        approvedAt: new Date().toISOString(),
        submittedBy: a.submittedBy,
        sha256: sha,
        integrity: 'sha256-' + sha,
        fileName: `ddm-${a.id}-v${n}.min.js`,
        sizeBytes: size,
        mappingCount: (a.draft.pages || []).reduce((s, p) => s + (p.mappings || []).length, 0),
      });
      a.status = 'APPROVED';
      return send(res, 200, view(a));
    }
    if (action === 'reject' && req.method === 'POST') {
      const b = (await readBody(req)) || {};
      a.status = 'DRAFT';
      a.rejection = { by: b.by || null, reason: b.reason || '', at: new Date().toISOString() };
      return send(res, 200, view(a));
    }
    if (action === 'versions' && parts[5] === 'sdk.js') {
      const n = parts[4] === 'latest' ? a.versions.length : Number(parts[4]);
      const js = files.get(`${a.id}/${n}`);
      if (!js) return send(res, 404, { error: 'no such approved version' });
      return send(res, 200, js, { 'Content-Disposition': `attachment; filename="ddm-${a.id}-v${n}.min.js"` });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`DDM mock backend on http://localhost:${PORT}`));
