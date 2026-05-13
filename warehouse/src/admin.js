export function adminHTML() {
  const COLOURS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#c9a84c','#ecf0f1','#95a5a6'];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Raven Warehouse — Admin</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  min-height: 100%;
  background: #0a0a0a;
  color: #f0f0f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  font-size: 14px;
}

/* Login overlay */
#login-overlay {
  position: fixed; inset: 0;
  background: #0a0a0a;
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
#login-overlay.hidden { display: none; }
#login-box {
  background: #111; border: 1px solid #222; border-radius: 12px;
  padding: 40px; width: 340px; max-width: calc(100vw - 32px);
}
#login-box h1 { font-size: 1.3rem; font-weight: 800; color: #c9a84c; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
#login-box p  { color: #555; font-size: 0.85rem; margin-bottom: 24px; }
#login-error  { color: #e74c3c; font-size: 0.85rem; margin-bottom: 12px; min-height: 18px; }

/* Common form elements */
label { display: block; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #777; margin-bottom: 6px; }
input[type=text], input[type=date], input[type=time], input[type=datetime-local], input[type=number], input[type=password], textarea, select {
  width: 100%; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 6px;
  color: #f0f0f0; padding: 9px 12px; font-size: 0.92rem; font-family: inherit;
  transition: border-color 0.15s; outline: none;
}
input:focus, textarea:focus, select:focus { border-color: #c9a84c; }
textarea { resize: vertical; min-height: 70px; }
.field { margin-bottom: 14px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

/* Buttons */
.btn {
  padding: 9px 18px; border-radius: 6px; font-size: 0.85rem; font-weight: 700;
  cursor: pointer; border: none; transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; }
.btn-gold   { background: #c9a84c; color: #000; }
.btn-danger { background: #e74c3c; color: #fff; }
.btn-ghost  { background: transparent; border: 1px solid #333; color: #aaa; }
.btn-sm     { padding: 5px 12px; font-size: 0.78rem; }

/* App shell */
#admin-shell { display: none; flex-direction: column; min-height: 100vh; }
#admin-shell.visible { display: flex; }

/* Top bar */
#top-bar {
  background: #0d0d0d; border-bottom: 1px solid #1a1a1a;
  padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 10;
}
#top-bar-title { font-size: 0.95rem; font-weight: 800; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.12em; }

/* Section tabs */
#sec-tabs {
  display: flex; gap: 2px; background: #0d0d0d; border-bottom: 1px solid #1a1a1a;
  padding: 0 24px; position: sticky; top: 49px; z-index: 9;
}
.sec-tab {
  padding: 12px 18px; background: none; border: none; border-bottom: 2px solid transparent;
  color: #555; font-size: 0.88rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  cursor: pointer; transition: color 0.15s, border-color 0.15s;
}
.sec-tab.active { color: #c9a84c; border-bottom-color: #c9a84c; }

/* Main content */
#main { padding: 28px 24px; max-width: 960px; }
.sec-panel { display: none; }
.sec-panel.active { display: block; }

/* Add/edit form card */
.form-card {
  background: #111; border: 1px solid #1e1e1e; border-radius: 10px;
  padding: 20px 24px; margin-bottom: 28px;
}
.form-card h2 { font-size: 0.88rem; font-weight: 800; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 18px; }
.form-actions { display: flex; gap: 10px; margin-top: 4px; align-items: center; }
#edit-id-hint { font-size: 0.78rem; color: #555; }

/* Colour picker */
.color-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.c-swatch {
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
  border: 3px solid transparent; transition: border-color 0.15s, transform 0.1s;
}
.c-swatch.sel { border-color: #fff; transform: scale(1.2); }
.c-preview    { display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: middle; margin-right: 4px; }

/* File attachment */
input[type=file] {
  padding: 7px 10px; border: 1px dashed #2a2a2a; cursor: pointer; color: #888; font-size: 0.82rem; background: #0d0d0d; border-radius: 6px;
}
input[type=file]:hover { border-color: #c9a84c; }
.attach-current {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: #0d0d0d; border: 1px solid #1e1e1e; border-radius: 6px;
  margin-bottom: 8px; font-size: 0.85rem;
}
.attach-current .doc-name { flex: 1; color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Table */
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  text-align: left; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #555; padding: 8px 12px; border-bottom: 1px solid #1a1a1a;
}
.data-table td { padding: 10px 12px; border-bottom: 1px solid #151515; vertical-align: middle; font-size: 0.88rem; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: #111; }
.tbl-actions { display: flex; gap: 6px; }

/* Crew list */
#crew-list { margin-bottom: 20px; }
.crew-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: #111; border: 1px solid #1e1e1e; border-radius: 8px; margin-bottom: 6px;
}
.crew-name { font-weight: 600; }

/* Toggle */
.toggle-row { display: flex; align-items: center; gap: 10px; }
.toggle {
  position: relative; width: 38px; height: 20px;
  background: #2a2a2a; border-radius: 999px; cursor: pointer; transition: background 0.2s;
  border: none; flex-shrink: 0;
}
.toggle.on { background: #c9a84c; }
.toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: left 0.2s;
}
.toggle.on::after { left: 21px; }

/* Notes */
.note-item {
  background: #111; border: 1px solid #1e1e1e; border-radius: 8px;
  padding: 14px 16px; margin-bottom: 10px; transition: border-color 0.15s;
  position: relative;
}
.note-item:hover { border-color: #333; }
.note-item.unread { border-left: 3px solid #c9a84c; cursor: pointer; }
.btn-note-delete {
  position: absolute; top: 10px; right: 10px;
  background: none; border: none; color: #333; font-size: 0.8rem;
  cursor: pointer; padding: 2px 5px; border-radius: 4px; line-height: 1;
  transition: color 0.15s, background 0.15s;
}
.btn-note-delete:hover { color: #e74c3c; background: rgba(231,76,60,0.1); }
.note-reply { padding: 7px 0; border-bottom: 1px solid #161616; position: relative; }
.note-reply .btn-note-delete { top: 6px; }
.note-reply:last-child { border-bottom: none; }
.note-meta { font-size: 0.75rem; color: #555; margin-bottom: 4px; }
.note-author { color: #c9a84c; font-weight: 700; }
.note-body { font-size: 0.9rem; color: #ddd; line-height: 1.5; }
.note-ref { font-size: 0.75rem; color: #666; margin-top: 4px; }
.note-ref-header { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #8a7540; margin-bottom: 5px; }
.notes-group-label {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: #444; padding: 16px 0 8px;
}
.note-replies { margin-top: 10px; padding-left: 14px; border-left: 2px solid #1e1e1e; }
.note-reply-meta { font-size: 0.73rem; color: #555; margin-bottom: 3px; }
.note-reply-body { font-size: 0.85rem; color: #bbb; line-height: 1.4; }
.note-reply-form { margin-top: 12px; display: flex; gap: 8px; align-items: flex-start; }
.note-reply-input {
  flex: 1; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 6px;
  color: #f0f0f0; padding: 7px 10px; font-size: 0.85rem; font-family: inherit;
  outline: none; resize: vertical; min-height: 54px;
}
.note-reply-input:focus { border-color: #c9a84c; }

/* Attachment panel */
.attach-panel { padding: 10px 16px 14px; border-top: 1px solid #1a1a1a; background: #080808; }
.attach-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #151515; }
.attach-filename { flex: 1; color: #ccc; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.attach-date { color: #555; font-size: 0.75rem; flex-shrink: 0; }
.attach-upload { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
.attach-upload input[type=file] { flex: 1; min-width: 0; }
.attach-badge { background: #3498db; color: #fff; font-size: 0.68rem; padding: 1px 5px; border-radius: 999px; margin-left: 5px; font-weight: 800; vertical-align: middle; }

/* Toast */
#toast {
  position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
  background: #1a2a1a; border: 1px solid #2ecc71; border-radius: 8px; color: #2ecc71;
  font-size: 0.88rem; font-weight: 600; z-index: 300;
  opacity: 0; transform: translateY(8px); transition: opacity 0.25s, transform 0.25s;
  pointer-events: none;
}
#toast.err { background: #2a1a1a; border-color: #e74c3c; color: #e74c3c; }
#toast.show { opacity: 1; transform: translateY(0); }
</style>
</head>
<body>

<!-- Login overlay -->
<div id="login-overlay">
  <div id="login-box">
    <h1>Warehouse Admin</h1>
    <p>Enter your admin password to continue</p>
    <div id="login-error"></div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="login-pw" placeholder="Password" autocomplete="current-password">
    </div>
    <button class="btn btn-gold" id="login-btn" style="width:100%">Login</button>
  </div>
</div>

<!-- Admin shell -->
<div id="admin-shell">
  <div id="top-bar">
    <div id="top-bar-title">Raven Warehouse &mdash; Admin</div>
    <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
  </div>

  <div id="sec-tabs">
    <button class="sec-tab active" data-sec="jobs">Jobs</button>
    <button class="sec-tab" data-sec="tasks">Tasks</button>
    <button class="sec-tab" data-sec="crew">Crew</button>
    <button class="sec-tab" data-sec="config">Config</button>
    <button class="sec-tab" data-sec="completed">Completed</button>
    <button class="sec-tab" data-sec="notes">Notes <span id="notes-badge" style="display:none;background:#c9a84c;color:#000;font-size:0.7rem;padding:1px 6px;border-radius:999px;margin-left:4px;font-weight:800;vertical-align:middle"></span></button>
  </div>

  <div id="main">

    <!-- ── Jobs ── -->
    <div class="sec-panel active" id="sec-jobs">
      <div class="form-card">
        <h2 id="jobs-form-title">Add Job</h2>
        <input type="hidden" id="job-id">
        <div class="row">
          <div class="field"><label>Start Date</label><input type="date" id="job-start-date"></div>
          <div class="field"><label>End Date <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input type="date" id="job-end-date"></div>
        </div>
        <div class="row">
          <div class="field"><label>Time</label><input type="time" id="job-time"></div>
          <div class="field"><label>Status</label>
            <select id="job-status">
              <option value="pending-quote">Pending Quote</option>
              <option value="provisional">Provisional</option>
              <option value="confirmed">Confirmed</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Shift Start <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(optional — shown on staff &amp; wall)</span></label><input type="datetime-local" id="job-shift-start"></div>
        <div class="field"><label>Title</label><input type="text" id="job-title" placeholder="Leeds Festival — Load In"></div>
        <div class="field"><label>Venue / Location <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input type="text" id="job-venue" placeholder="Bramham Park, Leeds"></div>
        <div class="row">
          <div class="field"><label>Client</label><input type="text" id="job-client"></div>
          <div class="field"><label>Contact Name</label><input type="text" id="job-contact-name"></div>
        </div>
        <div class="row">
          <div class="field"><label>Contact Phone</label><input type="text" id="job-contact-phone"></div>
          <div class="field"><label>Contact Email</label><input type="text" id="job-contact-email"></div>
        </div>
        <div class="row">
          <div class="field"><label>Crew Size</label><input type="number" id="job-crew-size" min="1" placeholder="6"></div>
          <div class="field"></div>
        </div>
        <div class="field"><label>Description</label><textarea id="job-desc" placeholder="Crew of 6, meet at yard 06:30."></textarea></div>
        <div class="field"><label>Notes <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(internal)</span></label><textarea id="job-notes"></textarea></div>
        <div class="field">
          <label>Assigned Staff</label>
          <div id="job-staff-checkboxes" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px"></div>
        </div>
        <div class="field"><label>Colour</label><div class="color-picker" id="job-colors"></div><input type="hidden" id="job-color"></div>
        <div class="field">
          <label>Attach Document (PDF or image)</label>
          <div class="attach-current" id="job-attach-current" style="display:none">
            <span class="doc-name" id="job-attach-doc-name"></span>
            <button class="btn btn-danger btn-sm" id="job-remove-doc-btn" type="button">Remove</button>
          </div>
          <input type="file" id="job-file" accept="application/pdf,image/*">
          <input type="hidden" id="job-doc-key">
          <input type="hidden" id="job-doc-name">
        </div>
        <div class="form-actions">
          <button class="btn btn-gold" id="job-save-btn">Add Job</button>
          <button class="btn btn-ghost" id="job-cancel-btn" style="display:none">Cancel edit</button>
          <span id="edit-id-hint"></span>
        </div>
      </div>
      <table class="data-table" id="jobs-table">
        <thead><tr><th>Date</th><th>Time</th><th>Title</th><th>Description</th><th>Colour</th><th>Actions</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>

    <!-- ── Tasks ── -->
    <div class="sec-panel" id="sec-tasks">
      <div class="form-card">
        <h2 id="tasks-form-title">Add Task</h2>
        <input type="hidden" id="task-id">
        <div class="field"><label>Title</label><input type="text" id="task-title" placeholder="Prep deck sections"></div>
        <div class="field"><label>Detail</label><textarea id="task-detail" placeholder="Pull 1.5m and 1.0m deck from rack B."></textarea></div>
        <div class="field"><label>Notes <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(internal / calendar)</span></label><textarea id="task-notes"></textarea></div>
        <div class="row">
          <div class="field"><label>Date <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input type="date" id="task-date"></div>
          <div class="field"><label>Add to Calendar</label>
            <div class="toggle-row">
              <button class="toggle" id="task-cal-toggle" data-on="false" style="opacity:0.4;cursor:not-allowed"></button>
              <span id="task-cal-label" style="font-size:0.85rem;color:#555">Off</span>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="field"><label>Start Time</label><input type="time" id="task-start-time"></div>
          <div class="field"><label>End Time <span style="color:#555;font-weight:400;text-transform:none;letter-spacing:0">(optional)</span></label><input type="time" id="task-end-time"></div>
        </div>
        <div id="task-cal-fields" style="display:none">
          <div class="field"><label>Venue / Location</label><input type="text" id="task-cal-venue" placeholder="Bramham Park, Leeds"></div>
          <div class="row">
            <div class="field"><label>Client</label><input type="text" id="task-cal-client"></div>
            <div class="field"><label>Contact Name</label><input type="text" id="task-cal-contact-name"></div>
          </div>
          <div class="row">
            <div class="field"><label>Contact Phone</label><input type="text" id="task-cal-contact-phone"></div>
            <div class="field"><label>Contact Email</label><input type="text" id="task-cal-contact-email"></div>
          </div>
        </div>
        <div class="row3">
          <div class="field"><label>Slots</label><input type="number" id="task-slots" value="1" min="1" max="20"></div>
          <div class="field"><label>Status</label>
            <select id="task-status">
              <option value="pending">Pending</option>
              <option value="inprogress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div class="field"><label>Priority</label>
            <div class="toggle-row">
              <button class="toggle" id="task-priority-toggle" data-on="false"></button>
              <span id="task-priority-label" style="font-size:0.85rem;color:#555">Off</span>
            </div>
          </div>
        </div>
        <div class="field">
          <label>Linked Job</label>
          <select id="task-job-id">
            <option value="">None / standalone task</option>
          </select>
        </div>
        <div class="field"><label>Colour</label><div class="color-picker" id="task-colors"></div><input type="hidden" id="task-color"></div>
        <div class="field">
          <label>Attach Document</label>
          <div class="attach-current" id="task-attach-current" style="display:none">
            <span class="doc-name" id="task-attach-doc-name"></span>
            <button class="btn btn-danger btn-sm" id="task-remove-doc-btn" type="button">Remove</button>
          </div>
          <input type="file" id="task-file" accept=".pdf,.html,image/*">
          <input type="hidden" id="task-doc-key">
          <input type="hidden" id="task-doc-name">
        </div>
        <div class="form-actions">
          <button class="btn btn-gold" id="task-save-btn">Add Task</button>
          <button class="btn btn-ghost" id="task-cancel-btn" style="display:none">Cancel edit</button>
        </div>
      </div>
      <table class="data-table" id="tasks-table">
        <thead><tr><th>Title</th><th>Job</th><th>Slots</th><th>Assigned</th><th>Status</th><th>Priority</th><th>Colour</th><th>Actions</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>

    <!-- ── Crew ── -->
    <div class="sec-panel" id="sec-crew">
      <div class="form-card">
        <h2>Crew Members</h2>
        <div id="crew-list"></div>
        <div class="form-actions" style="margin-top:8px">
          <input type="text" id="new-crew-name" placeholder="First name" style="max-width:200px">
          <button class="btn btn-gold" id="add-crew-btn">Add</button>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-gold" id="save-crew-btn">Save Crew</button>
        </div>
      </div>
    </div>

    <!-- ── Config ── -->
    <div class="sec-panel" id="sec-config">
      <div class="form-card">
        <h2>Display Config</h2>
        <div class="field" style="max-width:280px">
          <label>Scroll Interval (ms)</label>
          <input type="number" id="cfg-scroll" value="20000" min="5000" step="1000">
        </div>
        <button class="btn btn-gold" id="save-config-btn" style="margin-top:8px">Save Config</button>
      </div>
      <div class="form-card">
        <h2>Change Admin Password</h2>
        <div class="field" style="max-width:280px">
          <label>New Password</label>
          <input type="password" id="new-pw" placeholder="Leave blank to keep current">
        </div>
        <button class="btn btn-gold" id="save-pw-btn">Update Password</button>
      </div>
    </div>

    <!-- ── Completed ── -->
    <div class="sec-panel" id="sec-completed">
      <table class="data-table" id="completed-table">
        <thead><tr><th>Date</th><th>Time</th><th>Title</th><th>Description</th><th>Colour</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>

    <!-- ── Notes ── -->
    <div class="sec-panel" id="sec-notes">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <button class="btn btn-ghost btn-sm" id="refresh-notes-btn">Refresh</button>
        <span id="notes-panel-count" style="font-size:0.8rem;color:#555"></span>
      </div>
      <div id="notes-list"><div style="color:#333;font-style:italic;padding:24px;text-align:center">No notes yet</div></div>
    </div>

  </div><!-- #main -->
</div><!-- #admin-shell -->

<div id="toast"></div>

<script>
(function () {
  var COLOURS = ${JSON.stringify(COLOURS)};
  var appData = { jobs: [], tasks: [], crew: [], config: { scrollInterval: 20000, expireAfterHours: 48 } };
  var crewDraft = [];

  // ── Toast ──────────────────────────────────────────────────────────────────

  var toastTimer;
  function toast(msg, isErr) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = isErr ? 'err show' : 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.className = isErr ? 'err' : ''; }, 2800);
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  async function checkAuth() {
    var res = await fetch('/api/admin/check');
    if (res.ok) showShell();
    else showLogin();
  }

  function showLogin() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('admin-shell').classList.remove('visible');
  }

  function showShell() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('admin-shell').classList.add('visible');
    loadData();
    updateNotesBadge();
  }

  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-pw').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    var pw = document.getElementById('login-pw').value;
    document.getElementById('login-error').textContent = '';
    try {
      var res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      var json = await res.json();
      if (!res.ok) { document.getElementById('login-error').textContent = json.error || 'Login failed'; return; }
      document.getElementById('login-pw').value = '';
      showShell();
    } catch (e) {
      document.getElementById('login-error').textContent = 'Network error';
    }
  }

  document.getElementById('logout-btn').addEventListener('click', async function() {
    await fetch('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  // ── Section tabs ───────────────────────────────────────────────────────────

  document.querySelectorAll('.sec-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.sec-tab').forEach(function(b) { b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.sec-panel').forEach(function(p) {
        p.classList.toggle('active', p.id === 'sec-' + btn.dataset.sec);
      });
      if (btn.dataset.sec === 'notes') renderNotes();
      if (btn.dataset.sec === 'completed') renderCompletedJobs();
    });
  });

  // ── Colour pickers ─────────────────────────────────────────────────────────

  function buildColorPicker(containerId, inputId, initial) {
    var container = document.getElementById(containerId);
    var input = document.getElementById(inputId);
    container.innerHTML = '';
    COLOURS.forEach(function(c) {
      var sw = document.createElement('button');
      sw.className = 'c-swatch' + (c === (initial || COLOURS[0]) ? ' sel' : '');
      sw.style.background = c;
      sw.title = c;
      sw.type = 'button';
      sw.addEventListener('click', function() {
        container.querySelectorAll('.c-swatch').forEach(function(s) { s.classList.remove('sel'); });
        sw.classList.add('sel');
        input.value = c;
      });
      container.appendChild(sw);
    });
    input.value = initial || COLOURS[0];
  }

  function setColorPicker(containerId, inputId, color) {
    var container = document.getElementById(containerId);
    container.querySelectorAll('.c-swatch').forEach(function(sw) {
      sw.classList.toggle('sel', sw.style.background === hexToRgb(color) || sw.title === color);
    });
    document.getElementById(inputId).value = color;
  }

  // Chrome converts hex to rgb in style.background, so compare via title
  function selectSwatch(containerId, inputId, color) {
    document.getElementById(inputId).value = color || COLOURS[0];
    document.getElementById(containerId).querySelectorAll('.c-swatch').forEach(function(sw) {
      sw.classList.toggle('sel', sw.title === (color || COLOURS[0]));
    });
  }

  buildColorPicker('job-colors', 'job-color', COLOURS[7]);
  buildColorPicker('task-colors', 'task-color', COLOURS[0]);

  // ── Priority toggle ────────────────────────────────────────────────────────

  document.getElementById('task-priority-toggle').addEventListener('click', function() {
    var on = this.dataset.on === 'true';
    this.dataset.on = !on;
    this.classList.toggle('on', !on);
    document.getElementById('task-priority-label').textContent = !on ? 'On' : 'Off';
  });

  function setPriority(val) {
    var btn = document.getElementById('task-priority-toggle');
    btn.dataset.on = val ? 'true' : 'false';
    btn.classList.toggle('on', !!val);
    document.getElementById('task-priority-label').textContent = val ? 'On' : 'Off';
  }

  function setCalToggle(on, enabled) {
    var btn = document.getElementById('task-cal-toggle');
    var actualOn = on && enabled;
    btn.dataset.on = actualOn ? 'true' : 'false';
    btn.classList.toggle('on', actualOn);
    btn.style.opacity = enabled ? '' : '0.4';
    btn.style.cursor  = enabled ? '' : 'not-allowed';
    document.getElementById('task-cal-label').textContent = actualOn ? 'On' : 'Off';
    document.getElementById('task-cal-fields').style.display = actualOn ? '' : 'none';
  }

  document.getElementById('task-cal-toggle').addEventListener('click', function() {
    if (this.style.cursor === 'not-allowed') return;
    var on = this.dataset.on === 'true';
    this.dataset.on = String(!on);
    this.classList.toggle('on', !on);
    document.getElementById('task-cal-label').textContent = !on ? 'On' : 'Off';
    document.getElementById('task-cal-fields').style.display = !on ? '' : 'none';
    if (!on) prefillCalFieldsFromJob();
  });

  document.getElementById('task-date').addEventListener('change', function() {
    var hasDate = !!this.value;
    var btn = document.getElementById('task-cal-toggle');
    btn.style.opacity = hasDate ? '' : '0.4';
    btn.style.cursor  = hasDate ? '' : 'not-allowed';
    if (!hasDate) {
      btn.dataset.on = 'false';
      btn.classList.remove('on');
      document.getElementById('task-cal-label').textContent = 'Off';
      document.getElementById('task-cal-fields').style.display = 'none';
    }
  });

  function prefillCalFieldsFromJob() {
    var jobId = document.getElementById('task-job-id').value;
    if (!jobId) return;
    var job = appData.jobs.find(function(j) { return j.id === jobId; });
    if (!job) return;
    var map = {
      'task-cal-venue':         job.venue,
      'task-cal-client':        job.clientName,
      'task-cal-contact-name':  job.contactName,
      'task-cal-contact-phone': job.contactPhone,
      'task-cal-contact-email': job.contactEmail
    };
    Object.keys(map).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el.value && map[id]) el.value = map[id];
    });
  }

  document.getElementById('task-job-id').addEventListener('change', function() {
    if (document.getElementById('task-cal-toggle').dataset.on === 'true') prefillCalFieldsFromJob();
  });

  // ── Load data ──────────────────────────────────────────────────────────────

  function populateTaskJobDropdown() {
    var sel = document.getElementById('task-job-id');
    var current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    appData.jobs
      .slice()
      .sort(function(a, b) { return (a.startDate || a.date || '').localeCompare(b.startDate || b.date || ''); })
      .forEach(function(j) {
        var opt = document.createElement('option');
        opt.value = j.id;
        var hint = j.startDate || j.date ? ' \u2014 ' + (j.startDate || j.date) : '';
        opt.textContent = j.title + hint;
        sel.appendChild(opt);
      });
    sel.value = current;
  }

  async function loadData() {
    try {
      var res = await fetch('/api/data');
      appData = await res.json();
      crewDraft = appData.crew.slice();
    } catch (e) { toast('Failed to load data', true); return; }
    renderJobsTable();
    renderTasksTable();
    renderCrewList();
    renderConfig();
    populateTaskJobDropdown();
    rebuildJobStaffCheckboxes();
  }

  // ── Jobs ───────────────────────────────────────────────────────────────────

  var editingJobId = null;

  function resetJobForm() {
    editingJobId = null;
    document.getElementById('job-id').value = '';
    document.getElementById('job-start-date').value = '';
    document.getElementById('job-end-date').value = '';
    document.getElementById('job-time').value = '';
    document.getElementById('job-status').value = 'provisional';
    document.getElementById('job-title').value = '';
    document.getElementById('job-venue').value = '';
    document.getElementById('job-client').value = '';
    document.getElementById('job-contact-name').value = '';
    document.getElementById('job-contact-phone').value = '';
    document.getElementById('job-contact-email').value = '';
    document.getElementById('job-crew-size').value = '';
    document.getElementById('job-desc').value = '';
    document.getElementById('job-notes').value = '';
    document.getElementById('job-shift-start').value = '';
    document.querySelectorAll('#job-staff-checkboxes input').forEach(function(cb) { cb.checked = false; });
    document.getElementById('jobs-form-title').textContent = 'Add Job';
    document.getElementById('job-save-btn').textContent = 'Add Job';
    document.getElementById('job-cancel-btn').style.display = 'none';
    selectSwatch('job-colors', 'job-color', COLOURS[7]);
    document.getElementById('job-file').value = '';
    document.getElementById('job-doc-key').value = '';
    document.getElementById('job-doc-name').value = '';
    document.getElementById('job-attach-current').style.display = 'none';
  }

  function editJob(j) {
    editingJobId = j.id;
    document.getElementById('job-id').value = j.id;
    document.getElementById('job-start-date').value = j.startDate || j.date || '';
    document.getElementById('job-end-date').value = j.endDate || '';
    document.getElementById('job-time').value = j.time || '';
    document.getElementById('job-status').value = j.status || 'provisional';
    document.getElementById('job-title').value = j.title || '';
    document.getElementById('job-venue').value = j.venue || '';
    document.getElementById('job-client').value = j.clientName || '';
    document.getElementById('job-contact-name').value = j.contactName || '';
    document.getElementById('job-contact-phone').value = j.contactPhone || '';
    document.getElementById('job-contact-email').value = j.contactEmail || '';
    document.getElementById('job-crew-size').value = j.crewSize || '';
    document.getElementById('job-desc').value = j.description || '';
    document.getElementById('job-notes').value = j.adminNotes || '';
    document.getElementById('job-shift-start').value = j.shift_start || '';
    var assignedStaff = j.assigned_staff || [];
    document.querySelectorAll('#job-staff-checkboxes input').forEach(function(cb) {
      cb.checked = assignedStaff.indexOf(cb.value) !== -1;
    });
    document.getElementById('jobs-form-title').textContent = 'Edit Job';
    document.getElementById('job-save-btn').textContent = 'Save Job';
    document.getElementById('job-cancel-btn').style.display = '';
    selectSwatch('job-colors', 'job-color', j.colorHex || COLOURS[7]);
    document.getElementById('job-file').value = '';
    if (j.documentKey) {
      document.getElementById('job-doc-key').value = j.documentKey;
      document.getElementById('job-doc-name').value = j.documentName || '';
      document.getElementById('job-attach-doc-name').textContent = j.documentName || j.documentKey;
      document.getElementById('job-attach-current').style.display = '';
    } else {
      document.getElementById('job-doc-key').value = '';
      document.getElementById('job-doc-name').value = '';
      document.getElementById('job-attach-current').style.display = 'none';
    }
    document.getElementById('sec-jobs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('job-cancel-btn').addEventListener('click', resetJobForm);

  document.getElementById('job-remove-doc-btn').addEventListener('click', async function() {
    var key = document.getElementById('job-doc-key').value;
    var jobId = document.getElementById('job-id').value;
    if (!key || !confirm('Remove this attachment?')) return;
    var ok = await apiPost('/api/admin/documents/delete', { key: key, jobId: jobId || undefined });
    if (ok) {
      document.getElementById('job-doc-key').value = '';
      document.getElementById('job-doc-name').value = '';
      document.getElementById('job-attach-current').style.display = 'none';
      if (jobId) loadData();
      toast('Attachment removed');
    }
  });

  document.getElementById('job-save-btn').addEventListener('click', async function() {
    var title = document.getElementById('job-title').value.trim();
    if (!title) { toast('Title is required', true); return; }
    var startDate = document.getElementById('job-start-date').value;
    var endDate   = document.getElementById('job-end-date').value;
    if (startDate && endDate && endDate < startDate) { toast('End date cannot be before start date', true); return; }

    var documentKey = document.getElementById('job-doc-key').value || null;
    var documentName = document.getElementById('job-doc-name').value || null;
    var fileInput = document.getElementById('job-file');
    if (fileInput.files.length > 0) {
      var up = await uploadFile(fileInput.files[0]);
      if (!up) return;
      documentKey = up.key;
      documentName = up.name;
    }

    var payload = {
      id: document.getElementById('job-id').value || undefined,
      startDate: document.getElementById('job-start-date').value,
      endDate: document.getElementById('job-end-date').value || null,
      time: document.getElementById('job-time').value,
      status: document.getElementById('job-status').value,
      title: title,
      venue: document.getElementById('job-venue').value.trim() || null,
      clientName: document.getElementById('job-client').value.trim() || null,
      contactName: document.getElementById('job-contact-name').value.trim() || null,
      contactPhone: document.getElementById('job-contact-phone').value.trim() || null,
      contactEmail: document.getElementById('job-contact-email').value.trim() || null,
      crewSize: parseInt(document.getElementById('job-crew-size').value, 10) || null,
      description: document.getElementById('job-desc').value.trim(),
      adminNotes: document.getElementById('job-notes').value.trim() || null,
      colorHex: document.getElementById('job-color').value || COLOURS[7],
      documentKey: documentKey,
      documentName: documentName,
      assigned_staff: Array.from(document.querySelectorAll('#job-staff-checkboxes input:checked')).map(function(cb) { return cb.value; }),
      shift_start: document.getElementById('job-shift-start').value || null
    };
    var result = await apiPostSave('/api/admin/jobs/save', payload);
    if (result) { resetJobForm(); loadData(); toast(result.warning || 'Job saved', !!result.warning); }
  });

  function renderJobsTable() {
    var tbody = document.querySelector('#jobs-table tbody');
    if (!appData.jobs.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:#333;text-align:center;padding:24px">No jobs yet</td></tr>'; return; }
    var html = '';
    var jobs = appData.jobs.slice().sort(function(a,b) { return (a.startDate||a.date||'').localeCompare(b.startDate||b.date||''); });
    jobs.forEach(function(j) {
      var start = j.startDate || j.date || '';
      var dateDisplay = start + (j.endDate && j.endDate !== start ? ' \u2013 ' + j.endDate : '');
      html += '<tr>' +
        '<td>' + esc(dateDisplay) + '</td>' +
        '<td>' + esc(j.time || '\u2014') + '</td>' +
        '<td><strong>' + esc(j.title) + '</strong>' + (((j.assigned_staff||[]).length > 0 && (j.completions||[]).length === (j.assigned_staff||[]).length) ? ' <span style="background:rgba(46,204,113,0.15);color:#2ecc71;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:999px">Done</span>' : '') + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(j.description || '') + '</td>' +
        '<td><span class="c-preview" style="background:' + esc(j.colorHex||'#444') + '"></span>' + esc(j.colorHex||'') + '</td>' +
        '<td><div class="tbl-actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="editJobById(\\'' + esc(j.id) + '\\')">Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteJob(\\'' + esc(j.id) + '\\')">Delete</button>' +
        '</div></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  function rebuildJobStaffCheckboxes() {
    var container = document.getElementById('job-staff-checkboxes');
    var checked = Array.from(container.querySelectorAll('input:checked')).map(function(cb) { return cb.value; });
    container.innerHTML = '';
    (appData.crew || []).forEach(function(name) {
      var lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:6px;background:#111;border:1px solid #1e1e1e;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:0.85rem';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = name;
      cb.checked = checked.indexOf(name) !== -1;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(name));
      container.appendChild(lbl);
    });
  }

  window.editJobById = function(id) {
    var j = appData.jobs.find(function(x) { return x.id === id; });
    if (j) editJob(j);
  };

  window.deleteJob = async function(id) {
    if (!confirm('Delete this job?')) return;
    var ok = await apiPost('/api/admin/jobs/delete', { id: id });
    if (ok) { loadData(); toast('Job deleted'); }
  };

  // ── Tasks ──────────────────────────────────────────────────────────────────

  var editingTaskId = null;

  function resetTaskForm() {
    editingTaskId = null;
    document.getElementById('task-id').value = '';
    document.getElementById('task-title').value = '';
    document.getElementById('task-detail').value = '';
    document.getElementById('task-date').value = '';
    document.getElementById('task-start-time').value = '';
    document.getElementById('task-end-time').value = '';
    document.getElementById('task-slots').value = 1;
    document.getElementById('task-status').value = 'pending';
    document.getElementById('tasks-form-title').textContent = 'Add Task';
    document.getElementById('task-save-btn').textContent = 'Add Task';
    document.getElementById('task-cancel-btn').style.display = 'none';
    document.getElementById('task-notes').value = '';
    document.getElementById('task-cal-venue').value = '';
    document.getElementById('task-cal-client').value = '';
    document.getElementById('task-cal-contact-name').value = '';
    document.getElementById('task-cal-contact-phone').value = '';
    document.getElementById('task-cal-contact-email').value = '';
    document.getElementById('task-job-id').value = '';
    setCalToggle(false, false);
    setPriority(false);
    selectSwatch('task-colors', 'task-color', COLOURS[0]);
    document.getElementById('task-file').value = '';
    document.getElementById('task-doc-key').value = '';
    document.getElementById('task-doc-name').value = '';
    document.getElementById('task-attach-current').style.display = 'none';
  }

  function editTask(t) {
    editingTaskId = t.id;
    document.getElementById('task-id').value = t.id;
    document.getElementById('task-title').value = t.title || '';
    document.getElementById('task-detail').value = t.detail || '';
    document.getElementById('task-date').value = t.date || '';
    document.getElementById('task-start-time').value = t.startTime || '';
    document.getElementById('task-end-time').value = t.endTime || '';
    document.getElementById('task-slots').value = t.slots || 1;
    document.getElementById('task-status').value = t.status || 'pending';
    document.getElementById('tasks-form-title').textContent = 'Edit Task';
    document.getElementById('task-save-btn').textContent = 'Save Task';
    document.getElementById('task-cancel-btn').style.display = '';
    document.getElementById('task-notes').value = t.notes || '';
    document.getElementById('task-cal-venue').value = t.calVenue || '';
    document.getElementById('task-cal-client').value = t.calClientName || '';
    document.getElementById('task-cal-contact-name').value = t.calContactName || '';
    document.getElementById('task-cal-contact-phone').value = t.calContactPhone || '';
    document.getElementById('task-cal-contact-email').value = t.calContactEmail || '';
    document.getElementById('task-job-id').value = t.jobId || '';
    setCalToggle(!!t.addToCalendar, !!t.date);
    setPriority(t.priority);
    selectSwatch('task-colors', 'task-color', t.colorHex || COLOURS[0]);
    document.getElementById('task-file').value = '';
    if (t.documentKey) {
      document.getElementById('task-doc-key').value = t.documentKey;
      document.getElementById('task-doc-name').value = t.documentName || '';
      document.getElementById('task-attach-doc-name').textContent = t.documentName || t.documentKey;
      document.getElementById('task-attach-current').style.display = '';
    } else {
      document.getElementById('task-doc-key').value = '';
      document.getElementById('task-doc-name').value = '';
      document.getElementById('task-attach-current').style.display = 'none';
    }
    document.getElementById('sec-tasks').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('task-cancel-btn').addEventListener('click', resetTaskForm);

  document.getElementById('task-remove-doc-btn').addEventListener('click', async function() {
    var key = document.getElementById('task-doc-key').value;
    var taskId = document.getElementById('task-id').value;
    if (!key || !confirm('Remove this attachment?')) return;
    var ok = await apiPost('/api/admin/documents/delete', { key: key, taskId: taskId || undefined });
    if (ok) {
      document.getElementById('task-doc-key').value = '';
      document.getElementById('task-doc-name').value = '';
      document.getElementById('task-attach-current').style.display = 'none';
      if (taskId) loadData();
      toast('Attachment removed');
    }
  });

  document.getElementById('task-save-btn').addEventListener('click', async function() {
    var title = document.getElementById('task-title').value.trim();
    if (!title) { toast('Title is required', true); return; }

    var documentKey = document.getElementById('task-doc-key').value || null;
    var documentName = document.getElementById('task-doc-name').value || null;
    var fileInput = document.getElementById('task-file');
    if (fileInput.files.length > 0) {
      var up = await uploadFile(fileInput.files[0]);
      if (!up) return;
      documentKey = up.key;
      documentName = up.name;
    }

    var status = document.getElementById('task-status').value;
    var payload = {
      id: document.getElementById('task-id').value || undefined,
      title: title,
      detail: document.getElementById('task-detail').value.trim(),
      notes: document.getElementById('task-notes').value.trim() || null,
      date: document.getElementById('task-date').value || null,
      startTime: document.getElementById('task-start-time').value || null,
      endTime: document.getElementById('task-end-time').value || null,
      addToCalendar:   document.getElementById('task-cal-toggle').dataset.on === 'true',
      calVenue:        document.getElementById('task-cal-venue').value.trim() || null,
      calClientName:   document.getElementById('task-cal-client').value.trim() || null,
      calContactName:  document.getElementById('task-cal-contact-name').value.trim() || null,
      calContactPhone: document.getElementById('task-cal-contact-phone').value.trim() || null,
      calContactEmail: document.getElementById('task-cal-contact-email').value.trim() || null,
      slots: parseInt(document.getElementById('task-slots').value, 10) || 1,
      status: status,
      priority: document.getElementById('task-priority-toggle').dataset.on === 'true',
      colorHex: document.getElementById('task-color').value || COLOURS[0],
      completedAt: status === 'complete' ? (Date.now()) : null,
      jobId: document.getElementById('task-job-id').value || null,
      documentKey: documentKey,
      documentName: documentName
    };
    var result = await apiPostSave('/api/admin/tasks/save', payload);
    if (result) { resetTaskForm(); loadData(); toast(result.warning || 'Task saved', !!result.warning); }
  });

  function renderTasksTable() {
    var tbody = document.querySelector('#tasks-table tbody');
    if (!appData.tasks.length) { tbody.innerHTML = '<tr><td colspan="8" style="color:#333;text-align:center;padding:24px">No tasks yet</td></tr>'; return; }
    var html = '';
    appData.tasks.forEach(function(t) {
      var assigned = (t.assignedTo || []).join(', ') || '\u2014';
      var linkedJob = t.jobId ? appData.jobs.find(function(j) { return j.id === t.jobId; }) : null;
      var sid = esc(t.id);
      html += '<tr id="task-row-' + sid + '">' +
        '<td><strong>' + esc(t.title) + '</strong><span id="attach-badge-' + sid + '" class="attach-badge" style="display:none"></span></td>' +
        '<td>' + (linkedJob ? esc(linkedJob.title) : '\u2014') + '</td>' +
        '<td>' + esc(String((t.assignedTo||[]).length)) + '/' + esc(String(t.slots||1)) + '</td>' +
        '<td>' + esc(assigned) + '</td>' +
        '<td>' + esc(t.status||'pending') + '</td>' +
        '<td>' + (t.priority ? '\u2605' : '\u2014') + '</td>' +
        '<td><span class="c-preview" style="background:' + esc(t.colorHex||'#444') + '"></span>' + esc(t.colorHex||'') + '</td>' +
        '<td><div class="tbl-actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="editTaskById(\\'' + sid + '\\')">Edit</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleTaskAttachments(\\'' + sid + '\\')">Files</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteTask(\\'' + sid + '\\')">Delete</button>' +
        '</div></td>' +
        '</tr>' +
        '<tr id="task-attach-row-' + sid + '" style="display:none">' +
          '<td colspan="8" style="padding:0">' +
            '<div id="task-attach-panel-' + sid + '" class="attach-panel"></div>' +
          '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    loadAllAttachmentCounts();
  }

  window.editTaskById = function(id) {
    var t = appData.tasks.find(function(x) { return x.id === id; });
    if (t) editTask(t);
  };

  window.deleteTask = async function(id) {
    if (!confirm('Delete this task?')) return;
    var task = appData.tasks.find(function(t) { return t.id === id; });
    var jobId = (task && task.jobId) ? task.jobId : 'standalone';
    var ok = await apiPost('/api/admin/tasks/delete', { taskId: id, jobId: jobId });
    if (ok) { loadData(); toast('Task deleted'); }
  };

  // ── Crew ───────────────────────────────────────────────────────────────────

  function renderCrewList() {
    crewDraft = appData.crew.slice();
    rebuildCrewUI();
  }

  function rebuildCrewUI() {
    var el = document.getElementById('crew-list');
    if (!crewDraft.length) { el.innerHTML = '<div style="color:#333;font-style:italic;padding:8px">No crew members yet</div>'; return; }
    var html = '';
    crewDraft.forEach(function(name, i) {
      html += '<div class="crew-item">' +
        '<span class="crew-name">' + esc(name) + '</span>' +
        '<button class="btn btn-danger btn-sm" onclick="removeCrew(' + i + ')">Remove</button>' +
        '</div>';
    });
    el.innerHTML = html;
  }

  window.removeCrew = function(i) {
    crewDraft.splice(i, 1);
    rebuildCrewUI();
  };

  document.getElementById('add-crew-btn').addEventListener('click', function() {
    var val = document.getElementById('new-crew-name').value.trim();
    if (!val) return;
    if (crewDraft.includes(val)) { toast('Name already in list', true); return; }
    crewDraft.push(val);
    document.getElementById('new-crew-name').value = '';
    rebuildCrewUI();
  });

  document.getElementById('new-crew-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('add-crew-btn').click();
  });

  document.getElementById('save-crew-btn').addEventListener('click', async function() {
    var ok = await apiPost('/api/admin/crew/save', { crew: crewDraft });
    if (ok) { loadData(); toast('Crew saved'); }
  });

  // ── Config ─────────────────────────────────────────────────────────────────

  function renderConfig() {
    var cfg = appData.config || {};
    document.getElementById('cfg-scroll').value = cfg.scrollInterval || 20000;
  }

  document.getElementById('save-config-btn').addEventListener('click', async function() {
    var payload = {
      scrollInterval: parseInt(document.getElementById('cfg-scroll').value, 10)
    };
    var ok = await apiPost('/api/admin/config/save', payload);
    if (ok) { loadData(); toast('Config saved'); }
  });

  document.getElementById('save-pw-btn').addEventListener('click', async function() {
    var pw = document.getElementById('new-pw').value;
    if (!pw) { toast('Enter a new password', true); return; }
    var ok = await apiPost('/api/admin/config/save', { newPassword: pw });
    if (ok) { document.getElementById('new-pw').value = ''; toast('Password updated'); }
  });

  // ── API helper ─────────────────────────────────────────────────────────────

  async function uploadFile(file) {
    var fd = new FormData();
    fd.append('file', file);
    try {
      var res = await fetch('/api/admin/documents/upload', { method: 'POST', body: fd });
      if (res.status === 401) { showLogin(); return null; }
      var json = await res.json();
      if (!res.ok) { toast(json.error || 'Upload failed', true); return null; }
      return json; // { key, name }
    } catch (e) {
      toast('Upload failed', true);
      return null;
    }
  }

  async function apiPost(path, body) {
    try {
      var res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.status === 401) { showLogin(); return false; }
      var json = await res.json();
      if (!res.ok) { toast(json.error || 'Request failed', true); return false; }
      return true;
    } catch (e) {
      toast('Network error', true);
      return false;
    }
  }

  // Like apiPost but returns the parsed JSON on success so callers can inspect warning fields
  async function apiPostSave(path, body) {
    try {
      var res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.status === 401) { showLogin(); return false; }
      var json = await res.json();
      if (!res.ok) { toast(json.error || 'Request failed', true); return false; }
      return json;
    } catch (e) {
      toast('Network error', true);
      return false;
    }
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  function updateNotesBadge() {
    fetch('/api/notes/unread')
      .then(function(r) { return r.json(); })
      .then(function(json) {
        var badge = document.getElementById('notes-badge');
        if (json.count > 0) { badge.textContent = json.count; badge.style.display = ''; }
        else badge.style.display = 'none';
      })
      .catch(function() {});
  }

  setInterval(updateNotesBadge, 60000);

  function renderCompletedJobs() {
    var tbody = document.querySelector('#completed-table tbody');
    var completed = (appData.jobs || []).filter(function(j) {
      return (j.assigned_staff || []).length > 0 &&
        (j.completions || []).length === (j.assigned_staff || []).length;
    }).slice().sort(function(a, b) { return (a.startDate||a.date||'').localeCompare(b.startDate||b.date||''); });
    if (!completed.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:#333;text-align:center;padding:24px">No completed jobs yet</td></tr>'; return; }
    var html = '';
    completed.forEach(function(j) {
      var start = j.startDate || j.date || '';
      var dateDisplay = start + (j.endDate && j.endDate !== start ? ' – ' + j.endDate : '');
      html += '<tr>' +
        '<td>' + esc(dateDisplay) + '</td>' +
        '<td>' + esc(j.time || '—') + '</td>' +
        '<td><strong>' + esc(j.title) + '</strong></td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(j.description || '') + '</td>' +
        '<td><span class="c-preview" style="background:' + esc(j.colorHex||'#444') + '"></span>' + esc(j.colorHex||'') + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }

  async function renderNotes() {
    var listEl = document.getElementById('notes-list');
    listEl.innerHTML = '<div style="color:#555;padding:16px">Loading...</div>';
    try {
      var res = await fetch('/api/notes');
      if (res.status === 401) { showLogin(); return; }
      var notes = await res.json();
      updateNotesBadge();

      var topLevel = notes.filter(function(n) { return !n.parent_id; });
      var replies  = notes.filter(function(n) { return  n.parent_id; });
      var replyMap = {};
      replies.forEach(function(r) {
        if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
        replyMap[r.parent_id].push(r);
      });

      document.getElementById('notes-panel-count').textContent = topLevel.length + ' note' + (topLevel.length !== 1 ? 's' : '');
      if (!topLevel.length) { listEl.innerHTML = '<div style="color:#333;font-style:italic;padding:24px;text-align:center">No notes yet</div>'; return; }

      var titleMap = {};
      (appData.jobs || []).forEach(function(j) { titleMap[j.id] = j.title; });
      (appData.tasks || []).forEach(function(t) { titleMap[t.id] = t.title; });

      function refTitle(n) { return n.ref_id ? (titleMap[n.ref_id] || null) : null; }

      var unread  = topLevel.filter(function(n) { return !n.read_by_admin; });
      var byJob   = topLevel.filter(function(n) { return n.type === 'job'     && n.read_by_admin; });
      var byTask  = topLevel.filter(function(n) { return n.type === 'task'    && n.read_by_admin; });
      var general = topLevel.filter(function(n) { return n.type === 'general' && n.read_by_admin; });

      var html = '';
      if (unread.length)  { html += '<div class="notes-group-label">Unread (' + unread.length + ')</div>';  unread.forEach(function(n)  { html += noteItemHtml(n, replyMap[n.id] || [], refTitle(n)); }); }
      if (byJob.length)   { html += '<div class="notes-group-label">Job Notes</div>';    byJob.forEach(function(n)   { html += noteItemHtml(n, replyMap[n.id] || [], refTitle(n)); }); }
      if (byTask.length)  { html += '<div class="notes-group-label">Task Notes</div>';   byTask.forEach(function(n)  { html += noteItemHtml(n, replyMap[n.id] || [], refTitle(n)); }); }
      if (general.length) { html += '<div class="notes-group-label">General</div>';      general.forEach(function(n) { html += noteItemHtml(n, replyMap[n.id] || [], refTitle(n)); }); }
      listEl.innerHTML = html;
    } catch (e) {
      listEl.innerHTML = '<div style="color:#e74c3c;padding:16px">Failed to load notes</div>';
    }
  }

  function noteItemHtml(n, replies, refTitle) {
    var date = new Date(n.created_at);
    var dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
      date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    var repliesHtml = '';
    if (replies && replies.length) {
      repliesHtml += '<div class="note-replies">';
      replies.forEach(function(r) {
        var rd = new Date(r.created_at);
        var rdStr = rd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
          rd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        repliesHtml += '<div class="note-reply">' +
          '<button class="btn-note-delete" onclick="event.stopPropagation();deleteNote(\\'' + esc(r.id) + '\\')" title="Delete reply">&times;</button>' +
          '<div class="note-reply-meta"><span class="note-author">' + esc(r.author) + '</span> &mdash; ' + esc(rdStr) + '</div>' +
          '<div class="note-reply-body">' + esc(r.body) + '</div>' +
          '</div>';
      });
      repliesHtml += '</div>';
    }

    var replyForm = '<div class="note-reply-form" onclick="event.stopPropagation()">' +
      '<textarea class="note-reply-input" id="reply-input-' + esc(n.id) + '" placeholder="Reply..."></textarea>' +
      '<button class="btn btn-gold btn-sm" onclick="submitAdminReply(\\'' + esc(n.id) + '\\',\\'' + esc(n.type) + '\\',\\'' + esc(n.ref_id || '') + '\\')">Reply</button>' +
      '</div>';

    var deleteBtn = '<button class="btn-note-delete" onclick="event.stopPropagation();deleteNote(\\'' + esc(n.id) + '\\')" title="Delete note">&times;</button>';
    var unreadClick = n.read_by_admin ? '' : ' onclick="markNoteRead(\\'' + esc(n.id) + '\\')"';
    return '<div class="note-item' + (n.read_by_admin ? '' : ' unread') + '"' + unreadClick + '>' +
      deleteBtn +
      (refTitle ? '<div class="note-ref-header">' + esc(refTitle) + '</div>' : '') +
      '<div class="note-meta"><span class="note-author">' + esc(n.author) + '</span> &mdash; ' + esc(dateStr) + '</div>' +
      '<div class="note-body">' + esc(n.body) + '</div>' +
      repliesHtml +
      replyForm +
      '</div>';
  }

  window.markNoteRead = async function(id) {
    try {
      var res = await fetch('/api/notes/' + encodeURIComponent(id) + '/read', { method: 'PATCH' });
      if (res.status === 401) { showLogin(); return; }
      renderNotes();
    } catch (e) {}
  };

  window.submitAdminReply = async function(parentId, type, refId) {
    var input = document.getElementById('reply-input-' + parentId);
    var body = input ? input.value.trim() : '';
    if (!body) return;
    try {
      var postRes = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, ref_id: refId || null, author: 'Admin', body: body, parent_id: parentId })
      });
      if (postRes.status === 401) { showLogin(); return; }
      await fetch('/api/notes/' + encodeURIComponent(parentId) + '/read', { method: 'PATCH' });
      renderNotes();
    } catch (e) {}
  };

  window.deleteNote = async function(id) {
    if (!confirm('Delete this note?')) return;
    try {
      var res = await fetch('/api/notes/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.status === 401) { showLogin(); return; }
      renderNotes();
    } catch (e) {}
  };

  document.getElementById('refresh-notes-btn').addEventListener('click', renderNotes);

  // ── Attachments ────────────────────────────────────────────────────────────

  function loadAllAttachmentCounts() {
    (appData.tasks || []).forEach(function(t) {
      fetch('/attachments?task_id=' + encodeURIComponent(t.id))
        .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function(list) {
          var badge = document.getElementById('attach-badge-' + t.id);
          if (badge) {
            badge.textContent = list.length;
            badge.style.display = list.length > 0 ? '' : 'none';
          }
        })
        .catch(function() {});
    });
  }

  window.toggleTaskAttachments = function(id) {
    var row = document.getElementById('task-attach-row-' + id);
    if (!row) return;
    var opening = row.style.display === 'none';
    row.style.display = opening ? '' : 'none';
    if (opening) loadTaskAttachments(id);
  };

  async function loadTaskAttachments(id) {
    var panel = document.getElementById('task-attach-panel-' + id);
    if (!panel) return;
    panel.innerHTML = '<div style="color:#555;font-size:0.85rem;padding:4px 0">Loading…</div>';
    try {
      var res = await fetch('/attachments?task_id=' + encodeURIComponent(id));
      if (res.status === 401) { showLogin(); return; }
      var list = await res.json();
      renderAttachmentPanel(id, list);
      var badge = document.getElementById('attach-badge-' + id);
      if (badge) { badge.textContent = list.length; badge.style.display = list.length > 0 ? '' : 'none'; }
    } catch (e) {
      panel.innerHTML = '<div style="color:#e74c3c;font-size:0.85rem">Failed to load attachments</div>';
    }
  }

  function renderAttachmentPanel(taskId, list) {
    var panel = document.getElementById('task-attach-panel-' + taskId);
    if (!panel) return;
    var sid = esc(taskId);
    var html = '';
    if (!list.length) {
      html += '<div style="color:#555;font-size:0.85rem;font-style:italic;margin-bottom:8px">No attachments yet</div>';
    } else {
      list.forEach(function(a) {
        var d = new Date(a.uploaded_at);
        var dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        var aid = esc(a.id);
        html += '<div class="attach-row">' +
          '<span class="attach-filename">' + esc(a.filename) + '</span>' +
          '<span class="attach-date">' + esc(dateStr) + '</span>' +
          '<a href="/attachments/' + aid + '/view" target="_blank" class="btn btn-ghost btn-sm">View</a>' +
          '<a href="/attachments/' + aid + '/download" class="btn btn-ghost btn-sm">Download</a>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteAttachment(\\'' + aid + '\\',\\'' + sid + '\\')">Delete</button>' +
          '</div>';
      });
    }
    html += '<div class="attach-upload">' +
      '<input type="file" id="attach-input-' + sid + '" accept=".html">' +
      '<button class="btn btn-gold btn-sm" onclick="uploadTaskAttachment(\\'' + sid + '\\')">Upload</button>' +
      '</div>';
    panel.innerHTML = html;
  }

  window.uploadTaskAttachment = async function(taskId) {
    var input = document.getElementById('attach-input-' + taskId);
    if (!input || !input.files.length) { toast('Select a file first', true); return; }
    var file = input.files[0];
    if (!file.name.toLowerCase().endsWith('.html')) { toast('Only .html files allowed', true); return; }
    var fd = new FormData();
    fd.append('file', file);
    fd.append('task_id', taskId);
    fd.append('uploaded_by', 'admin');
    try {
      var res = await fetch('/attachments', { method: 'POST', body: fd });
      if (res.status === 401) { showLogin(); return; }
      var json = await res.json();
      if (!res.ok) { toast(json.error || 'Upload failed', true); return; }
      toast('Attachment uploaded');
      loadTaskAttachments(taskId);
    } catch (e) {
      toast('Upload failed', true);
    }
  };

  window.deleteAttachment = async function(attachId, taskId) {
    if (!confirm('Delete this attachment?')) return;
    try {
      var res = await fetch('/attachments/' + encodeURIComponent(attachId), { method: 'DELETE' });
      if (res.status === 401) { showLogin(); return; }
      var json = await res.json();
      if (!res.ok) { toast(json.error || 'Delete failed', true); return; }
      toast('Attachment deleted');
      loadTaskAttachments(taskId);
    } catch (e) {
      toast('Delete failed', true);
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────────

  checkAuth();
})();
</script>
</body>
</html>`;
}
