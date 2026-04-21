import { kvGet, kvPut, genId, sha256hex, isAdminAuthed, jsonResp, htmlResp } from './utils.js';
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

      // Admin write API (auth required)
      if (method === 'POST' && path.startsWith('/api/admin/')) {
        if (!isAdminAuthed(request)) return jsonResp({ error: 'Unauthorised' }, 401);
        if (path === '/api/admin/jobs/save')    return await adminJobSaveHandler(request, env);
        if (path === '/api/admin/jobs/delete')  return await adminJobDeleteHandler(request, env);
        if (path === '/api/admin/tasks/save')   return await adminTaskSaveHandler(request, env);
        if (path === '/api/admin/tasks/delete') return await adminTaskDeleteHandler(request, env);
        if (path === '/api/admin/crew/save')        return await adminCrewSaveHandler(request, env);
        if (path === '/api/admin/config/save')      return await adminConfigSaveHandler(request, env);
        if (path === '/api/admin/documents/upload') return await adminDocUploadHandler(request, env);
        if (path === '/api/admin/documents/delete') return await adminDocDeleteHandler(request, env);
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
  const [jobs, tasks, crew, config] = await Promise.all([
    kvGet(env, 'jobs', []),
    kvGet(env, 'tasks', []),
    kvGet(env, 'crew', []),
    kvGet(env, 'config', { scrollInterval: 20000 })
  ]);
  // Never expose the password hash
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

// ── Staff API ────────────────────────────────────────────────────────────────

async function staffClaimHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { taskId, staffName } = body;
  if (!taskId || !staffName) return jsonResp({ error: 'taskId and staffName required' }, 400);

  const [tasks, crew] = await Promise.all([
    kvGet(env, 'tasks', []),
    kvGet(env, 'crew', [])
  ]);

  if (!crew.includes(staffName)) return jsonResp({ error: 'Name not in crew list' }, 400);

  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return jsonResp({ error: 'Task not found' }, 404);

  const task = { ...tasks[idx] };
  const assigned = task.assignedTo || [];

  if (task.status === 'complete') return jsonResp({ error: 'Task is already complete' }, 400);
  if (assigned.includes(staffName)) return jsonResp({ error: 'Already assigned to this task' }, 400);
  if (assigned.length >= (task.slots || 1)) return jsonResp({ error: 'No slots available' }, 400);

  task.assignedTo = [...assigned, staffName];
  if (task.status === 'pending') task.status = 'inprogress';

  tasks[idx] = task;
  await kvPut(env, 'tasks', tasks);
  return jsonResp({ ok: true, task });
}

async function staffUnclaimHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { taskId, staffName } = body;
  if (!taskId || !staffName) return jsonResp({ error: 'taskId and staffName required' }, 400);

  const tasks = await kvGet(env, 'tasks', []);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return jsonResp({ error: 'Task not found' }, 404);

  const task = { ...tasks[idx] };
  if (!(task.assignedTo || []).includes(staffName)) return jsonResp({ error: 'Not assigned to this task' }, 400);

  task.assignedTo = (task.assignedTo || []).filter(n => n !== staffName);
  if (task.assignedTo.length === 0 && task.status === 'inprogress') task.status = 'pending';

  tasks[idx] = task;
  await kvPut(env, 'tasks', tasks);
  return jsonResp({ ok: true, task });
}

async function staffCompleteHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { taskId, staffName } = body;
  if (!taskId || !staffName) return jsonResp({ error: 'taskId and staffName required' }, 400);

  const tasks = await kvGet(env, 'tasks', []);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return jsonResp({ error: 'Task not found' }, 404);

  const task = { ...tasks[idx] };
  if (!(task.assignedTo || []).includes(staffName)) return jsonResp({ error: 'Not assigned to this task' }, 400);

  task.status = 'complete';
  task.completedAt = Date.now();

  tasks[idx] = task;
  await kvPut(env, 'tasks', tasks);
  return jsonResp({ ok: true, task });
}

// ── Admin write API ──────────────────────────────────────────────────────────

async function adminJobSaveHandler(request, env) {
  const job = await request.json();
  if (job.startDate && job.endDate && job.endDate < job.startDate) {
    return jsonResp({ error: 'End date cannot be before start date' }, 400);
  }
  const jobs = await kvGet(env, 'jobs', []);

  if (!job.id) {
    job.id = genId('job');
    jobs.push(job);
  } else {
    const idx = jobs.findIndex(j => j.id === job.id);
    if (idx === -1) {
      jobs.push(job);
    } else {
      // Preserve fields the admin form never sends back
      if (jobs[idx].calendarEventId && !job.calendarEventId) {
        job.calendarEventId = jobs[idx].calendarEventId;
      }
      if (!job.completions) job.completions = jobs[idx].completions || [];
      jobs[idx] = job;
    }
  }
  await kvPut(env, 'jobs', jobs);

  let warning = null;
  if (job.startDate || job.date) {
    try {
      const event = jobToEvent(job);
      if (job.calendarEventId) {
        await updateEvent(env, job.calendarEventId, event);
      } else {
        const eventId = await createEvent(env, event);
        job.calendarEventId = eventId;
        const idx = jobs.findIndex(j => j.id === job.id);
        if (idx !== -1) { jobs[idx] = job; await kvPut(env, 'jobs', jobs); }
      }
    } catch (e) {
      console.error('Calendar sync failed:', e);
      warning = 'Saved, but calendar sync failed';
    }
  }

  return jsonResp({ ok: true, job, ...(warning ? { warning } : {}) });
}

async function adminJobDeleteHandler(request, env) {
  const { id } = await request.json();
  let jobs = await kvGet(env, 'jobs', []);
  const job = jobs.find(j => j.id === id);
  if (job && job.calendarEventId) {
    try { await deleteEvent(env, job.calendarEventId); } catch (e) { console.error('Calendar delete failed:', e); }
  }
  jobs = jobs.filter(j => j.id !== id);
  await kvPut(env, 'jobs', jobs);
  return jsonResp({ ok: true });
}

async function adminTaskSaveHandler(request, env) {
  const task = await request.json();
  const [tasks, jobs] = await Promise.all([kvGet(env, 'tasks', []), kvGet(env, 'jobs', [])]);

  let oldTask = null;
  if (!task.id) {
    task.id = genId('task');
    task.createdAt = Date.now();
    task.assignedTo = task.assignedTo || [];
    task.status = task.status || 'pending';
    task.completedAt = null;
    tasks.push(task);
  } else {
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx === -1) {
      task.createdAt = task.createdAt || Date.now();
      tasks.push(task);
    } else {
      oldTask = { ...tasks[idx] };
      tasks[idx] = Object.assign({}, tasks[idx], task);
      // preserve calendarEventId if the incoming payload doesn't carry it
      if (oldTask.calendarEventId && !tasks[idx].calendarEventId) {
        tasks[idx].calendarEventId = oldTask.calendarEventId;
      }
    }
  }
  await kvPut(env, 'tasks', tasks);

  let warning = null;
  const shouldSync     = task.addToCalendar && task.date;
  const calRemoved     = oldTask && oldTask.addToCalendar && !task.addToCalendar && oldTask.calendarEventId;
  const existingEventId = (oldTask && oldTask.calendarEventId) || task.calendarEventId;
  try {
    if (calRemoved) {
      await deleteEvent(env, oldTask.calendarEventId);
      const idx = tasks.findIndex(t => t.id === task.id);
      if (idx !== -1) { delete tasks[idx].calendarEventId; await kvPut(env, 'tasks', tasks); }
    } else if (shouldSync) {
      const event = taskToEvent(task, jobs);
      if (existingEventId) {
        await updateEvent(env, existingEventId, event);
      } else {
        const eventId = await createEvent(env, event);
        const idx = tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) { tasks[idx].calendarEventId = eventId; await kvPut(env, 'tasks', tasks); }
      }
    }
  } catch (e) {
    console.error('Calendar sync failed:', e);
    warning = 'Saved, but calendar sync failed';
  }

  return jsonResp({ ok: true, task, ...(warning ? { warning } : {}) });
}

async function adminTaskDeleteHandler(request, env) {
  const { id } = await request.json();
  let tasks = await kvGet(env, 'tasks', []);
  const task = tasks.find(t => t.id === id);
  if (task && task.calendarEventId) {
    try { await deleteEvent(env, task.calendarEventId); } catch (e) { console.error('Calendar delete failed:', e); }
  }
  tasks = tasks.filter(t => t.id !== id);
  await kvPut(env, 'tasks', tasks);
  return jsonResp({ ok: true });
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
  if (!mime.startsWith('image/') && mime !== 'application/pdf') {
    return jsonResp({ error: 'Only PDF and image files are allowed' }, 400);
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
    const jobs = await kvGet(env, 'jobs', []);
    const idx = jobs.findIndex(j => j.id === jobId);
    if (idx !== -1) { delete jobs[idx].documentKey; delete jobs[idx].documentName; }
    await kvPut(env, 'jobs', jobs);
  }
  if (taskId) {
    const tasks = await kvGet(env, 'tasks', []);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) { delete tasks[idx].documentKey; delete tasks[idx].documentName; }
    await kvPut(env, 'tasks', tasks);
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
  const subject = '[Note] ' + note.type + ': ' + (note.ref_id || 'general') + ' \u2014 from ' + note.author;
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

async function jobCompleteHandler(request, env, jobId) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }
  const { name } = body;
  if (!name) return jsonResp({ error: 'name required' }, 400);

  const jobs = await kvGet(env, 'jobs', []);
  const idx = jobs.findIndex(j => j.id === jobId);
  if (idx === -1) return jsonResp({ error: 'Job not found' }, 404);

  const job = { ...jobs[idx] };
  job.completions = job.completions || [];
  if (!job.completions.includes(name)) job.completions = [...job.completions, name];
  jobs[idx] = job;
  await kvPut(env, 'jobs', jobs);

  const assigned = job.assigned_staff || [];
  if (assigned.length > 0 && job.completions.length === assigned.length) {
    pushJobComplete(env, job).catch(() => {});
  }

  return jsonResp({ ok: true, job });
}

async function jobUncompleteHandler(request, env, jobId) {
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }
  const { name } = body;
  if (!name) return jsonResp({ error: 'name required' }, 400);

  const jobs = await kvGet(env, 'jobs', []);
  const idx = jobs.findIndex(j => j.id === jobId);
  if (idx === -1) return jsonResp({ error: 'Job not found' }, 404);

  const job = { ...jobs[idx] };
  job.completions = (job.completions || []).filter(n => n !== name);
  jobs[idx] = job;
  await kvPut(env, 'jobs', jobs);

  return jsonResp({ ok: true, job });
}

async function pushJobComplete(env, job) {
  await fetch('https://task-receiver.e-kean.workers.dev/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-push-token': 'raven-push-2026' },
    body: JSON.stringify({ lane: 'raven-ops', text: '[Job Complete] ' + job.title }),
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
