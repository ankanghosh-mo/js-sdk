// Authoring-config helpers: UI defaults in, contract shape out (CONTRACT.md section 1).
import { MASKING_FUNCTIONS } from '@sdk/masking.js';

export const TARGETS = ['text', 'value', 'attr', 'column', 'title'];
export const AFTER_TARGETS = ['text', 'attr', 'title', 'value'];

export function fnDef(code) {
  return MASKING_FUNCTIONS.find((f) => f.code === code);
}

/** Default parameters of a masking function (empty optional strings left out). */
export function defaultParams(code) {
  const def = fnDef(code);
  const p = {};
  if (!def) return p;
  for (const d of def.params) if (d.default !== '' && d.default !== undefined) p[d.key] = d.default;
  return p;
}

export function emptyConfig(id, name) {
  return { schemaVersion: 1, application: { id, name }, routing: 'history', fields: [], pages: [], excludedPages: [] };
}

const arr = (v) => (Array.isArray(v) ? v : []);

/** Fills in missing arrays and objects so the editors never see undefined. */
export function normalize(c, app) {
  const src = c || emptyConfig(app?.id, app?.name);
  return {
    schemaVersion: src.schemaVersion ?? 1,
    application: src.application || { id: app?.id, name: app?.name },
    routing: src.routing || 'history',
    fields: arr(src.fields).map((f) => ({
      code: f.code ?? '',
      masking: { function: f.masking?.function || 'PARTIAL_MASK', params: { ...(f.masking?.params || {}) } },
      names: arr(f.names),
      columns: arr(f.columns),
      labels: arr(f.labels),
      reveal: !!f.reveal,
    })),
    pages: arr(src.pages).map((p) => ({
      path: p.path ?? '',
      query: arr(p.query),
      mappings: arr(p.mappings),
      exclusions: arr(p.exclusions).map((x) => ({ ...x, except: arr(x.except) })),
    })),
    excludedPages: arr(src.excludedPages),
  };
}

function cleanParams(fn, params) {
  const def = fnDef(fn);
  if (!def) return { ...params };
  const out = {};
  for (const d of def.params) {
    let v = params?.[d.key];
    if (v === undefined || v === null || v === '') continue;
    if (d.type === 'int') {
      const n = parseInt(v, 10);
      if (Number.isNaN(n)) continue;
      v = n;
    } else if (d.type === 'bool') v = v === true || String(v) === 'true';
    else v = String(v);
    out[d.key] = v;
  }
  return out;
}

const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';

/** The config exactly in the contract's shape; empty optional keys are left out. */
export function cleanConfig(c) {
  return {
    schemaVersion: c.schemaVersion ?? 1,
    application: { id: c.application?.id, name: c.application?.name },
    routing: c.routing || 'history',
    fields: c.fields.map((f) => ({
      code: f.code,
      masking: { function: f.masking.function, params: cleanParams(f.masking.function, f.masking.params) },
      names: f.names,
      columns: f.columns,
      labels: f.labels,
      reveal: !!f.reveal,
    })),
    pages: c.pages.map((p) => {
      const page = { path: p.path };
      if (p.query.length) {
        page.query = p.query.map((q) => (q.present ? { name: q.name ?? '', present: true } : { name: q.name ?? '', equals: q.equals ?? '' }));
      }
      page.mappings = p.mappings.map((m) => {
        const target = m.target || 'text';
        const out = { selector: target === 'title' ? 'title' : m.selector ?? '', target };
        if (target === 'attr') out.attr = m.attr ?? '';
        if (target === 'column') out.column = m.column ?? '';
        if (AFTER_TARGETS.includes(target) && nonEmpty(m.after)) out.after = m.after;
        out.field = m.field ?? '';
        return out;
      });
      page.exclusions = p.exclusions.map((x) => {
        const out = { selector: x.selector ?? '' };
        if (nonEmpty(x.containing)) out.containing = x.containing;
        const except = arr(x.except).filter(nonEmpty);
        if (except.length) out.except = except;
        return out;
      });
      return page;
    }),
    excludedPages: c.excludedPages,
  };
}

const EMPTY_V = { errors: [], warnings: [] };

/** Issues (errors + warnings) whose path is `prefix` or below it. */
export function issuesUnder(validation, prefix) {
  const v = validation || EMPTY_V;
  const hit = (i) => typeof i.path === 'string' && (i.path === prefix || i.path.startsWith(prefix + '.') || i.path.startsWith(prefix + '['));
  return { errors: (v.errors || []).filter(hit), warnings: (v.warnings || []).filter(hit) };
}

/** 'err' / 'warn' / '' for an exact path (used to colour an input). */
export function levelAt(validation, path) {
  const v = validation || EMPTY_V;
  const under = (i) => typeof i.path === 'string' && (i.path === path || i.path.startsWith(path + '['));
  if ((v.errors || []).some(under)) return 'err';
  if ((v.warnings || []).some(under)) return 'warn';
  return '';
}

export function queryLabel(query) {
  if (!query || !query.length) return '';
  return '?' + query.map((q) => (q.present ? q.name : `${q.name}=${q.equals ?? ''}`)).join('&');
}

export function formatBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function formatTime(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString();
}

export const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      /* storage blocked: ignore */
    }
  },
};
