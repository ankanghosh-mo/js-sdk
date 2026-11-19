// Thin client for the backend REST API (CONTRACT.md section 3). In dev, /api is proxied to :8095.

export const DOWN_MESSAGE = 'Backend not reachable on :8095';

export class ApiError extends Error {
  constructor(message, status, down) {
    super(message);
    this.status = status;
    this.down = down;
  }
}

async function req(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError(DOWN_MESSAGE, 0, true);
  }
  const isJson = (res.headers.get('content-type') || '').includes('json');
  let data = null;
  if (isJson) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  }
  if (!res.ok) {
    // The dev proxy answers 500/502/504 with an empty, non-JSON body when the backend is not running.
    if (!isJson && res.status >= 500) throw new ApiError(DOWN_MESSAGE, res.status, true);
    throw new ApiError((data && data.error) || `HTTP ${res.status}`, res.status, false);
  }
  return data;
}

const app = (id) => `/api/apps/${encodeURIComponent(id)}`;

export const api = {
  listApps: () => req('GET', '/api/apps'),
  createApp: (id, name) => req('POST', '/api/apps', { id, name }),
  getApp: (id) => req('GET', app(id)),
  saveDraft: (id, config) => req('PUT', `${app(id)}/draft`, config),
  submit: (id, by) => req('POST', `${app(id)}/submit`, { by }),
  approve: (id, by) => req('POST', `${app(id)}/approve`, { by }),
  reject: (id, by, reason) => req('POST', `${app(id)}/reject`, { by, reason }),
  sdkUrl: (id, n) => `${app(id)}/versions/${encodeURIComponent(n)}/sdk.js`,
};
