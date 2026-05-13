import { kvGet, kvPut, sha256hex, isAdminAuthed, jsonResp, htmlResp, jobsApi, warehouseJob } from './utils.js';
import { wallHTML } from './wall.js';
import { staffHTML } from './staff.js';
import { adminHTML } from './admin.js';
import { jobToEvent, taskToEvent, createEvent, updateEvent, deleteEvent } from './calendar.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Pages
      if (method === 'GET' && path === '/') return htmlResp(wallHTML());
      if (method === 'GET' && path === '/staff') return htmlResp(staffHTML());
      if (method === 'GET' && path === '/admin') return htmlResp(adminHTML());

      // Public data API
      if (method === 'GET' && path === '/api/data') return await getDataHandler(env);

      // Document serving (public — staff print from here)
      if (method === 'GET' && path.startsWith('/api/documents/')) {
        const key = path.slice('/api/documents/'.length);
        if (key) return await docServeHandler(request, env, key);
      }

      // Admin auth endpoints
      if (method === 'POST' && path === '/api/admin/login') return await adminLoginHandler(request, env);
      if (method === 'GET'  && path === '/api/admin/check') {
        return isAdminAuthed(request) ? jsonResp({ ok: true }) : jsonResp({ error: 'Unauthorised' }, 401);
      }
      if (method === 'POST' && path === '/api/admin/logout') return adminLogoutHandler();

      // Staff API (no auth)
      if (method === 'POST' && path === '/api/staff/claim')    return await staffClaimHandler(request, env);
      if (method === 'POST' && path === '/api/staff/unclaim')  return await staffUnclaimHandler(request, env);
      if (method === 'POST' && path === '/api/staff/complete') return await staffCompleteHandler(request, env);

      // Job completion (no auth — staff action)
      if (method === 'PATCH' && path.startsWith('/api/jobs/') && path.endsWith('/complete')) {
        const jobId = path.slice('/api/jobs/'.length, -'/complete'.length);
        return await jobCompleteHandler(request, env, jobId);
      }
      if (method === 'PATCH' && path.startsWith('/api/jobs/') && path.endsWith('/uncomplete')) {
        const jobId = path.slice('/api/jobs/'.length, -'/uncomplete'.length);
        return await jobUncompleteHandler(request, env, jobId);
      }

      // Notes API
      if (method === 'POST' && path === '/api/notes') return await notesCreateHandler(request, env);
      if (method === 'GET'  && path === '/api/notes/unread') {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        return await notesUnreadHandler(env);
      }
      if (method === 'GET'  && path === '/api/notes') {
        const url2 = new URL(request.url);
        const hasType = url2.searchParams.get('type');
        if (!hasType && !isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        return await notesListHandler(request, env);
      }
      if (method === 'PATCH' && path.startsWith('/api/notes/') && path.endsWith('/read')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        const noteId = path.slice('/api/notes/'.length, -'/read'.length);
        return await notesMarkReadHandler(env, noteId);
      }
      if (method === 'DELETE' && path.startsWith('/api/notes/')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        const noteId = path.slice('/api/notes/'.length);
        return await notesDeleteHandler(env, noteId);
      }

      // Attachments API (admin auth required)
      if (path === '/attachments') {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        if (method === 'POST') return await attachmentsUploadHandler(request, env);
        if (method === 'GET')  return await attachmentsListHandler(request, env);
      }
      if (method === 'GET' && path.startsWith('/attachments/') && path.endsWith('/view')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        const id = path.slice('/attachments/'.length, -'/view'.length);
        if (id && !id.includes('/')) return await attachmentsViewHandler(env, id);
      }
      if (method === 'GET' && path.startsWith('/attachments/') && path.endsWith('/download')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        const id = path.slice('/attachments/'.length, -'/download'.length);
        if (id && !id.includes('/')) return await attachmentsDownloadHandler(env, id);
      }
      if (method === 'DELETE' && path.startsWith('/attachments/')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        const id = path.slice('/attachments/'.length);
        if (id && !id.includes('/')) return await attachmentsDeleteHandler(env, id);
      }

      // Admin write API (auth required)
      if (method === 'POST' && path.startsWith('/api/admin/')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        if (path === '/api/admin/jobs/save')    return await adminJobSaveHandler(request, env);
        if (path === '/api/admin/jobs/delete')  return await adminJobDeleteHandler(request, env);
        if (path === '/api/admin/tasks/save')   return await adminTaskSaveHandler(request, env);
        if (path === '/api/admin/tasks/delete') return await adminTaskDeleteHandler(request, env);
        if (path === '/api/admin/crew/save')         return await adminCrewSaveHandler(request, env);
        if (path === '/api/admin/config/save')       return await adminConfigSaveHandler(request, env);
        if (path === '/api/admin/documents/upload')  return await adminDocUploadHandler(request, env);
        if (path === '/api/admin/documents/delete')  return await adminDocDeleteHandler(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error(err);
      return jsonResp({ error: 'Internal server error' }, 500);
    }
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

async function getDataHandler(env) {
  const [apiJobs, crewRecords, config] = await Promise.all([
    jobsApi(env, '/jobs'),
    jobsApi(env, '/crew').then(r => r ?? []),
    kvGet(env, 'config', { scrollInterval: 20000 }),
  ]);

  const crew = crewRecords.map(c => c.nickname || c.name);
  const jobs = (apiJobs || []).map(warehouseJob);
  const tasks = jobs.flatMap(j => (j.tasks || []).map(t => ({ ...t, jobId: j.id })));

  const { adminPasswordHash, ...safeConfig } = config;
  return jsonResp({ jobs, tasks, crew, config: safeConfig });
}

// ── Admin auth ───────────────────────────────────────────────────────────────

async function adminLoginHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { password } = body;
  if (!password) return jsonResp({ error: 'Password required' }, 400);

  const hash = await sha256hex(password);
  const config = await kvGet(env, 'config', {});

  let expectedHash = config.adminPasswordHash;

  // Bootstrap on first login: hash the env secret and persist it
  if (!expectedHash) {
    if (!env.ADMIN_PASSWORD) return jsonResp({ error: 'Admin password not configured on server' }, 500);
    expectedHash = await sha256hex(env.ADMIN_PASSWORD);
    config.adminPasswordHash = expectedHash;
    await kvPut(env, 'config', config);
  }

  if (hash !== expectedHash) return jsonResp({ error: 'Invalid password' }, 401);

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'warehouse_admin=1; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict'
    }
  });
}

function adminLogoutHandler() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'warehouse_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
    }
  });
}

// ── Task API helper ───────────────────────────────────────────────────────────

async function tasksApi(env, jobId, method = 'GET', body = null, taskId = null) {
  const path = taskId
    ? `/jobs/${jobId}/tasks/${taskId}`
    : `/jobs/${jobId}/tasks`;
  return jobsApi(env, path, method, body);
}

// ── Staff API ────────────────────────────────────────────────────────────────

async function staffClaimHandler(request, env) {
  const { taskId, jobId, staffName } = await request.json();
  if (!taskId || !jobId || !staffName) {
    return jsonResp({ error: 'taskId, jobId, staffName required' }, 400);
  }

  const crew = await kvGet(env, 'crew', []);
  if (!crew.includes(staffName)) return jsonResp({ error: 'Name not in crew list' }, 400);

  const tasks = await tasksApi(env, jobId);
  if (!tasks) return jsonResp({ error: 'Job not found' }, 404);

  const t = tasks.find(t => t.id === taskId);
  if (!t)                               return jsonResp({ error: 'Task not found' }, 404);
  if (t.status === 'complete')          return jsonResp({ error: 'Task is already complete' }, 400);
  if (t.assignedTo.includes(staffName)) return jsonResp({ error: 'Already assigned to this task' }, 400);
  if (t.assignedTo.length >= t.slots)   return jsonResp({ error: 'No slots available' }, 400);

  const updated = await tasksApi(env, jobId, 'PUT', {
    assignedTo: [...t.assignedTo, staffName],
  }, taskId);
  return jsonResp({ ok: true, task: updated });
}

async function staffUnclaimHandler(request, env) {
  const { taskId, jobId, staffName } = await request.json();
  if (!taskId || !jobId || !staffName) {
    return jsonResp({ error: 'taskId, jobId, staffName required' }, 400);
  }

  const tasks = await tasksApi(env, jobId);
  if (!tasks) return jsonResp({ error: 'Job not found' }, 404);

  const t = tasks.find(t => t.id === taskId);
  if (!t) return jsonResp({ error: 'Task not found' }, 404);
  if (!(t.assignedTo || []).includes(staffName)) return jsonResp({ error: 'Not assigned to this task' }, 400);

  const updated = await tasksApi(env, jobId, 'PUT', {
    assignedTo: (t.assignedTo || []).filter(n => n !== staffName),
  }, taskId);
  return jsonResp({ ok: true, task: updated });
}

async function staffCompleteHandler(request, env) {
  const { taskId, jobId } = await request.json();
  if (!taskId || !jobId) {
    return jsonResp({ error: 'taskId, jobId required' }, 400);
  }

  const updated = await tasksApi(env, jobId, 'PUT', {
    status:      'complete',
    completedAt: new Date().toISOString(),
  }, taskId);
  if (!updated) return jsonResp({ error: 'Task not found' }, 404);
  return jsonResp({ ok: true, task: updated });
}

// ── Job completion ───────────────────────────────────────────────────────────

async function jobCompleteHandler(request, env, jobId) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }
  const { name } = body;
  if (!name) return jsonResp({ error: 'name required' }, 400);

  const job = await jobsApi(env, `/jobs/${jobId}`);
  if (!job) return jsonResp({ error: 'Job not found' }, 404);

  const completions = job.completions || [];
  if (completions.includes(name)) return jsonResp({ ok: true, job });

  const updated = await jobsApi(env, `/jobs/${jobId}`, 'PUT', { completions: [...completions, name] });
  const assigned = updated.assigned_staff || [];
  if (assigned.length > 0 && (updated.completions || []).length === assigned.length) {
    pushJobComplete(env, updated).catch(() => {});
  }
  return jsonResp({ ok: true, job: updated });
}

async function jobUncompleteHandler(request, env, jobId) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }
  const { name } = body;
  if (!name) return jsonResp({ error: 'name required' }, 400);

  const job = await jobsApi(env, `/jobs/${jobId}`);
  if (!job) return jsonResp({ error: 'Job not found' }, 404);

  const updated = await jobsApi(env, `/jobs/${jobId}`, 'PUT', {
    completions: (job.completions || []).filter(n => n !== name),
  });
  return jsonResp({ ok: true, job: updated });
}

// ── Admin write API ──────────────────────────────────────────────────────────

async function adminJobSaveHandler(request, env) {
  const job = await request.json();
  if (job.startDate && job.endDate && job.endDate < job.startDate) {
    return jsonResp({ error: 'End date cannot be before start date' }, 400);
  }

  let saved;
  if (!job.id) {
    saved = await jobsApi(env, '/jobs', 'POST', job);
  } else {
    const existing = await jobsApi(env, `/jobs/${job.id}`);
    if (!existing) {
      saved = await jobsApi(env, '/jobs', 'POST', job);
    } else {
      if (existing.calendarEventId && !job.calendarEventId) job.calendarEventId = existing.calendarEventId;
      if (!job.completions) job.completions = existing.completions || [];
      saved = await jobsApi(env, `/jobs/${job.id}`, 'PUT', job);
    }
  }

  const wJob = warehouseJob(saved);
  let warning = null;
  if (wJob.startDate || wJob.date) {
    try {
      const event = jobToEvent(wJob);
      if (wJob.calendarEventId) {
        await updateEvent(env, wJob.calendarEventId, event);
      } else {
        const eventId = await createEvent(env, event);
        saved = await jobsApi(env, `/jobs/${saved.id}`, 'PUT', { calendarEventId: eventId });
      }
    } catch (e) {
      console.error('Calendar sync failed:', e);
      warning = 'Saved, but calendar sync failed';
    }
  }

  return jsonResp({ ok: true, job: warehouseJob(saved), ...(warning ? { warning } : {}) });
}

async function adminJobDeleteHandler(request, env) {
  const { id } = await request.json();
  const job = await jobsApi(env, `/jobs/${id}`);
  if (job && job.calendarEventId) {
    try { await deleteEvent(env, job.calendarEventId); } catch (e) { console.error('Calendar delete failed:', e); }
  }
  await jobsApi(env, `/jobs/${id}`, 'DELETE');
  return jsonResp({ ok: true });
}

async function adminTaskSaveHandler(request, env) {
  const data  = await request.json();
  const jobId = data.jobId && data.jobId !== 'none' ? data.jobId : 'standalone';

  // Fetch oldTask before write — required for calendar sync comparison
  let oldTask = null;
  if (data.id) {
    const tasks = await tasksApi(env, jobId);
    if (tasks) oldTask = tasks.find(t => t.id === data.id) ?? null;
  }

  // Write task to jobs-api
  let savedTask;
  if (data.id) {
    savedTask = await tasksApi(env, jobId, 'PUT', data, data.id);
  } else {
    savedTask = await tasksApi(env, jobId, 'POST', { ...data, jobId });
  }
  if (!savedTask) return jsonResp({ error: 'Job or task not found' }, 404);

  // Calendar sync — transplanted from original handler, paths unified
  let warning = null;
  const shouldSync      = savedTask.addToCalendar && savedTask.date;
  const calRemoved      = oldTask && oldTask.addToCalendar && !savedTask.addToCalendar && oldTask.calendarEventId;
  const existingEventId = oldTask?.calendarEventId || savedTask.calendarEventId;

  try {
    if (calRemoved) {
      await deleteEvent(env, oldTask.calendarEventId);
      await tasksApi(env, jobId, 'PUT', { calendarEventId: '' }, savedTask.id);
    } else if (shouldSync) {
      const parentJob = jobId === 'standalone'
        ? null
        : await jobsApi(env, `/jobs/${jobId}`);
      const event = taskToEvent(savedTask, parentJob ? [warehouseJob(parentJob)] : []);
      if (existingEventId) {
        await updateEvent(env, existingEventId, event);
      } else {
        const eventId = await createEvent(env, event);
        await tasksApi(env, jobId, 'PUT', { calendarEventId: eventId }, savedTask.id);
        savedTask.calendarEventId = eventId;
      }
    }
  } catch (e) {
    console.error('Calendar sync failed:', e);
    warning = 'Saved, but calendar sync failed';
  }

  return jsonResp(warning ? { ...savedTask, warning } : savedTask);
}

async function adminTaskDeleteHandler(request, env) {
  const body   = await request.json();
  const taskId = body.taskId || body.id;
  const jobId  = body.jobId  || 'standalone';
  if (!taskId) return jsonResp({ error: 'taskId required' }, 400);

  // Fetch task before deletion to retrieve calendarEventId
  const tasks = await tasksApi(env, jobId);
  const task  = tasks ? tasks.find(t => t.id === taskId) : null;

  // Calendar cleanup — errors swallowed, delete proceeds regardless
  if (task?.calendarEventId) {
    try { await deleteEvent(env, task.calendarEventId); }
    catch (e) { console.error('Calendar delete failed:', e); }
  }

  const result = await tasksApi(env, jobId, 'DELETE', null, taskId);
  if (!result) return jsonResp({ error: 'Task not found' }, 404);
  return jsonResp(result);
}

async function adminCrewSaveHandler(request, env) {
  const { crew } = await request.json();
  if (!Array.isArray(crew)) return jsonResp({ error: 'crew must be an array' }, 400);
  await kvPut(env, 'crew', crew);
  return jsonResp({ ok: true });
}

async function adminConfigSaveHandler(request, env) {
  const updates = await request.json();
  const config = await kvGet(env, 'config', { scrollInterval: 20000 });

  if (updates.scrollInterval !== undefined) config.scrollInterval = Number(updates.scrollInterval);
  if (updates.newPassword) config.adminPasswordHash = await sha256hex(updates.newPassword);

  await kvPut(env, 'config', config);
  return jsonResp({ ok: true });
}

// ── R2 document handlers ─────────────────────────────────────────────────────

async function adminDocUploadHandler(request, env) {
  let formData;
  try { formData = await request.formData(); } catch { return jsonResp({ error: 'Invalid form data' }, 400); }

  const file = formData.get('file');
  if (!file || typeof file.stream !== 'function') return jsonResp({ error: 'No file provided' }, 400);

  const mime = file.type || '';
  const isHtml = mime === 'text/html' || (file.name || '').toLowerCase().endsWith('.html');
  if (!mime.startsWith('image/') && mime !== 'application/pdf' && !isHtml) {
    return jsonResp({ error: 'Only PDF, image, and HTML files are allowed' }, 400);
  }

  const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const key = genId('doc') + '_' + safeName;

  await env.WAREHOUSE_R2.put(key, file.stream(), {
    httpMetadata: { contentType: mime }
  });

  return jsonResp({ ok: true, key, name: file.name });
}

async function docServeHandler(request, env, key) {
  const obj = await env.WAREHOUSE_R2.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Content-Disposition', 'inline');

  return new Response(obj.body, { headers });
}

async function adminDocDeleteHandler(request, env) {
  const { key, jobId, taskId } = await request.json();
  if (!key) return jsonResp({ error: 'key required' }, 400);

  await env.WAREHOUSE_R2.delete(key);

  if (jobId) {
    const job = await jobsApi(env, `/jobs/${jobId}`);
    if (job) await jobsApi(env, `/jobs/${jobId}`, 'PUT', { documentKey: null, documentName: null });
  }
  if (taskId) {
    const standalone = await kvGet(env, 'standalone_tasks', []);
    const sIdx = standalone.findIndex(t => t.id === taskId);
    if (sIdx !== -1) {
      delete standalone[sIdx].documentKey;
      delete standalone[sIdx].documentName;
      await kvPut(env, 'standalone_tasks', standalone);
    } else {
      const job = await findJobForTask(env, taskId);
      if (job) {
        const newTasks = (job.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          const nt = { ...t };
          delete nt.documentKey;
          delete nt.documentName;
          return nt;
        });
        await jobsApi(env, `/jobs/${job.id}`, 'PUT', { tasks: newTasks });
      }
    }
  }

  return jsonResp({ ok: true });
}

// ── Notes API ────────────────────────────────────────────────────────────────

async function notesCreateHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }
  const { type, ref_id, author, body: noteBody, parent_id } = body;
  if (!type || !author || !noteBody) return jsonResp({ error: 'type, author, and body required' }, 400);

  const note = {
    id:            genId('note'),
    type,
    ref_id:        ref_id || null,
    author,
    body:          noteBody,
    created_at:    new Date().toISOString(),
    read_by_admin: parent_id ? 1 : 0,
    parent_id:     parent_id || null,
  };

  await env.NOTES_DB.prepare(
    'INSERT INTO notes (id, type, ref_id, author, body, created_at, read_by_admin, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(note.id, note.type, note.ref_id, note.author, note.body, note.created_at, note.read_by_admin, note.parent_id).run();

  if (!note.parent_id) {
    Promise.all([
      sendNoteEmail(env, note).catch(() => {}),
      pushNote(env, note).catch(() => {}),
    ]);
  }

  return jsonResp({ ok: true, id: note.id });
}

async function notesListHandler(request, env) {
  const url    = new URL(request.url);
  const type   = url.searchParams.get('type');
  const ref_id = url.searchParams.get('ref_id');

  let stmt;
  if (type && ref_id) {
    stmt = env.NOTES_DB.prepare('SELECT * FROM notes WHERE type=? AND ref_id=? ORDER BY created_at ASC').bind(type, ref_id);
  } else if (type) {
    stmt = env.NOTES_DB.prepare('SELECT * FROM notes WHERE type=? ORDER BY created_at ASC').bind(type);
  } else {
    stmt = env.NOTES_DB.prepare('SELECT * FROM notes ORDER BY created_at DESC');
  }
  const { results } = await stmt.all();
  return jsonResp(results);
}

async function notesUnreadHandler(env) {
  const row = await env.NOTES_DB.prepare('SELECT COUNT(*) as count FROM notes WHERE read_by_admin=0').first();
  return jsonResp({ count: row ? row.count : 0 });
}

async function notesMarkReadHandler(env, id) {
  await env.NOTES_DB.prepare('UPDATE notes SET read_by_admin=1 WHERE id=?').bind(id).run();
  return jsonResp({ ok: true });
}

async function notesDeleteHandler(env, id) {
  await env.NOTES_DB.prepare('DELETE FROM notes WHERE parent_id=?').bind(id).run();
  await env.NOTES_DB.prepare('DELETE FROM notes WHERE id=?').bind(id).run();
  return jsonResp({ ok: true });
}

async function sendNoteEmail(env, note) {
  if (!env.RESEND_API_KEY) return;
  const subject = '[Note] ' + note.type + ': ' + (note.ref_id || 'general') + ' — from ' + note.author;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'warehouse@ravenstaging.co.uk',
      to:   ['e.kean@ravenstaging.co.uk'],
      subject,
      text: 'New note from ' + note.author + ':\n\n' + note.body + '\n\nView at https://warehouse.e-kean.workers.dev/admin',
    }),
  });
}

async function pushJobComplete(env, job) {
  await fetch('https://task-receiver.e-kean.workers.dev/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-token': 'raven-push-2026' },
    body: JSON.stringify({ lane: 'raven-ops', text: '[Job Complete] ' + (job.title || job.name) }),
  });
}

async function pushNote(env, note) {
  await fetch('https://task-receiver.e-kean.workers.dev/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-token': 'raven-push-2026' },
    body: JSON.stringify({
      lane: 'raven-ops',
      text: '[Note from ' + note.author + '] ' + note.body.slice(0, 80),
    }),
  });
}

// ── Attachments API ──────────────────────────────────────────────────────────

async function attachmentsUploadHandler(request, env) {
  let formData;
  try { formData = await request.formData(); } catch { return jsonResp({ error: 'Invalid form data' }, 400); }

  const file = formData.get('file');
  const task_id = formData.get('task_id');
  const uploaded_by = formData.get('uploaded_by') || 'admin';

  if (!file || typeof file.stream !== 'function') return jsonResp({ error: 'No file provided' }, 400);
  if (!task_id) return jsonResp({ error: 'task_id required' }, 400);

  const originalFilename = file.name || 'file';
  if (!originalFilename.toLowerCase().endsWith('.html')) {
    return jsonResp({ error: 'Only .html files are allowed' }, 400);
  }

  const id = genId('att');
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const r2_key = task_id + '/' + id + '/' + safeName;
  const uploaded_at = new Date().toISOString();

  await env.ATTACHMENTS.put(r2_key, file.stream(), {
    httpMetadata: { contentType: 'text/html; charset=utf-8' }
  });

  await env.NOTES_DB.prepare(
    'INSERT INTO attachments (id, task_id, filename, r2_key, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, task_id, originalFilename, r2_key, uploaded_by, uploaded_at).run();

  return jsonResp({ ok: true, id, filename: originalFilename, uploaded_at });
}

async function attachmentsListHandler(request, env) {
  const taskId = new URL(request.url).searchParams.get('task_id');
  if (!taskId) return jsonResp({ error: 'task_id required' }, 400);

  const { results } = await env.NOTES_DB.prepare(
    'SELECT id, task_id, filename, uploaded_by, uploaded_at FROM attachments WHERE task_id=? ORDER BY uploaded_at ASC'
  ).bind(taskId).all();

  return jsonResp(results);
}

async function attachmentsViewHandler(env, id) {
  const row = await env.NOTES_DB.prepare('SELECT r2_key, filename FROM attachments WHERE id=?').bind(id).first();
  if (!row) return new Response('Not Found', { status: 404 });

  const obj = await env.ATTACHMENTS.get(row.r2_key);
  if (!obj) return new Response('Not Found', { status: 404 });

  return new Response(obj.body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function attachmentsDownloadHandler(env, id) {
  const row = await env.NOTES_DB.prepare('SELECT r2_key, filename FROM attachments WHERE id=?').bind(id).first();
  if (!row) return new Response('Not Found', { status: 404 });

  const obj = await env.ATTACHMENTS.get(row.r2_key);
  if (!obj) return new Response('Not Found', { status: 404 });

  const safeName = row.filename.replace(/"/g, '');
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="' + safeName + '"'
    }
  });
}

async function attachmentsDeleteHandler(env, id) {
  const row = await env.NOTES_DB.prepare('SELECT r2_key FROM attachments WHERE id=?').bind(id).first();
  if (!row) return jsonResp({ error: 'Not found' }, 404);

  await env.ATTACHMENTS.delete(row.r2_key);
  await env.NOTES_DB.prepare('DELETE FROM attachments WHERE id=?').bind(id).run();

  return jsonResp({ ok: true });
}
