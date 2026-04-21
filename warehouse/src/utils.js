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
