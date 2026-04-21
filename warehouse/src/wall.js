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
  background: #0a0a0a; color: #f0f0f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  overflow: hidden; cursor: none;
}

#app { width: 100%; height: 100%; display: flex; flex-direction: column; }

#header {
  padding: 14px 36px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid #1a1a1a;
}
#logo { font-size: 1.3rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #c9a84c; }
#clock { font-size: 2.2rem; font-weight: 200; letter-spacing: 0.04em; color: #666; font-variant-numeric: tabular-nums; }

#progress-wrap { height: 3px; background: #111; flex-shrink: 0; }
#progress-fill { height: 100%; background: #c9a84c; width: 0; }

#view-container { flex: 1; position: relative; overflow: hidden; min-height: 0; }

/* ── Screens ── */
.screen {
  position: absolute; inset: 0; opacity: 0;
  transition: opacity 0.7s ease;
  display: flex; flex-direction: column;
  pointer-events: none;
}
.screen.active { opacity: 1; pointer-events: auto; }

/* ── Split halves ── */
.half { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 18px 36px 14px; }
.half-divider { height: 1px; background: #1e1e1e; flex-shrink: 0; margin: 0 36px; }
.half-label {
  font-size: 0.72rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.25em;
  color: #c9a84c; margin-bottom: 14px; flex-shrink: 0;
}

/* ── Horizontal scroll container ── */
.scroll-mask { flex: 1; min-height: 0; overflow: hidden; }
.scroll-inner {
  position: relative;        /* offsetParent for child cards */
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 16px;
  height: 100%;
  will-change: transform;
}

/* ── Cards ── */
.card {
  flex-shrink: 0; width: 360px;
  display: flex; flex-direction: column;
  background: #111; border-radius: 10px;
  border: 1px solid #1e1e1e; border-left: 6px solid #c9a84c;
  padding: 24px 20px 20px; position: relative; overflow: hidden;
}
.card-date { font-size: 1.3rem; font-weight: 600; color: #888; line-height: 1.2; font-variant-numeric: tabular-nums; margin-bottom: 6px; }
.card-date.no-date { color: #444; font-style: italic; }
.card-title { font-size: 2rem; font-weight: 800; line-height: 1.2; margin-bottom: 12px; flex: 1; }
.card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: auto; }
.status-chip { display: inline-block; padding: 5px 14px; border-radius: 999px; font-size: 0.95rem; font-weight: 700; border: 2px solid; letter-spacing: 0.04em; white-space: nowrap; }
.card-crew { font-size: 1.1rem; color: #aaa; }

/* Task strip */
.task-strip { height: 4px; position: absolute; top: 0; left: 0; right: 0; border-radius: 4px 4px 0 0; }
.task-card .card-title { margin-top: 8px; }

/* Empty state */
.placeholder { color: #2a2a2a; font-size: 1.4rem; font-style: italic; padding: 40px 0; white-space: nowrap; }

/* ── Dots ── */
#dots { display: flex; justify-content: center; align-items: center; gap: 14px; padding: 12px; flex-shrink: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #2a2a2a; transition: background 0.3s, transform 0.3s; }
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

    <!-- Screen 0: Jobs -->
    <div class="screen" id="screen-0">
      <div class="half">
        <div class="half-label" id="s0-top-label">Current Jobs</div>
        <div class="scroll-mask" id="s0-top-mask"><div class="scroll-inner" id="s0-top-inner"></div></div>
      </div>
      <div class="half-divider"></div>
      <div class="half">
        <div class="half-label">Upcoming Jobs</div>
        <div class="scroll-mask" id="s0-bot-mask"><div class="scroll-inner" id="s0-bot-inner"></div></div>
      </div>
    </div>

    <!-- Screen 1: Tasks -->
    <div class="screen" id="screen-1">
      <div class="half">
        <div class="half-label" id="s1-top-label">Tasks This Week</div>
        <div class="scroll-mask" id="s1-top-mask"><div class="scroll-inner" id="s1-top-inner"></div></div>
      </div>
      <div class="half-divider"></div>
      <div class="half">
        <div class="half-label">Upcoming &amp; Unscheduled Tasks</div>
        <div class="scroll-mask" id="s1-bot-mask"><div class="scroll-inner" id="s1-bot-inner"></div></div>
      </div>
    </div>

  </div>
  <div id="dots"><div class="dot"></div><div class="dot"></div></div>
</div>

<script>
(function () {
  var data = { jobs: [], tasks: [], crew: [], config: {} };
  var currentScreen = 0;
  var cancelFns    = [];   // cancel functions for active RAF loops
  var switchTimer  = null; // setTimeout handle for the final screen switch
  var minDwellTimer = null;

  // ── Clock ──────────────────────────────────────────────────────────────────
  function tickClock() {
    var n = new Date();
    document.getElementById('clock').textContent =
      String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
  }
  setInterval(tickClock, 1000);
  tickClock();

  // ── Utilities ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function toDS(d) {
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function today()  { var d=new Date(); d.setHours(0,0,0,0); return toDS(d); }
  function cutoff() { var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+7); return toDS(d); }
  function fmtDate(ds) {
    return new Date(ds+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  }
  function fmtRange(s,e) { return (!e||e===s)?fmtDate(s):fmtDate(s)+' – '+fmtDate(e); }
  function weekHeading() {
    var t=new Date(); t.setHours(0,0,0,0);
    var c=new Date(t); c.setDate(t.getDate()+7);
    var o={day:'numeric',month:'short'};
    return t.toLocaleDateString('en-GB',o)+' – '+c.toLocaleDateString('en-GB',o);
  }

  // ── Filtering & sorting ────────────────────────────────────────────────────
  function jobCurrent(j)  { var s=j.startDate||j.date||'',e=j.endDate||s; return s&&s<=cutoff()&&e>=today(); }
  function jobUpcoming(j) { var s=j.startDate||j.date||''; return s&&s>cutoff(); }
  function taskCurrent(t) { return t.date&&t.date>=today()&&t.date<=cutoff(); }
  function taskUpcoming(t){ return !t.date||t.date>cutoff(); }

  function byStart(a,b) {
    var ka=(a.startDate||a.date||'9999')+(a.time||'00:00');
    var kb=(b.startDate||b.date||'9999')+(b.time||'00:00');
    return ka<kb?-1:ka>kb?1:0;
  }
  function byDateNullLast(a,b) {
    if (!a.date&&!b.date) return 0;
    if (!a.date) return 1; if (!b.date) return -1;
    return a.date<b.date?-1:a.date>b.date?1:0;
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  function jobStatus(j) {
    var a=j.assigned_staff||[],c=j.completions||[];
    if (a.length&&c.length>=a.length) return {label:'Complete',    color:'#4caf50'};
    if (c.length)                     return {label:'In Progress', color:'#c9a84c'};
    if (a.length)                     return {label:'Confirmed',   color:'#4a9eff'};
    return {label:'Scheduled',color:'#555'};
  }
  function taskStatus(t) {
    if (t.status==='complete')   return {label:'Complete',    color:'#4caf50'};
    if (t.status==='inprogress') return {label:'In Progress', color:'#c9a84c'};
    return {label:'Pending',color:'#555'};
  }

  // ── Card builders ──────────────────────────────────────────────────────────
  function buildJobCard(j) {
    var s=j.startDate||j.date||'';
    var dl=s?fmtRange(s,j.endDate):'';
    var as=j.assigned_staff||[];
    var st=jobStatus(j), col=j.colorHex||'#c9a84c';
    return '<div class="card" style="border-left-color:'+esc(col)+'">' +
      (dl?'<div class="card-date">'+esc(dl)+'</div>':'') +
      '<div class="card-title">'+esc(j.title)+'</div>' +
      '<div class="card-meta">' +
        '<span class="status-chip" style="color:'+st.color+';border-color:'+st.color+'">'+st.label+'</span>' +
        (as.length?'<span class="card-crew">Crew: '+as.map(esc).join(', ')+'</span>':'') +
      '</div></div>';
  }

  function buildTaskCard(t) {
    var col=t.colorHex||'#c9a84c', as=t.assignedTo||[], st=taskStatus(t);
    var ts='';
    if (t.date&&t.startTime&&t.endTime) ts=fmtDate(t.date)+', '+t.startTime+' – '+t.endTime;
    else if (t.date&&t.startTime)       ts=fmtDate(t.date)+', '+t.startTime;
    else if (t.date)                    ts=fmtDate(t.date);
    var dh=ts?'<div class="card-date">'+esc(ts)+'</div>'
            :'<div class="card-date no-date">Unscheduled</div>';
    return '<div class="card task-card" style="border-left-color:'+esc(col)+'">' +
      '<div class="task-strip" style="background:'+esc(col)+'"></div>' +
      '<div class="card-title">'+esc(t.title)+'</div>' +
      dh +
      '<div class="card-meta">' +
        '<span class="status-chip" style="color:'+st.color+';border-color:'+st.color+'">'+st.label+'</span>' +
        (as.length?'<span class="card-crew">Assigned: '+as.map(esc).join(', ')+'</span>':'') +
      '</div></div>';
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function fill(id, items, build, emptyMsg) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div class="placeholder">'+emptyMsg+'</div>';
    } else {
      el.innerHTML = items.map(build).join('');
      el.dataset.singleCount = String(items.length);
    }
  }

  function renderScreens() {
    var h = weekHeading();
    document.getElementById('s0-top-label').textContent = 'Current Jobs · '+h;
    document.getElementById('s1-top-label').textContent = 'Tasks This Week · '+h;

    fill('s0-top-inner', data.jobs.filter(jobCurrent).sort(byStart),  buildJobCard,  'No jobs in the next 7 days');
    fill('s0-bot-inner', data.jobs.filter(jobUpcoming).sort(byStart), buildJobCard,  'No upcoming jobs');
    fill('s1-top-inner',
      data.tasks.filter(function(t){return t.status!=='complete'&&taskCurrent(t);}).sort(byStart),
      buildTaskCard, 'No tasks this week');
    fill('s1-bot-inner',
      data.tasks.filter(function(t){return t.status!=='complete'&&taskUpcoming(t);}).sort(byDateNullLast),
      buildTaskCard, 'No upcoming or unscheduled tasks');
  }

  // ── Horizontal loop scroll ─────────────────────────────────────────────────
  //
  // Cards are duplicated in the DOM (original set + identical copy).
  // We translate the inner div from 0 → -loopOffset, where loopOffset is the
  // pixel position of the first *duplicate* card (i.e. the full width of one set
  // including gaps). At -loopOffset the copy perfectly overlaps the original's
  // starting position, so resetting to 0 is invisible — seamless loop.
  //
  // SPEED: 60 px/s (adjustable)
  // Screen switches when: 20 s minimum elapsed AND both halves have completed
  // at least one full cycle. Both conditions are tracked independently.

  var SPEED     = 60;    // px per second
  var MIN_DWELL = 20000; // ms minimum per screen

  // Starts a continuously-looping translateX animation on inner.
  // Clones cards into the DOM on first call to create the seamless duplicate.
  // Calls onCycleDone() once, on the first full-cycle completion.
  // Returns a cancel function.
  function startHalfLoop(maskId, innerId, onCycleDone) {
    var mask  = document.getElementById(maskId);
    var inner = document.getElementById(innerId);
    if (!mask || !inner) { onCycleDone(); return null; }

    // Strip any previously appended clones (idempotent on re-entry)
    var existing = Array.from(inner.children);
    var origCount = parseInt(inner.dataset.singleCount, 10) || existing.length;
    while (inner.children.length > origCount) {
      inner.removeChild(inner.lastChild);
    }
    inner.style.transform = 'translateX(0)';

    if (inner.scrollWidth <= mask.offsetWidth) {
      onCycleDone();
      return null;
    }

    var originals = Array.from(inner.children);
    originals.forEach(function(card) {
      inner.appendChild(card.cloneNode(true));
    });

    var loopOff = inner.children[originals.length] ? inner.children[originals.length].offsetLeft : 0;
    if (loopOff < 10) { onCycleDone(); return null; }

    var cycleDur = loopOff / SPEED * 1000;
    var startTs = null, lastCycle = 0, done = false, raf = null;

    function tick(ts) {
      if (startTs === null) startTs = ts;
      var elapsed  = ts - startTs;
      var cycle    = Math.floor(elapsed / cycleDur);
      var progress = (elapsed % cycleDur) / cycleDur;
      inner.style.transform = 'translateX(-' + (progress * loopOff).toFixed(2) + 'px)';
      if (cycle > lastCycle) { lastCycle = cycle; if (!done) { done = true; onCycleDone(); } }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function cancel() { if (raf) { cancelAnimationFrame(raf); raf = null; } };
  }

  // ── Progress bar ───────────────────────────────────────────────────────────
  function estimateDuration(maskId, innerId) {
    var mask  = document.getElementById(maskId);
    var inner = document.getElementById(innerId);
    if (!mask || !inner) return MIN_DWELL;
    var overflow = inner.scrollWidth - mask.offsetWidth;
    if (overflow <= 0) return MIN_DWELL;
    var cyc = overflow / SPEED * 1000;
    return cyc >= MIN_DWELL ? cyc : Math.ceil(MIN_DWELL / cyc) * cyc;
  }

  function animateProgress(duration) {
    var fill = document.getElementById('progress-fill');
    fill.style.transition = 'none';
    fill.style.width = '0%';
    fill.getBoundingClientRect(); // force reflow
    fill.style.transition = 'width ' + duration + 'ms linear';
    fill.style.width = '100%';
  }

  // ── Screen cycling ─────────────────────────────────────────────────────────
  function showScreen(idx) {
    // Clean up previous screen's state
    clearTimeout(switchTimer);
    clearTimeout(minDwellTimer);
    cancelFns.forEach(function(fn) { fn && fn(); });
    cancelFns = [];

    idx = ((idx % 2) + 2) % 2;
    currentScreen = idx;

    // Reset scroll position on incoming screen before fade begins
    var innerIds = idx === 0
      ? ['s0-top-inner', 's0-bot-inner']
      : ['s1-top-inner', 's1-bot-inner'];
    innerIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.transform = 'translateX(0)';
    });

    // Fade screens and update dots
    document.querySelectorAll('.screen').forEach(function(s, i) { s.classList.toggle('active', i === idx); });
    document.querySelectorAll('.dot').forEach(function(d, i)    { d.classList.toggle('active', i === idx); });

    // Wait for fade to settle before measuring layout and starting scroll
    setTimeout(function() {
      var masks = idx === 0
        ? [['s0-top-mask','s0-top-inner'], ['s0-bot-mask','s0-bot-inner']]
        : [['s1-top-mask','s1-top-inner'], ['s1-bot-mask','s1-bot-inner']];

      // Estimated screen duration drives the progress bar
      var dur = Math.max(
        estimateDuration(masks[0][0], masks[0][1]),
        estimateDuration(masks[1][0], masks[1][1])
      );
      animateProgress(dur);

      // Switch when BOTH conditions are met:
      //   1. 20 s minimum has elapsed
      //   2. Both halves have completed at least one full cycle
      var minDwellReached = false;
      var halfDone        = [false, false];
      var switched        = false;

      function trySwitch() {
        if (switched || !minDwellReached || !halfDone[0] || !halfDone[1]) return;
        switched = true;
        switchTimer = setTimeout(function() { showScreen(idx + 1); }, 200);
      }

      minDwellTimer = setTimeout(function() { minDwellReached = true; trySwitch(); }, MIN_DWELL);

      var c0 = startHalfLoop(masks[0][0], masks[0][1], function() { halfDone[0] = true; trySwitch(); });
      var c1 = startHalfLoop(masks[1][0], masks[1][1], function() { halfDone[1] = true; trySwitch(); });
      cancelFns = [c0, c1].filter(Boolean);

    }, 800); // allow fade-in transition to complete before measuring
  }

  // ── Data fetch ─────────────────────────────────────────────────────────────
  async function fetchData() {
    try {
      var res = await fetch('/api/data');
      data = await res.json();
    } catch (e) {
      console.error('Poll failed', e);
    }
  }

  fetchData().then(function() { renderScreens(); showScreen(0); });
  setInterval(function() { fetchData().then(renderScreens); }, 60000);

})();
</script>
</body>
</html>`;
}
