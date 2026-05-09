export async function kvGet(env, key, fallback) {
  const raw = await env.WAREHOUSE_KV.get(key);
  if (raw === null) return fallback !== undefined ? fallback : [];
  try { return JSON.parse(raw); }
  catch { return fallback !== undefined ? fallback : []; }
}

export async function kvPut(env, key, data) {
  await env.WAREHOUSE_KV.put(key, JSON.stringify(data));
}

export function genId(prefix) {
  prefix = prefix || 'id';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + '_' + hex;
}

export async function sha256hex(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isAdminAuthed(request) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.split(';').some(c => c.trim() === 'warehouse_admin=1');
}

export function jsonResp(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function htmlResp(html, status) {
  return new Response(html, {
    status: status || 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

const JOBS_API_URL = 'https://jobs-api.e-kean.workers.dev';
const JOBS_API_KEY = 'raven-jobs-2026';

export async function jobsApi(env, path, method = 'GET', body = null) {
  const req = new Request(JOBS_API_URL + path, {
    method,
    headers: { 'x-api-key': JOBS_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await env.JOBS_API_SVC.fetch(req);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('jobs-api ' + method + ' ' + path + ' → ' + res.status);
  return res.json();
}

export function warehouseJob(j) {
  return {
    ...j,
    title:     j.title     || j.name      || '',
    colorHex:  j.colorHex  || j.colour    || '#ffffff',
    startDate: j.startDate || j.dateStart || null,
    endDate:   j.endDate   || j.dateEnd   || null,
  };
}

export async function findJobForTask(env, taskId) {
  const jobs = await jobsApi(env, '/jobs');
  if (!Array.isArray(jobs)) return null;
  return jobs.find(j => Array.isArray(j.tasks) && j.tasks.some(t => t.id === taskId)) || null;
}
