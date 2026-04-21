export function wallHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Raven Staging — Warehouse</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 100%; height: 100%;
  background: #0a0a0a;
  color: #f0f0f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  overflow: hidden;
  cursor: none;
}

#app { width: 100%; height: 100%; display: flex; flex-direction: column; }

#header {
  padding: 14px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
}

#logo {
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c9a84c;
}

#clock {
  font-size: 2.2rem;
  font-weight: 200;
  letter-spacing: 0.04em;
  color: #666;
  font-variant-numeric: tabular-nums;
}

#progress-wrap { height: 3px; background: #111; flex-shrink: 0; }
#progress-fill { height: 100%; background: #c9a84c; width: 0; }

#view-container { flex: 1; position: relative; overflow: hidden; }

.view {
  position: absolute;
  inset: 0;
  padding: 28px 36px;
  opacity: 0;
  transition: opacity 0.7s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.view.active { opacity: 1; }

.view-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.25em;
  color: #c9a84c;
  margin-bottom: 20px;
  font-weight: 700;
  flex-shrink: 0;
}

/* Multi-column card grid — fills screen width automatically */
.cards-grid {
  column-count: auto;
  column-width: 400px;
  column-gap: 16px;
  margin-bottom: 20px;
}

/* Compact job cards (Coming Up section) — slightly smaller fonts */
.card.compact { border-left-width: 4px; }
.compact .job-when  { font-size: 1.4rem; }
.compact .job-title { font-size: 1.2rem; }

.placeholder-sm { color: #2a2a2a; font-size: 0.95rem; font-style: italic; padding: 8px 0; margin-bottom: 20px; }

/* Coming Up section divider */
.coming-up-divider {
  border: none;
  border-top: 1px solid #1e1e1e;
  margin: 8px 0 18px;
}

/* Cards */
.card {
  background: #111;
  border-radius: 10px;
  border: 1px solid #1e1e1e;
  border-left: 6px solid #c9a84c;
  padding: 12px 16px;
  overflow: hidden;
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
  margin-bottom: 12px;
  width: 100%;
  display: inline-block;
  box-sizing: border-box;
}

.job-when {
  font-size: 1.8rem;
  font-weight: 700;
  color: #888;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.job-title {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
}

/* Task cards */
.task-card { position: relative; }
.task-strip { height: 4px; border-radius: 4px 4px 0 0; position: absolute; top: -1px; left: -1px; right: -1px; }
.task-title  { font-size: 1.4rem; font-weight: 700; line-height: 1.2; margin-top: 8px; }
.task-time   { font-size: 1rem; font-weight: 700; color: #888; margin-top: 4px; font-variant-numeric: tabular-nums; }
.task-detail,
.card-desc {
  font-size: 1rem; color: #aaa; opacity: 0.7; margin-top: 6px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

.card-crew  { font-size: 0.9rem; color: #666; margin-top: 6px; }
.task-slots { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.slot-chip {
  padding: 5px 16px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 600;
  border: 2px solid;
}
.slot-chip.filled { background: rgba(201,168,76,0.12); border-color: #c9a84c; color: #c9a84c; }
.slot-chip.empty  { background: transparent; border-color: #2a2a2a; color: #444; }
.task-full-badge  { margin-top: 8px; font-size: 0.8rem; color: #555; font-style: italic; }

/* Completed */
.card.done { opacity: 0.42; filter: grayscale(1); }
.done-time  { font-size: 0.8rem; color: #555; margin-top: 8px; }

.placeholder { color: #2a2a2a; font-size: 1.4rem; font-style: italic; text-align: center; padding: 60px 0; }
.doc-icon    { font-size: 1rem; opacity: 0.45; margin-left: 10px; vertical-align: middle; }
.task-count-badge {
  display: inline-block; margin-top: 10px; padding: 3px 12px; border-radius: 999px;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  background: rgba(201,168,76,0.1); color: #c9a84c; border: 1px solid rgba(201,168,76,0.25);
}

/* Compact-text density mode — applied when content overflows at 300px column width */
.compact-text .job-when  { font-size: 1.2rem; }
.compact-text .job-title { font-size: 1.1rem; }
.compact-text .card-desc,
.compact-text .task-detail { display: none; }

/* Dots */
#dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  padding: 12px;
  flex-shrink: 0;
}
.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #2a2a2a;
  transition: background 0.3s, transform 0.3s;
}
.dot.active { background: #c9a84c; transform: scale(1.5); }
</style>
</head>
<body>
<div id="app">
  <div id="header">
    <div id="logo">Raven Staging</div>
    <div id="clock">00:00</div>
  </div>
  <div id="progress-wrap"><div id="progress-fill"></div></div>
  <div id="view-container">
    <div class="view" id="view-0"></div>
    <div class="view" id="view-1"></div>
    <div class="view" id="view-2"></div>
  </div>
  <div id="dots">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</div>

<script>
(function () {
  var data = { jobs: [], tasks: [], config: {} };
  var currentView = 0;
  var cycleTimer = null;

  // Clock
  function tickClock() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock').textContent = h + ':' + m;
  }
  setInterval(tickClock, 1000);
  tickClock();

  // Helpers
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
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = new Date(today); end.setDate(today.getDate() + 7);
    return { start: dateStr(today), end: dateStr(end) };
  }

  function comingUpWindow() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var start = new Date(today); start.setDate(today.getDate() + 8);
    var end = new Date(today);   end.setDate(today.getDate() + 31);
    return { start: dateStr(start), end: dateStr(end) };
  }

  function jobInWindow(j) {
    var s = j.startDate || j.date || '', e = j.endDate || s, w = rollingWindow();
    return s <= w.end && e >= w.start;
  }

  function jobInComingUp(j) {
    var s = j.startDate || j.date || '', e = j.endDate || s, w = comingUpWindow();
    return s <= w.end && e >= w.start;
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

  function windowHeading() {
    var w = rollingWindow(), opts = { day: 'numeric', month: 'short' };
    var s = new Date(w.start + 'T00:00:00').toLocaleDateString('en-GB', opts);
    var e = new Date(w.end   + 'T00:00:00').toLocaleDateString('en-GB', opts);
    return s + ' \u2013 ' + e;
  }

  function fmtTs(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Card HTML builders ────────────────────────────────────────────────────

  function fmtShiftStart(ss) {
    if (!ss) return '';
    var parts = ss.split('T');
    var timePart = parts[1] ? parts[1].slice(0, 5) : '';
    var d = new Date(parts[0] + 'T00:00:00');
    var date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return timePart + ' — ' + date;
  }

    function buildJobCard(j, compact) {
    var start       = j.startDate || j.date || '';
    var datePart    = start ? fmtDateRange(start, j.endDate) : '';
    var whenStr     = datePart && j.time ? datePart + ',\u2002' + j.time : datePart || j.time || '';
    var assigned    = j.assigned_staff || [];
    var completions = j.completions || [];
    var crewLine    = assigned.length
      ? '<div class="card-crew">Crew: ' + assigned.map(function(n) { return esc(n) + (completions.indexOf(n) !== -1 ? ' \u2713' : ''); }).join(', ') + '</div>'
      : '';
    var shiftLine = j.shift_start ? '<div class="card-crew">Shift: ' + esc(fmtShiftStart(j.shift_start)) + '</div>' : '';
    return '<div class="card job-card' + (compact ? ' compact' : '') + '" style="border-left-color:' + esc(j.colorHex || '#c9a84c') + '">' +
      (whenStr ? '<div class="job-when">' + esc(whenStr) + '</div>' : '') +
      '<div class="job-title">' + esc(j.title) + (j.documentKey ? '<span class="doc-icon">&#128196;</span>' : '') + '</div>' +
      (j.description ? '<div class="card-desc">' + esc(j.description) + '</div>' : '') +
      shiftLine +
      crewLine +
      '</div>';
  }

  function buildTaskCardHtml(t) {
    var assigned = t.assignedTo || [], slots = t.slots || 1, full = assigned.length >= slots;
    var chipsHtml = '';
    for (var s = 0; s < slots; s++) {
      if (assigned[s]) chipsHtml += '<span class="slot-chip filled">' + esc(assigned[s]) + '</span>';
    }
    var taskColor = t.colorHex || '#c9a84c';
    var jobColor = t.jobId ? jobColorFor(t.jobId) : null;
    var cardStyle = jobColor
      ? 'border-left:6px solid ' + jobColor + ';border-right:6px solid ' + taskColor + ';border-top:none;border-bottom:none'
      : 'border-left-color:' + taskColor;
    var timeStr = '';
    if (t.date && t.startTime && t.endTime) timeStr = fmtDate(t.date) + ', ' + t.startTime + ' \u2013 ' + t.endTime;
    else if (t.date && t.startTime)         timeStr = fmtDate(t.date) + ', ' + t.startTime;
    else if (t.date)                        timeStr = fmtDate(t.date);
    else if (t.startTime && t.endTime)      timeStr = t.startTime + ' \u2013 ' + t.endTime;
    else if (t.startTime)                   timeStr = t.startTime;
    return '<div class="card task-card" style="' + cardStyle + '">' +
      '<div class="task-strip" style="background:' + esc(taskColor) + '"></div>' +
      '<div class="task-title">' + esc(t.title) + (t.documentKey ? '<span class="doc-icon">&#128196;</span>' : '') + '</div>' +
      (timeStr ? '<div class="task-time">' + esc(timeStr) + '</div>' : '') +
      (t.detail ? '<div class="task-detail">' + esc(t.detail) + '</div>' : '') +
      '<div class="task-slots">' + chipsHtml + '</div>' +
      (full ? '<div class="task-full-badge">Fully assigned</div>' : '') +
      '</div>';
  }

  function buildCompletedCardHtml(t) {
    return '<div class="card done" style="border-left-color:' + esc(t.colorHex || '#555') + '">' +
      '<div class="task-title">' + esc(t.title) + '</div>' +
      (t.completedAt ? '<div class="done-time">Completed ' + fmtTs(t.completedAt) + '</div>' : '') +
      '</div>';
  }

  // ── Density adjustment ────────────────────────────────────────────────────
  // If content overflows: try 300px columns; if still overflows: reduce font sizes

  function adjustDensity(viewEl) {
    var availH = document.getElementById('view-container').clientHeight;
    var grids = viewEl.querySelectorAll('.cards-grid');
    grids.forEach(function(g) { g.style.columnWidth = ''; });
    viewEl.classList.remove('compact-text');

    requestAnimationFrame(function() {
      if (viewEl.scrollHeight <= availH) return;
      grids.forEach(function(g) { g.style.columnWidth = '300px'; });
      requestAnimationFrame(function() {
        if (viewEl.scrollHeight > availH) {
          viewEl.classList.add('compact-text');
        }
      });
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderAll() {
    var w7 = data.jobs.filter(jobInWindow).sort(sortByStartDate);
    var cu = data.jobs.filter(jobInComingUp).sort(sortByStartDate);

    // View 0 — schedule
    var v0 = document.getElementById('view-0');
    var v0html = '<div class="view-label">Next 7 Days \u2014 ' + windowHeading() + '</div>';
    v0html += w7.length
      ? '<div class="cards-grid">' + w7.map(function(j) { return buildJobCard(j, false); }).join('') + '</div>'
      : '<div class="placeholder-sm">No jobs in the next 7 days</div>';
    v0html += '<hr class="coming-up-divider"><div class="view-label">Coming Up</div>';
    v0html += cu.length
      ? '<div class="cards-grid">' + cu.map(function(j) { return buildJobCard(j, true); }).join('') + '</div>'
      : '<div class="placeholder-sm">Nothing scheduled in the next month</div>';
    v0.innerHTML = v0html;
    adjustDensity(v0);

    // View 1 — priority tasks
    var v1 = document.getElementById('view-1');
    var pt = data.tasks.filter(function(t) { return t.priority && t.status !== 'complete'; });
    var v1html = '<div class="view-label">Priority Tasks</div>';
    v1html += pt.length
      ? '<div class="cards-grid">' + pt.map(buildTaskCardHtml).join('') + '</div>'
      : '<div class="placeholder">No priority tasks active</div>';
    v1.innerHTML = v1html;
    adjustDensity(v1);

    // View 2 — completed
    var v2 = document.getElementById('view-2');
    var done = data.tasks.filter(function(t) { return t.status === 'complete'; })
      .sort(function(a, b) { return (b.completedAt || 0) - (a.completedAt || 0); });
    var v2html = '<div class="view-label">Completed</div>';
    v2html += done.length
      ? '<div class="cards-grid">' + done.map(buildCompletedCardHtml).join('') + '</div>'
      : '<div class="placeholder">Nothing completed yet</div>';
    v2.innerHTML = v2html;
    adjustDensity(v2);
  }

  // ── View cycling ──────────────────────────────────────────────────────────

  function calcViewInterval(viewIdx) {
    var cards = 0;
    if (viewIdx === 0) cards = data.jobs.filter(jobInWindow).length + data.jobs.filter(jobInComingUp).length;
    if (viewIdx === 1) cards = data.tasks.filter(function(t) { return t.priority && t.status !== 'complete'; }).length;
    if (viewIdx === 2) cards = data.tasks.filter(function(t) { return t.status === 'complete'; }).length;
    return Math.min(60000, Math.max(15000, 15000 + cards * 3000));
  }

  function showView(idx) {
    idx = ((idx % 3) + 3) % 3;
    currentView = idx;
    document.querySelectorAll('.view').forEach(function(v, i) { v.classList.toggle('active', i === idx); });
    document.querySelectorAll('.dot').forEach(function(d, i)  { d.classList.toggle('active', i === idx); });
    animateProgress();
  }

  function animateProgress() {
    var interval = calcViewInterval(currentView);
    var fill = document.getElementById('progress-fill');
    fill.style.transition = 'none';
    fill.style.width = '0%';
    fill.getBoundingClientRect();
    fill.style.transition = 'width ' + interval + 'ms linear';
    fill.style.width = '100%';
  }

  function scheduleNext() {
    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(function() {
      showView(currentView + 1);
      scheduleNext();
    }, calcViewInterval(currentView));
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function fetchData() {
    try {
      var res = await fetch('/api/data');
      data = await res.json();
    } catch (e) {
      console.error('Poll failed', e);
    }
  }

  // Init
  fetchData().then(function() {
    renderAll();
    showView(0);
    scheduleNext();
  });

  // Refresh every 60s
  setInterval(function() {
    fetchData().then(renderAll);
  }, 60000);
})();
</script>
</body>
</html>`;
}
