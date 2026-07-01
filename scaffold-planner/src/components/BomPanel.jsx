import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { calculateBom } from '../state/scaffoldStore';

// ── BOM → quote items serialisation ──────────────────────────────────────────

const STANDARDS_MAP = {
  3: '3m standard', 2.5: '2.5m standard', 2: '2m standard',
  1.5: '1.5m standard', 1: '1m standard', 0.5: '0.5m standard',
};
const LEDGERS_MAP = {
  2.57: '2.57m ledger', 2.07: '2.07m ledger',
  1.57: '1.57m ledger', 1.07: '1.07m ledger',
};
const PANS_MAP = { 2.57: '2.57m pan', 2.07: '2.07m pan' };

function buildQuoteItems(bom) {
  const items = [];
  const add = (description, qty, unitPrice, priceName) => {
    if (!qty || qty <= 0) return;
    const item = { category: 'equipment', description, qty };
    if (unitPrice !== undefined) item.unitPrice = unitPrice;
    if (priceName !== undefined) item.priceName = priceName;
    items.push(item);
  };

  for (const [len, qty] of Object.entries(bom.standards)) {
    const desc = STANDARDS_MAP[Number(len)];
    if (desc) add(desc, qty);
  }
  for (const [len, qty] of Object.entries(bom.ledgers)) {
    add(LEDGERS_MAP[Number(len)] ?? `${len}m ledger`, qty);
  }
  for (const [desc, qty] of Object.entries(bom.braces))     add(desc, qty);
  for (const [desc, qty] of Object.entries(bom.planBraces)) add(desc, qty);
  if (bom.basePlates > 0) {
    add('Starting collars',                  bom.basePlates);
    add('Base plate (spec per engineering)', bom.basePlates);
    add('Screw jack',                        bom.basePlates);
  }
  for (const [len, qty] of Object.entries(bom.deckPans)) {
    add(PANS_MAP[Number(len)] ?? `${len}m pan`, qty);
  }

  for (const b of bom.ladderBeamSpans ?? []) {
    add(`Ladder beam — ${b.span}m span`, 1, undefined, 'Ladder beam');
  }

  add('Tarp set — 2.57m x 2.57m x 2m lift', bom.tarpCount);
  add('Roof kit',      bom.roofKitCount);
  add('Roof tarp',     bom.roofTarpCount);
  add('Apex tarp',     bom.apexTarpCount);
  add('Perspex window', bom.windowCount);

  for (const extra of bom.bomExtras ?? []) {
    if (!extra.qty || extra.qty <= 0) continue;
    const item = { category: 'equipment', description: extra.description, qty: extra.qty };
    if (extra.unitPrice !== undefined) item.unitPrice = extra.unitPrice;
    if (extra.priceName !== undefined) item.priceName = extra.priceName;
    items.push(item);
  }

  return items;
}

// ── Quote modal ───────────────────────────────────────────────────────────────

const QUOTE_BUILDER_URL = 'https://quote-builder.e-kean.workers.dev';

// ── Path B: cross-origin push to the QB "pending layout" store ────────────────
// Scaffold is always a DIFFERENT origin from QB (Pages / localhost), so the
// qb_auth cookie never applies — the low-privilege planner key is required on
// every call. Prompted once, kept in localStorage, reused. Mirrors litedeck's
// qbFetch (same localStorage key name; storage is per-origin so it's independent).
const QB_KEY_STORAGE = 'qb_planner_key';

async function qbFetch(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  let key = (localStorage.getItem(QB_KEY_STORAGE) || '').trim();
  if (!key) {
    key = (window.prompt('Enter the Quote Builder planner key (saved in this browser):') || '').trim();
    if (!key) throw new Error('Planner key required.');
    localStorage.setItem(QB_KEY_STORAGE, key);
  }
  headers['x-planner-key'] = key;
  const res = await fetch(QUOTE_BUILDER_URL + path, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    localStorage.removeItem(QB_KEY_STORAGE);
    throw new Error('Unauthorised — planner key rejected (re-enter it on the next attempt).');
  }
  return res.json();
}

function buildAutoName(config) {
  if (!config) return 'Layher scaffold';
  const cols = config.gridCols ?? 1;
  const firstBay = config.bayLengths?.[0] ?? 2.57;
  const totalWidth = (cols * firstBay).toFixed(2).replace(/\.?0+$/, '');
  const totalDepth = ((config.gridRows ?? 1) * (config.bayWidth ?? 2.57)).toFixed(2).replace(/\.?0+$/, '');
  const height = config.structureHeight ?? '?';
  const descriptors = [];
  if (config.hasRoof) descriptors.push('mono-pitch roof');
  if (config.tarps?.length > 0) descriptors.push('tarps');
  const suffix = descriptors.length > 0 ? ` — ${descriptors.join(', ')}` : '';
  return `${totalWidth}m × ${totalDepth}m Layher scaffold @ ${height}m${suffix}`;
}

const EMPTY = {
  eventName: '', eventVenue: '', loadInDate: '', loadOutDate: '', loadInTime: '',
  loadInTbc: false, loadOutTbc: false, companyName: '', clientName: '', clientEmail: '', notes: '',
};

function QuoteModal({ bom, onClose, config }) {
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [showPresend, setShowPresend] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupQty, setGroupQty] = useState(1);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  function handleSendClick() {
    if (!f.eventName.trim() || !f.eventVenue.trim() || (!f.loadInDate && !f.loadInTbc) || !f.clientName.trim()) {
      setError('Event name, venue, load-in date and your name are required.');
      return;
    }
    if (f.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.clientEmail)) {
      setError('Invalid email address.');
      return;
    }
    setGroupName(buildAutoName(config));
    setGroupQty(1);
    setShowPresend(true);
  }

  function submit(grpName, grpQty) {
    const fmtD = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
    const inStr  = f.loadInTbc  ? 'TBC' : fmtD(f.loadInDate);
    const outStr = f.loadOutTbc ? 'TBC' : fmtD(f.loadOutDate);
    let eventDates = inStr;
    if (f.loadOutDate && f.loadOutDate !== f.loadInDate) eventDates = `${inStr} – ${outStr}`;
    else if (f.loadOutTbc) eventDates = `${inStr} – TBC`;

    const warnings = [];
    if (bom.gapFillers > 0)        warnings.push(`Note: ${bom.gapFillers} gap filler(s) required — price manually`);
    if (bom.removedLedgerCount > 0) warnings.push(`⚠ ${bom.removedLedgerCount} ledger(s) manually removed — verify structural adequacy`);
    if (bom.removedBraceCount > 0)  warnings.push(`⚠ ${bom.removedBraceCount} brace(s) manually removed — verify structural adequacy`);
    const topLiftGroups = {};
    for (const t of bom.unbracedTopLifts ?? []) {
      const key = `${t.span}|${t.liftHeight}`;
      if (!topLiftGroups[key]) topLiftGroups[key] = { ...t, count: 0, swivels: 0 };
      topLiftGroups[key].count += 1;
      topLiftGroups[key].swivels += t.swivels;
    }
    for (const g of Object.values(topLiftGroups)) {
      warnings.push(
        `Top lift bracing (rigger's discretion): ${g.count}× ${g.liftHeight}m lift on ${g.span}m bay${g.count > 1 ? 's' : ''} — no standard diagonal. Cut tube ≈${g.diagLen}m ×${g.count} + ${g.swivels} swivel clamps if required.`
      );
    }
    warnings.push('Base plate spec requires engineering confirmation per job.');
    const notes = [f.notes.trim(), ...warnings].filter(Boolean).join('\n');

    const payload = {
      eventName:   f.eventName.trim(),
      eventDates,
      dateStart:   f.loadInTbc  ? '' : f.loadInDate,
      dateEnd:     f.loadOutTbc ? '' : f.loadOutDate,
      eventVenue:  f.eventVenue.trim(),
      companyName: f.companyName.trim(),
      clientName:  f.clientName.trim(),
      clientEmail: f.clientEmail.trim(),
      notes,
      group: {
        id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: grpName,
        qty: grpQty,
      },
      items: buildQuoteItems(bom),
    };

    window.open(`${QUOTE_BUILDER_URL}/?data=${encodeURIComponent(JSON.stringify(payload))}`, '_blank');
    onClose();
  }

  return createPortal(
    <div className="qm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qm-modal">
        <h3 className="qm-title">Send to Quote Builder</h3>
        <p className="qm-sub">
          Fill in the event details. The scaffold BOM will be pre-loaded into the Raven quote builder.
        </p>

        {error && <div className="qm-error">{error}</div>}

        <div className="qm-field">
          <label>Event / Show Name *</label>
          <input type="text" value={f.eventName} onChange={e => set('eventName', e.target.value)}
            placeholder="e.g. Bradford Food Festival 2026" />
        </div>
        <div className="qm-field">
          <label>Venue / Location *</label>
          <input type="text" value={f.eventVenue} onChange={e => set('eventVenue', e.target.value)}
            placeholder="e.g. City Park, Bradford" />
        </div>

        <div className="qm-row">
          <div className="qm-field">
            <label>Load-in Date *</label>
            <input type="date" value={f.loadInDate} disabled={f.loadInTbc}
              onChange={e => set('loadInDate', e.target.value)} />
            <label className="qm-tbc">
              <input type="checkbox" checked={f.loadInTbc} onChange={e => set('loadInTbc', e.target.checked)} />
              TBC
            </label>
          </div>
          <div className="qm-field">
            <label>Load-out Date</label>
            <input type="date" value={f.loadOutDate} disabled={f.loadOutTbc}
              onChange={e => set('loadOutDate', e.target.value)} />
            <label className="qm-tbc">
              <input type="checkbox" checked={f.loadOutTbc} onChange={e => set('loadOutTbc', e.target.checked)} />
              TBC
            </label>
          </div>
        </div>

        <div className="qm-field">
          <label>Load-in Time</label>
          <input type="time" value={f.loadInTime} onChange={e => set('loadInTime', e.target.value)} />
        </div>
        <div className="qm-field">
          <label>Company / Organisation</label>
          <input type="text" value={f.companyName} onChange={e => set('companyName', e.target.value)}
            placeholder="e.g. Bradford Council" />
        </div>
        <div className="qm-field">
          <label>Your Name *</label>
          <input type="text" value={f.clientName} onChange={e => set('clientName', e.target.value)}
            placeholder="e.g. Jane Smith" />
        </div>
        <div className="qm-field">
          <label>Your Email (for reply-to)</label>
          <input type="email" value={f.clientEmail} onChange={e => set('clientEmail', e.target.value)}
            placeholder="e.g. jane@example.com" />
        </div>
        <div className="qm-field">
          <label>Additional Notes / Requirements</label>
          <textarea value={f.notes} onChange={e => set('notes', e.target.value)}
            placeholder="e.g. 3-phase power required, access from north gate..." />
        </div>

        {showPresend ? (
          <div className="qm-presend">
            <div className="qm-title">Confirm Structure Group</div>
            <p className="qm-sub">Check the auto-generated name and number of identical structures before sending.</p>
            <div className="qm-field">
              <label>Group / Structure Name</label>
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
            <div className="qm-field">
              <label>Quantity (identical structures)</label>
              <input type="number" min={1} value={groupQty}
                onChange={e => setGroupQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="qm-actions">
              <button className="sb-btn" onClick={() => setShowPresend(false)}>Back</button>
              <button className="sb-btn sb-btn--accent" onClick={() => submit(groupName, groupQty)}>
                Confirm & Send ✉
              </button>
            </div>
          </div>
        ) : (
          <div className="qm-actions">
            <button className="sb-btn" onClick={onClose}>Cancel</button>
            <button className="sb-btn sb-btn--accent" onClick={handleSendClick}>
              Send to Quote Builder ✉
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Path B modal: push layout to QB as a pending, job-tagged injection ────────
// Separate from QuoteModal (Path A, which opens QB pre-loaded). This POSTs to
// /api/planner-layouts so the layout sits pending against a job and can be
// assembled with others into one quote inside QB. Faithful mirror of litedeck's
// submitQbPush + #qb-push-modal.

function fmtRunningId(n) { return n == null ? '' : String(n).padStart(5, '0'); }

function PushModal({ bom, state, dispatch, config, onClose }) {
  const [name, setName] = useState(() => buildAutoName(config));
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [intent, setIntent] = useState('replace');
  const [status, setStatus] = useState(null);   // { type: 'error'|'success'|'sending', msg }
  const [sending, setSending] = useState(false);

  // Replace/Duplicate choice only applies once this layout already has a stage id.
  const hasStage = state.runningId != null;

  // Populate the job picker from QB's planner jobs-list endpoint on open.
  useEffect(() => {
    let alive = true;
    qbFetch('/api/planner-jobs')
      .then(list => { if (alive && Array.isArray(list)) setJobs(list); })
      .catch(e => {
        if (alive) setStatus({ type: 'error', msg: `Could not load jobs: ${e.message} You can still send as Unassigned.` });
      });
    return () => { alive = false; };
  }, []);

  async function submit() {
    if (!name.trim()) { setStatus({ type: 'error', msg: 'Layout name is required.' }); return; }

    // Components: buildQuoteItems(bom) as-is — deliberately NOT stripped to
    // {category,description,qty} like litedeck does. Scaffold emits items whose
    // description is not a PRICE_LIST key (e.g. "Ladder beam — 2.50m span" carries
    // priceName 'Ladder beam'); dropping priceName here would make them re-resolve
    // to £0 when injected into a quote. Extra fields are harmless to the receiver.
    let components;
    try {
      components = buildQuoteItems(bom);
    } catch (e) {
      setStatus({ type: 'error', msg: `Error building component list: ${e.message}` });
      return;
    }
    if (!components.length) { setStatus({ type: 'error', msg: 'No components to send.' }); return; }

    const sendIntent = hasStage ? intent : 'duplicate';
    // layoutState = scaffold's serialisable state (minus history), same shape
    // handleSave writes. Carries runningId; QB overwrites it with the final id.
    const { history, ...layoutState } = state;

    setSending(true);
    setStatus({ type: 'sending', msg: 'Sending layout…' });
    try {
      const d = await qbFetch('/api/planner-layouts', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          jobId: jobId || null,
          components,
          layoutState,
          intent: sendIntent,
          runningId: sendIntent === 'replace' ? state.runningId : null,
        }),
      });
      if (d && d.ok) {
        if (typeof d.runningId === 'number') dispatch({ type: 'SET_RUNNING_ID', value: d.runningId });
        const idTxt = typeof d.runningId === 'number' ? ` as stage ${fmtRunningId(d.runningId)}` : '';
        setStatus({ type: 'success', msg: `✅ Sent${idTxt}. Pending in the Quote Builder (${components.length} component lines).` });
      } else {
        setStatus({ type: 'error', msg: `Send failed: ${(d && d.error) || 'unknown error'}` });
      }
    } catch (e) {
      setStatus({ type: 'error', msg: `Send failed: ${e.message}` });
    }
    setSending(false);
  }

  const statusColor = status
    ? (status.type === 'error' ? '#e06666' : status.type === 'success' ? '#3fae6a' : '#c9a84c')
    : undefined;

  return createPortal(
    <div className="qm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qm-modal">
        <h3 className="qm-title">Send to Quote Builder — pending layout</h3>
        <p className="qm-sub">
          Pushes this layout to the quote builder as a pending injection. Multiple layouts can be
          sent against one job and later assembled into a single quote.
        </p>

        {status && (
          <div style={{
            marginTop: 10, marginBottom: 4, padding: '8px 10px', borderRadius: 6,
            fontSize: 13, color: statusColor, border: `1px solid ${statusColor}`,
          }}>{status.msg}</div>
        )}

        <div className="qm-field">
          <label>Layout Name *{hasStage ? ` (stage ${fmtRunningId(state.runningId)})` : ''}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Main stage — two tier 24x16" />
        </div>

        <div className="qm-field">
          <label>Assign to Job</label>
          <select value={jobId} onChange={e => setJobId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.name}{j.client ? ` — ${j.client}` : ''}{j.dateStart ? ` (${j.dateStart})` : ''}
              </option>
            ))}
          </select>
        </div>

        {hasStage && (
          <div className="qm-field">
            <label>This layout is stage {fmtRunningId(state.runningId)} — re-sending</label>
            <label className="qm-tbc">
              <input type="radio" name="qb-push-mode" value="replace"
                checked={intent === 'replace'} onChange={() => setIntent('replace')} />
              Replace this stage
            </label>
            <label className="qm-tbc">
              <input type="radio" name="qb-push-mode" value="duplicate"
                checked={intent === 'duplicate'} onChange={() => setIntent('duplicate')} />
              Save as new stage
            </label>
          </div>
        )}

        <div className="qm-actions">
          <button className="sb-btn" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="sb-btn sb-btn--accent" onClick={submit} disabled={sending}>
            {sending ? 'Sending…' : 'Send ⇪'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BomSection({ title, children }) {
  return (
    <div className="bom-section">
      <div className="bom-section-title">{title}</div>
      {children}
    </div>
  );
}

function BomRow({ label, qty, note }) {
  if (!qty) return null;
  return (
    <div className="bom-row">
      <span className="bom-label">{label}</span>
      <span className="bom-qty">× {qty}</span>
      {note && <span className="bom-row-note">{note}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BomPanel({ state, dispatch, isInternal, visible = true, showQuoteModal, onOpenQuote, onCloseQuote, showPushModal, onOpenPush, onClosePush }) {
  const bom = calculateBom(state);
  const hasDecking       = Object.keys(bom.deckPans).length > 0 || bom.gapFillers > 0;
  const hasBraces        = Object.keys(bom.braces).length > 0;
  const hasPlanBraces    = Object.keys(bom.planBraces).length > 0;

  return (
    <aside className={`bom-panel${visible ? '' : ' bom-panel--hidden'}`}>
      <div className="print-header">RAVEN STAGING — SCAFFOLD SCHEDULE</div>
      <div className="bom-header">BILL OF MATERIALS</div>

      <div className="bom-body">

        <BomSection title="Standards">
          {Object.entries(bom.standards)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([len, qty]) => (
              <BomRow key={len} label={`${len}m standard`} qty={qty} />
            ))}
        </BomSection>

        <BomSection title="Ledgers">
          {Object.entries(bom.ledgers)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([len, qty]) => (
              <BomRow key={len} label={`${len}m ledger`} qty={qty} />
            ))}
        </BomSection>

        <BomSection title="Braces">
          {Object.entries(bom.braces)
            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
            .map(([desc, qty]) => (
              <BomRow key={desc} label={desc} qty={qty} />
            ))}
          {Object.entries(bom.planBraces)
            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
            .map(([desc, qty]) => (
              <BomRow key={desc} label={desc} qty={qty} />
            ))}
          {!hasBraces && !hasPlanBraces && (
            <div className="bom-note">No bracing required</div>
          )}
          <div className="bom-note">Approximate — confirm final count with engineer</div>
        </BomSection>

        {(bom.removedLedgerCount > 0 || bom.removedBraceCount > 0 || bom.bracingConflicts?.length > 0) && (
          <BomSection title="Warnings">
            {bom.removedLedgerCount > 0 && (
              <div className="bom-note bom-note--warn">
                ⚠ {bom.removedLedgerCount} ledger{bom.removedLedgerCount !== 1 ? 's' : ''} manually removed — verify structural adequacy
              </div>
            )}
            {bom.removedBraceCount > 0 && (
              <div className="bom-note bom-note--warn">
                ⚠ {bom.removedBraceCount} brace{bom.removedBraceCount !== 1 ? 's' : ''} manually removed — verify structural adequacy
              </div>
            )}
            {bom.bracingConflicts?.map(c => (
              <div key={c.braceKey} className="bom-note bom-note--warn">
                ⚠ Brace conflict: {c.braceKey} ({c.panelType})
              </div>
            ))}
          </BomSection>
        )}

        <BomSection title="Base Plates">
          <BomRow label="Base plate" qty={bom.basePlates} />
          <div className="bom-note">Spec per engineering — confirm type on site survey</div>
        </BomSection>

        {hasDecking && (
          <BomSection title="Decking">
            {Object.entries(bom.deckPans)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([len, qty]) => (
                <BomRow key={len} label={`0.32m × ${len}m pan`} qty={qty} />
              ))}
            {bom.gapFillers > 0 && (
              <BomRow label="0.19m gap filler" qty={bom.gapFillers} />
            )}
          </BomSection>
        )}

        {bom.roofKitCount > 0 && (
          <BomSection title="Roof Kits">
            <BomRow label="Keder roof beam"    qty={bom.kederRoofBeamCount} />
            <BomRow label="Tarp tube"          qty={bom.tarpTubeCount} />
            <BomRow label="Keyclamp tube end"  qty={bom.keyclampTubeEndCount} />
            <BomRow label="Roof brace"         qty={bom.roofBraceCount} />
            <BomRow label="Roof tarp"          qty={bom.roofTarpCount} />
            <BomRow label="Apex tarp"          qty={bom.apexTarpCount} />
            <div className="bom-note">Shared central keder where bays are adjacent — verify on layout</div>
            {bom.undeckedRoofBays > 0 && (
              <div className="bom-note">
                ⚠ {bom.undeckedRoofBays} {bom.undeckedRoofBays === 1 ? 'bay has' : 'bays have'} no deck specified beneath
              </div>
            )}
          </BomSection>
        )}

        {(bom.tarpCount > 0 || bom.apexTarpCount > 0) && (
          <BomSection title="Tarps">
            <BomRow label="Side / door tarp (2.5m unit)" qty={bom.tarpCount} />
            <BomRow label="Apex tarp" qty={bom.apexTarpCount} />
          </BomSection>
        )}

        {(bom.ladderBeamSpans ?? []).length > 0 && (
          <BomSection title="Ladder Beams">
            {bom.ladderBeamSpans.map((b, i) => (
              <BomRow key={i} label={`Ladder beam — ${b.span}m span`} qty={1} />
            ))}
          </BomSection>
        )}

        {bom.windowCount > 0 && (
          <BomSection title="Windows">
            <BomRow label="Window (bespoke fab)" qty={bom.windowCount} />
          </BomSection>
        )}

        {(bom.bomExtras ?? []).length > 0 && (
          <BomSection title="Preset Extras">
            {bom.bomExtras.map((e, i) => (
              <BomRow key={i} label={e.description} qty={e.qty} />
            ))}
          </BomSection>
        )}

        <div className="bom-divider" />

        <div className="bom-flag">
          <span className="bom-flag-icon">⚠</span>
          <div>
            <strong>ACCESS</strong><br />
            Access requirements are bespoke. Contact Raven to discuss internal and external options.
          </div>
        </div>

        <div className="bom-flag">
          <span className="bom-flag-icon">⚠</span>
          <div>
            <strong>BALLAST &amp; ENGINEERING</strong><br />
            Ballast requirements depend on structure height, size, and site conditions. An independent engineer's report is strongly recommended and should be included in client budgets. Raven can source this on request at additional cost.
          </div>
        </div>

        <div className="bom-divider" />

        <div className="bom-actions">
          <button className="sb-btn" onClick={() => window.print()}>
            PRINT SCHEDULE
          </button>
          {isInternal && (
            <button className="sb-btn sb-btn--accent" onClick={onOpenQuote}>
              SEND TO QUOTE BUILDER ✉
            </button>
          )}
          {isInternal && (
            <button className="sb-btn" onClick={onOpenPush}>
              SEND AS PENDING LAYOUT ⇪
            </button>
          )}
        </div>

      </div>

      {isInternal && showQuoteModal && (
        <QuoteModal
          bom={bom}
          onClose={onCloseQuote}
          config={{
            gridCols: state.gridCols,
            bayLengths: state.bayLengths,
            gridRows: state.gridRows,
            bayWidth: state.bayWidth,
            structureHeight: state.structureHeight,
            hasRoof: state.roofBays?.length > 0,
            tarps: state.tarps,
          }}
        />
      )}

      {isInternal && showPushModal && (
        <PushModal
          bom={bom}
          state={state}
          dispatch={dispatch}
          onClose={onClosePush}
          config={{
            gridCols: state.gridCols,
            bayLengths: state.bayLengths,
            gridRows: state.gridRows,
            bayWidth: state.bayWidth,
            structureHeight: state.structureHeight,
            hasRoof: state.roofBays?.length > 0,
            tarps: state.tarps,
          }}
        />
      )}
    </aside>
  );
}
