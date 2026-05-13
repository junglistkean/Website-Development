export function staffHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Raven Warehouse &mdash; Staff</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  background: #0a0a0a;
  color: #f0f0f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

#app { max-width: 480px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; }

/* Name overlay */
#name-overlay {
  position: fixed;
  inset: 0;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  z-index: 100;
}
#name-overlay.hidden { display: none; }
#name-overlay h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; color: #f0f0f0; }
#name-overlay p  { font-size: 1rem; color: #666; margin-bottom: 32px; }
#name-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%; max-width: 320px; }
.name-btn {
  padding: 18px 12px;
  background: #151515;
  border: 2px solid #222;
  border-radius: 10px;
  color: #f0f0f0;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  text-align: center;
}
.name-btn:hover { background: #1e1e1e; border-color: #c9a84c; }

/* Header */
#header {
  background: #0d0d0d;
  border-bottom: 1px solid #1a1a1a;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}
#logo { font-size: 1rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #c9a84c; }
#header-right { display: flex; align-items: center; gap: 10px; }
#name-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #151515;
  border: 1px solid #2a2a2a;
  border-radius: 999px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #ccc;
  transition: border-color 0.15s;
}
#name-badge:hover { border-color: #c9a84c; }
#name-badge .arrow { color: #555; font-size: 0.75rem; }

/* Tabs */
#tabs {
  display: flex;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
  background: #0d0d0d;
  position: sticky;
  top: 53px;
  z-index: 9;
}
.tab-btn {
  flex: 1;
  padding: 12px 4px;
  background: none;
  border: none;
  color: #555;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn.active { color: #c9a84c; border-bottom-color: #c9a84c; }
.tab-btn.hidden { display: none; }

/* Content */
#content { flex: 1; overflow-y: auto; padding: 16px; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }

/* Cards */
.card {
  background: #111;
  border-radius: 10px;
  border: 1px solid #1e1e1e;
  border-left: 5px solid #c9a84c;
  margin-bottom: 12px;
  overflow: hidden;
}

.card-strip { height: 3px; }
.card-body  { padding: 14px 16px; }

.card-title  { font-size: 1.15rem; font-weight: 700; line-height: 1.3; }
.card-detail { font-size: 0.88rem; color: #888; margin-top: 6px; line-height: 1.45; }
.card-meta   { font-size: 0.8rem; color: #555; margin-top: 6px; }

/* Job card */
.job-dt { display: flex; gap: 12px; align-items: baseline; margin-bottom: 4px; }
.job-time-big { font-size: 1.3rem; font-weight: 700; color: #f0f0f0; }
.job-date-sm  { font-size: 0.85rem; color: #777; }

/* Slots */
.slots-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.slot-pill {
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  border: 2px solid;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.slot-pill.filled-mine { background: rgba(201,168,76,0.18); border-color: #c9a84c; color: #c9a84c; }
.slot-pill.filled-other { background: #1a1a1a; border-color: #333; color: #aaa; cursor: default; }
.slot-pill.open { background: transparent; border-color: #2e2e2e; color: #555; }
.slot-pill.claimable { background: rgba(46,204,113,0.1); border-color: #2ecc71; color: #2ecc71; }

.card-actions { padding: 0 16px 14px; display: flex; gap: 8px; flex-wrap: wrap; }
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.btn:disabled { opacity: 0.4; cursor: default; }
.btn-complete { background: #2ecc71; color: #000; }
.btn-confirm  { background: #e74c3c; color: #fff; }
.btn-cancel   { background: #1e1e1e; color: #aaa; border: 1px solid #333; }
.btn-print    { background: #1e2a3a; color: #3498db; border: 1px solid #3498db; }
.btn-note          { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
.btn-job-complete  { background: #2ecc71; color: #000; }
.btn-job-done      { background: rgba(46,204,113,0.15); color: #2ecc71; border: 1px solid rgba(46,204,113,0.4); }
.job-complete-badge {
  display: inline-block; background: rgba(46,204,113,0.15); color: #2ecc71;
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 2px 8px; border-radius: 999px; vertical-align: middle; margin-left: 6px;
}

/* Card notes panel */
.card-notes-panel { border-top: 1px solid #1a1a1a; padding: 0 16px 14px; }
.notes-thread-content { padding-top: 10px; }
.staff-note { padding: 9px 0; border-bottom: 1px solid #1a1a1a; }
.staff-note:last-child { border-bottom: none; }
.staff-note-meta { font-size: 0.74rem; color: #555; margin-bottom: 3px; }
.staff-note-author { color: #c9a84c; font-weight: 700; }
.staff-note-body { font-size: 0.86rem; color: #ccc; line-height: 1.45; }
.staff-note-replies { margin-top: 7px; padding-left: 12px; border-left: 2px solid #1e1e1e; }
.staff-note-reply { padding: 5px 0; }
.notes-empty { color: #333; font-size: 0.85rem; font-style: italic; padding: 10px 0; }
.notes-loading { color: #555; font-size: 0.85rem; padding: 10px 0; }
.btn-notes-toggle { background: #131313; color: #555; border: 1px solid #222; }

.placeholder { color: #2a2a2a; font-size: 1rem; font-style: italic; text-align: center; padding: 48px 0; }
.placeholder-sm { color: #333; font-size: 0.88rem; font-style: italic; padding: 12px 0 8px; }

.section-heading {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-weight: 700;
  color: #c9a84c;
  margin: 20px 0 10px;
}
.section-heading:first-child { margin-top: 4px; }

.section-divider { height: 1px; background: #1a1a1a; margin: 4px 0 16px; }

/* Completed card */
.card.done { opacity: 0.45; filter: grayscale(1); }
.done-time  { font-size: 0.78rem; color: #555; margin-top: 6px; }

/* Status badge */
.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 8px;
}
.status-pending    { background: #1e2a1e; color: #4a8a4a; }
.status-inprogress { background: #1e1e2a; color: #4a4aaa; }
.status-complete   { background: #1a1a1a; color: #555; }

/* Note modal */
#note-modal {
  display: none; position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.88); align-items: center; justify-content: center;
}
#note-modal.open { display: flex; }
#note-dialog {
  background: #111; border: 1px solid #2a2a2a; border-radius: 12px;
  padding: 28px; width: 460px; max-width: calc(100vw - 32px);
}
#note-dialog h3 { font-size: 1rem; font-weight: 800; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 18px; }
.note-field { margin-bottom: 14px; }
.note-field label { display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #777; margin-bottom: 6px; }
.note-field select, .note-field textarea {
  width: 100%; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 6px;
  color: #f0f0f0; padding: 9px 12px; font-size: 0.92rem; font-family: inherit; outline: none;
}
.note-field select:focus, .note-field textarea:focus { border-color: #c9a84c; }
.note-field textarea { resize: vertical; min-height: 90px; }
.note-actions { display: flex; gap: 10px; margin-top: 4px; }
.btn-note-submit { background: #c9a84c; color: #000; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; border: none; }
.btn-note-cancel { background: transparent; border: 1px solid #333; color: #aaa; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
#note-status { font-size: 0.85rem; margin-top: 10px; min-height: 20px; }
#note-status.ok  { color: #2ecc71; }
#note-status.err { color: #e74c3c; }
</style>
</head>
<body>

<div id="name-overlay">
  <h1>Who are you?</h1>
  <p>Choose your name to access the board</p>
  <div id="name-grid"></div>
</div>

<div id="app">
  <div id="header">
    <div id="logo">Raven Warehouse</div>
    <div id="header-right">
      <button class="btn btn-note" onclick="openNoteModal('general', null)">+ Note</button>
      <div id="name-badge" onclick="showNameOverlay()">
        <span id="current-name">...</span>
        <span class="arrow">&#9660;</span>
      </div>
    </div>
  </div>

  <div id="tabs">
    <button class="tab-btn active" data-tab="jobs">Jobs</button>
    <button class="tab-btn" data-tab="tasks">Tasks</button>
    <button class="tab-btn" data-tab="done">Done</button>
    <button class="tab-btn hidden" data-tab="mine" id="tab-mine-btn">Mine</button>
    <button class="tab-btn" data-tab="notes">Notes</button>
  </div>

  <div id="content">
    <div class="tab-panel active" id="tab-jobs"></div>
    <div class="tab-panel"        id="tab-tasks"></div>
    <div class="tab-panel"        id="tab-done"></div>
    <div class="tab-panel"        id="tab-mine"></div>
    <div class="tab-panel"        id="tab-notes">
      <div id="notes-panel-general"><div class="notes-thread-content" id="general-notes-content"></div></div>
    </div>
  </div>
</div>

<div id="note-modal">
  <div id="note-dialog">
    <h3 id="note-modal-title">Add Note</h3>
    <div class="note-field">
      <label>Your Name</label>
      <select id="note-author-sel"><option value="">Select name...</option></select>
    </div>
    <div class="note-field">
      <label>Note</label>
      <textarea id="note-body-ta" placeholder="Write your note here..."></textarea>
    </div>
    <div class="note-actions">
      <button class="btn-note-submit" onclick="submitNote()">Submit</button>
      <button class="btn-note-cancel" onclick="closeNoteModal()">Cancel</button>
    </div>
    <div id="note-status"></div>
  </div>
</div>

<script>
(function () {
  var data = { jobs: [], tasks: [], crew: [], config: { expireAfterHours: 48 } };
  var myName = localStorage.getItem('warehouse_staff_name') || '';
  var activeTab = 'jobs';
  var noteCtx = { type: '', refId: null };
  var openNotePanels = {};

  // ── Name management ────────────────────────────────────────────────────────

  function showNameOverlay() {
    document.getElementById('name-overlay').classList.remove('hidden');
  }

  function hideNameOverlay() {
    document.getElementById('name-overlay').classList.add('hidden');
  }

  function selectName(name) {
    myName = name;
    localStorage.setItem('warehouse_staff_name', name);
    document.getElementById('current-name').textContent = name;
    document.getElementById('tab-mine-btn').classList.remove('hidden');
    hideNameOverlay();
    renderAll();
  }

  function buildNameGrid() {
    var grid = document.getElementById('name-grid');
    grid.innerHTML = '';
    var crew = data.crew.length ? data.crew : ['—'];
    crew.forEach(function(n) {
      var btn = document.createElement('button');
      btn.className = 'name-btn';
      btn.textContent = n;
      btn.onclick = function() { selectName(n); };
      grid.appendChild(btn);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtDate(ds) {
    var d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function fmtDateRange(start, end) {
    if (!end || end === start) return fmtDate(start);
    return fmtDate(start) + ' \u2013 ' + fmtDate(end);
  }

  function dateStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function rollingWindow() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var end = new Date(today);
    end.setDate(today.getDate() + 7);
    return { start: dateStr(today), end: dateStr(end) };
  }

  function comingUpWindow() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = new Date(today);
    start.setDate(today.getDate() + 8);
    var end = new Date(today);
    end.setDate(today.getDate() + 31);
    return { start: dateStr(start), end: dateStr(end) };
  }

  function sortByStartDate(a, b) {
    var ka = (a.startDate || a.date || '') + 'T' + (a.time || '00:00');
    var kb = (b.startDate || b.date || '') + 'T' + (b.time || '00:00');
    return ka.localeCompare(kb);
  }

  function jobColorFor(jobId) {
    var job = data.jobs.find(function(j) { return j.id === jobId; });
    return job ? (job.colorHex || '#c9a84c') : null;
  }

  function fmtTs(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Notes helpers ──────────────────────────────────────────────────────────

  function fmtNoteDate(isoStr) {
    var d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function renderNotesThread(notes) {
    if (!notes.length) return '<div class="notes-empty">No notes yet</div>';
    var topLevel = notes.filter(function(n) { return !n.parent_id; });
    var replies  = notes.filter(function(n) { return  n.parent_id; });
    var replyMap = {};
    replies.forEach(function(r) {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
      replyMap[r.parent_id].push(r);
    });
    var html = '';
    topLevel.forEach(function(n) {
      html += '<div class="staff-note">' +
        '<div class="staff-note-meta"><span class="staff-note-author">' + esc(n.author) + '</span> &mdash; ' + fmtNoteDate(n.created_at) + '</div>' +
        '<div class="staff-note-body">' + esc(n.body) + '</div>';
      var reps = replyMap[n.id] || [];
      if (reps.length) {
        html += '<div class="staff-note-replies">';
        reps.forEach(function(r) {
          html += '<div class="staff-note-reply">' +
            '<div class="staff-note-meta"><span class="staff-note-author">' + esc(r.author) + '</span> &mdash; ' + fmtNoteDate(r.created_at) + '</div>' +
            '<div class="staff-note-body">' + esc(r.body) + '</div>' +
            '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    return html;
  }

  async function loadNotesPanel(type, refId, panel) {
    var contentEl = panel.querySelector('.notes-thread-content');
    if (!contentEl) return;
    contentEl.innerHTML = '<div class="notes-loading">Loading...</div>';
    try {
      var url = '/api/notes?type=' + encodeURIComponent(type);
      if (refId) url += '&ref_id=' + encodeURIComponent(refId);
      var res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      var notes = await res.json();
      contentEl.innerHTML = renderNotesThread(notes);
    } catch (e) {
      contentEl.innerHTML = '<div class="notes-loading" style="color:#e74c3c">Failed to load</div>';
    }
  }

  function loadGeneralNotes() {
    var el = document.getElementById('general-notes-content');
    if (!el) return;
    loadNotesPanel('general', null, document.getElementById('notes-panel-general'));
  }

  window.toggleNotePanel = function(type, refId) {
    var key = type + '-' + (refId || '');
    var panelId = 'notes-panel-' + type + '-' + refId;
    var panel = document.getElementById(panelId);
    if (!panel) return;
    if (openNotePanels[key]) {
      openNotePanels[key] = false;
      panel.style.display = 'none';
    } else {
      openNotePanels[key] = true;
      panel.style.display = 'block';
      loadNotesPanel(type, refId, panel);
    }
  };

  function restoreOpenPanels() {
    Object.keys(openNotePanels).forEach(function(key) {
      if (!openNotePanels[key]) return;
      var dash = key.indexOf('-');
      var type  = key.slice(0, dash);
      var refId = key.slice(dash + 1);
      var panelId = 'notes-panel-' + type + '-' + refId;
      var panel = document.getElementById(panelId);
      if (panel) {
        panel.style.display = 'block';
        loadNotesPanel(type, refId, panel);
      }
    });
  }

  // ── Tab switching ──────────────────────────────────────────────────────────

  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.toggle('active', p.id === 'tab-' + activeTab);
      });
      if (activeTab === 'notes') loadGeneralNotes();
    });
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  function fmtShiftStart(ss) {
    if (!ss) return '';
    var parts = ss.split('T');
    var timePart = parts[1] ? parts[1].slice(0, 5) : '';
    var d = new Date(parts[0] + 'T00:00:00');
    var date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return timePart + ' — ' + date;
  }

  function buildJobCardHtml(j) {
    var start       = j.startDate || j.date || '';
    var assigned    = j.assigned_staff || [];
    var completions = j.completions || [];
    var iAssigned   = myName && assigned.indexOf(myName) !== -1;
    var iCompleted  = myName && completions.indexOf(myName) !== -1;
    var fullyDone   = assigned.length > 0 && completions.length === assigned.length;

    var completionBtn = '';
    if (iAssigned) {
      if (iCompleted) {
        completionBtn = '<button class="btn btn-job-done" onclick="jobUncomplete(\\'' + esc(j.id) + '\\')">&#10003; Marked Complete</button>';
      } else {
        completionBtn = '<button class="btn btn-job-complete" onclick="jobComplete(\\'' + esc(j.id) + '\\')">Mark Complete</button>';
      }
    }

    var crewLine = assigned.length
      ? '<div class="card-meta">Crew: ' + assigned.map(function(n) { return esc(n) + (completions.indexOf(n) !== -1 ? ' \u2713' : ''); }).join(', ') + '</div>'
      : '';
    var shiftLine = j.shift_start ? '<div class="card-meta">Shift: ' + esc(fmtShiftStart(j.shift_start)) + '</div>' : '';

    return '<div class="card" style="border-left-color:' + esc(j.colorHex || '#c9a84c') + '">' +
      '<div class="card-body">' +
        '<div class="job-dt"><span class="job-time-big">' + esc(j.time || '\u2014') + '</span>' +
          '<span class="job-date-sm">' + fmtDateRange(start, j.endDate) + '</span></div>' +
        '<div class="card-title">' + esc(j.title) + (fullyDone ? ' <span class="job-complete-badge">Complete</span>' : '') + '</div>' +
        (j.description ? '<div class="card-detail">' + esc(j.description) + '</div>' : '') +
        shiftLine +
        crewLine +
      '</div>' +
      '<div class="card-actions">' +
        (j.documentKey ? '<button class="btn btn-print" onclick="printDoc(\\'' + esc(j.documentKey) + '\\')">&#128196; Print</button>' : '') +
        completionBtn +
        '<button class="btn btn-notes-toggle" onclick="toggleNotePanel(\\'job\\',\\'' + esc(j.id) + '\\')">Notes</button>' +
        '<button class="btn btn-note" onclick="openNoteModal(\\'job\\',\\'' + esc(j.id) + '\\')">+ Note</button>' +
      '</div>' +
      '<div class="card-notes-panel" id="notes-panel-job-' + esc(j.id) + '" style="display:none">' +
        '<div class="notes-thread-content"></div>' +
      '</div>' +
      '</div>';
  }

  function renderJobs() {
    var el = document.getElementById('tab-jobs');
    var rw = rollingWindow();
    var cw = comingUpWindow();

    function inNext7(j) { var s = j.startDate || j.date || ''; var e = j.endDate || s; return s <= rw.end && e >= rw.start; }
    function inComingUp(j) { var s = j.startDate || j.date || ''; var e = j.endDate || s; return s <= cw.end && e >= cw.start; }

    var nextJobs   = data.jobs.filter(inNext7).sort(sortByStartDate);
    var comingJobs = data.jobs.filter(inComingUp).sort(sortByStartDate);

    if (!nextJobs.length && !comingJobs.length) {
      el.innerHTML = '<div class="placeholder">No jobs scheduled</div>';
      return;
    }

    var html = '<div class="section-heading">Next 7 Days</div>';
    if (nextJobs.length) {
      for (var i = 0; i < nextJobs.length; i++) html += buildJobCardHtml(nextJobs[i]);
    } else {
      html += '<div class="placeholder-sm">No jobs in the next 7 days</div>';
    }

    html += '<div class="section-divider"></div>';
    html += '<div class="section-heading">Coming Up</div>';
    if (comingJobs.length) {
      for (var i = 0; i < comingJobs.length; i++) html += buildJobCardHtml(comingJobs[i]);
    } else {
      html += '<div class="placeholder-sm">Nothing scheduled in the next month</div>';
    }

    el.innerHTML = html;
  }

  function renderTasks() {
    var el = document.getElementById('tab-tasks');
    var tasks = data.tasks.filter(function(t) { return t.status !== 'complete'; });

    if (!tasks.length) { el.innerHTML = '<div class="placeholder">No active tasks</div>'; return; }

    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      html += buildTaskCard(tasks[i], false);
    }
    el.innerHTML = html;
    attachTaskListeners();
  }

  function renderDone() {
    var el = document.getElementById('tab-done');
    var tasks = data.tasks
      .filter(function(t) { return t.status === 'complete'; })
      .sort(function(a, b) { return (b.completedAt || 0) - (a.completedAt || 0); });

    if (!tasks.length) { el.innerHTML = '<div class="placeholder">Nothing completed yet</div>'; return; }

    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      html += buildTaskCard(tasks[i], true);
    }
    el.innerHTML = html;
  }

  function buildTaskCard(t, done) {
    var assigned = t.assignedTo || [];
    var slots = t.slots || 1;
    var iAssigned = myName && assigned.indexOf(myName) !== -1;
    var canClaim = myName && !iAssigned && assigned.length < slots && t.status !== 'complete';

    var statusClass = 'status-' + (t.status || 'pending');
    var cardClass = done ? 'card done' : 'card';
    var taskColor = t.colorHex || '#c9a84c';
    var jobColor = (!done && t.jobId) ? jobColorFor(t.jobId) : null;
    var cardStyle = jobColor
      ? 'border-left:6px solid ' + jobColor + ';border-right:6px solid ' + taskColor + ';border-top:none;border-bottom:none'
      : 'border-left-color:' + taskColor;

    var taskTimeStr = '';
    if (t.date && t.startTime && t.endTime) taskTimeStr = fmtDate(t.date) + ', ' + t.startTime + ' \u2013 ' + t.endTime;
    else if (t.date && t.startTime)         taskTimeStr = fmtDate(t.date) + ', ' + t.startTime;
    else if (t.date)                        taskTimeStr = fmtDate(t.date);
    else if (t.startTime && t.endTime)      taskTimeStr = t.startTime + ' \u2013 ' + t.endTime;
    else if (t.startTime)                   taskTimeStr = t.startTime;
    var html = '<div class="' + cardClass + '" style="' + cardStyle + '" data-task-id="' + esc(t.id) + '">' +
      '<div class="card-strip" style="background:' + esc(taskColor) + '"></div>' +
      '<div class="card-body">' +
        '<div class="card-title">' + esc(t.title) + '</div>' +
        (taskTimeStr ? '<div class="card-meta" style="font-variant-numeric:tabular-nums">' + esc(taskTimeStr) + '</div>' : '') +
        (t.detail ? '<div class="card-detail">' + esc(t.detail) + '</div>' : '') +
        '<span class="status-badge ' + statusClass + '">' + esc(t.status || 'pending') + '</span>';

    if (!done) {
      // Slot pills
      html += '<div class="slots-row">';
      for (var s = 0; s < slots; s++) {
        var name = assigned[s];
        if (name) {
          if (name === myName) {
            html += '<button class="slot-pill filled-mine unclaim-btn" data-task-id="' + esc(t.id) + '" data-job-id="' + esc(t.jobId || 'standalone') + '" data-name="' + esc(name) + '">' + esc(name) + ' \u2715</button>';
          } else {
            html += '<span class="slot-pill filled-other">' + esc(name) + '</span>';
          }
        } else if (canClaim && !assigned.includes(myName)) {
          html += '<button class="slot-pill claimable claim-btn" data-task-id="' + esc(t.id) + '" data-job-id="' + esc(t.jobId || 'standalone') + '">Claim</button>';
          canClaim = false;
        } else {
          html += '<span class="slot-pill open">Open</span>';
        }
      }
      html += '</div>';
    } else {
      if (t.completedAt) html += '<div class="done-time">Completed ' + fmtTs(t.completedAt) + '</div>';
    }

    html += '</div>';

    // Actions row
    if (!done) {
      html += '<div class="card-actions">';
      if (t.documentKey) {
        html += '<button class="btn btn-print" onclick="printDoc(\\'' + esc(t.documentKey) + '\\')">&#128196; Print</button>';
      }
      if (iAssigned) {
        html += '<button class="btn btn-complete complete-btn" data-task-id="' + esc(t.id) + '" data-job-id="' + esc(t.jobId || 'standalone') + '">Mark Complete</button>';
      }
      html += '<button class="btn btn-notes-toggle" onclick="toggleNotePanel(\\'task\\',\\'' + esc(t.id) + '\\')">Notes</button>';
      html += '<button class="btn btn-note" onclick="openNoteModal(\\'task\\',\\'' + esc(t.id) + '\\')">+ Note</button>';
      html += '</div>';
      html += '<div class="card-notes-panel" id="notes-panel-task-' + esc(t.id) + '" style="display:none">' +
        '<div class="notes-thread-content"></div>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderMine() {
    var el = document.getElementById('tab-mine');
    if (!myName) { el.innerHTML = '<div class="placeholder">Select your name to see your assignments</div>'; return; }

    var myJobs = data.jobs.filter(function(j) {
      return (j.assigned_staff || []).indexOf(myName) !== -1;
    }).sort(sortByStartDate);

    var myTasks = data.tasks.filter(function(t) {
      return (t.assignedTo || []).indexOf(myName) !== -1 && t.status !== 'complete';
    });

    var html = '<div class="section-heading">My Jobs</div>';
    if (myJobs.length) {
      myJobs.forEach(function(j) { html += buildJobCardHtml(j); });
    } else {
      html += '<div class="placeholder-sm">No jobs assigned</div>';
    }

    html += '<div class="section-divider"></div>';
    html += '<div class="section-heading">My Tasks</div>';
    if (myTasks.length) {
      myTasks.forEach(function(t) { html += buildTaskCard(t, false); });
    } else {
      html += '<div class="placeholder-sm">No tasks assigned</div>';
    }

    el.innerHTML = html;
    attachTaskListeners();
  }

  function renderAll() {
    renderJobs();
    renderTasks();
    renderDone();
    renderMine();
    restoreOpenPanels();
    if (activeTab === 'notes') loadGeneralNotes();
  }

  // ── Task action listeners ──────────────────────────────────────────────────

  function attachTaskListeners() {
    document.querySelectorAll('.claim-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        apiCall('/api/staff/claim', { taskId: btn.dataset.taskId, jobId: btn.dataset.jobId, staffName: myName });
      });
    });

    document.querySelectorAll('.unclaim-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!confirm('Remove yourself from this task?')) return;
        apiCall('/api/staff/unclaim', { taskId: btn.dataset.taskId, jobId: btn.dataset.jobId, staffName: myName });
      });
    });

    document.querySelectorAll('.complete-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (!btn.dataset.confirming) {
          btn.dataset.confirming = '1';
          var orig = btn.textContent;
          btn.textContent = 'Confirm Complete?';
          btn.classList.add('btn-confirm');
          btn.classList.remove('btn-complete');
          setTimeout(function() {
            if (btn.dataset.confirming) {
              delete btn.dataset.confirming;
              btn.textContent = orig;
              btn.classList.remove('btn-confirm');
              btn.classList.add('btn-complete');
            }
          }, 3000);
        } else {
          delete btn.dataset.confirming;
          apiCall('/api/staff/complete', { taskId: btn.dataset.taskId, jobId: btn.dataset.jobId, staffName: myName });
        }
      });
    });
  }

  // ── Note modal ─────────────────────────────────────────────────────────────

  window.openNoteModal = function(type, refId) {
    noteCtx = { type: type, refId: refId || null };
    var sel = document.getElementById('note-author-sel');
    sel.innerHTML = '<option value="">Select name...</option>';
    (data.crew || []).forEach(function(n) {
      var opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      if (n === myName) opt.selected = true;
      sel.appendChild(opt);
    });
    document.getElementById('note-body-ta').value = '';
    document.getElementById('note-status').textContent = '';
    document.getElementById('note-status').className = '';
    var titles = { general: 'General Note', job: 'Note for Job', task: 'Note for Task' };
    document.getElementById('note-modal-title').textContent = titles[type] || 'Add Note';
    document.getElementById('note-modal').classList.add('open');
  };

  window.closeNoteModal = function() {
    document.getElementById('note-modal').classList.remove('open');
  };

  window.submitNote = async function() {
    var author = document.getElementById('note-author-sel').value;
    var body   = document.getElementById('note-body-ta').value.trim();
    var statusEl = document.getElementById('note-status');
    if (!author) { statusEl.textContent = 'Please select your name'; statusEl.className = 'err'; return; }
    if (!body)   { statusEl.textContent = 'Please enter a note';     statusEl.className = 'err'; return; }
    statusEl.textContent = 'Sending...';
    statusEl.className = '';
    try {
      var res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteCtx.type, ref_id: noteCtx.refId, author: author, body: body })
      });
      if (!res.ok) throw new Error('Request failed');
      statusEl.textContent = 'Note saved';
      statusEl.className = 'ok';
      setTimeout(closeNoteModal, 1200);
    } catch (e) {
      statusEl.textContent = 'Failed to save note';
      statusEl.className = 'err';
    }
  };

  // ── Job completion ─────────────────────────────────────────────────────────

  window.jobComplete = async function(jobId) {
    if (!myName) { alert('Please select your name first'); return; }
    try {
      var res = await fetch('/api/jobs/' + jobId + '/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName })
      });
      if (!res.ok) throw new Error('Failed');
      await fetchData();
    } catch (e) { alert('Network error, please try again'); }
  };

  window.jobUncomplete = async function(jobId) {
    if (!myName) return;
    try {
      var res = await fetch('/api/jobs/' + jobId + '/uncomplete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName })
      });
      if (!res.ok) throw new Error('Failed');
      await fetchData();
    } catch (e) { alert('Network error, please try again'); }
  };

  // ── API calls ──────────────────────────────────────────────────────────────

  async function apiCall(path, body) {
    try {
      var res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var json = await res.json();
      if (!res.ok) { alert(json.error || 'Request failed'); return; }
      await fetchData();
    } catch (e) {
      alert('Network error, please try again');
    }
  }

  async function fetchData() {
    try {
      var res = await fetch('/api/data');
      data = await res.json();
    } catch (e) {
      console.error('Fetch failed', e);
      return;
    }
    buildNameGrid();
    renderAll();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  fetchData().then(function() {
    if (myName) {
      document.getElementById('current-name').textContent = myName;
      document.getElementById('tab-mine-btn').classList.remove('hidden');
      hideNameOverlay();
    } else {
      showNameOverlay();
    }
  });

  // Poll every 30s
  setInterval(fetchData, 30000);

  // Expose for inline onclick
  window.showNameOverlay = showNameOverlay;
  window.printDoc = function(key) {
    window.open('/api/documents/' + key, '_blank');
  };
})();
</script>
</body>
</html>`;
}
