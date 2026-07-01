import React, { useState } from 'react';
import { computeBallast } from '../utils/ballast';
import { CLADDING_OPTIONS, EXPOSURE_OPTIONS, BLOCK } from '../constants/ballast';

// Read-only "Ballast estimate" section for the BOM panel. Holds its own selector state
// (cladding gate + exposure band) in component-local React state — no store writes, no
// persistence. Renders an INDICATIVE tonnage + block breakdown; never a design figure.

const AMBER = '#f59e0b';
const GREEN = '#3fae6a';

export default function BallastEstimate({ state }) {
  // Seed the cladding gate from the canvas render mode as a convenience (read only).
  const [cladding, setCladding] = useState(() =>
    state.renderMode === 'clad' ? 'fully_clad' : 'skeleton');
  const [exposure, setExposure] = useState('sheltered_inland');

  const r = computeBallast(state, { cladding, exposure });
  const isSkeleton = r.lane === 'skeleton';
  const flagColor = r.confidence === 'green' ? GREEN : AMBER;

  const concreteLine = `${r.blocks.concrete} × ${BLOCK.CONCRETE_T}T concrete block${r.blocks.concrete === 1 ? '' : 's'}`;
  const blockLine = isSkeleton ? concreteLine : `${concreteLine} (tied down)`;

  return (
    <div className="bom-section">
      <div className="bom-section-title">Ballast estimate</div>

      {/* selectors */}
      <div className="bom-row" style={{ marginBottom: 6 }}>
        <span className="bom-label">Cladding</span>
        <select className="sb-select" value={cladding}
          onChange={e => setCladding(e.target.value)} style={{ width: 150 }}>
          {CLADDING_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <div className="bom-row" style={{ marginBottom: 8 }}>
        <span className="bom-label">Exposure</span>
        <select className="sb-select" value={exposure}
          onChange={e => setExposure(e.target.value)}
          disabled={isSkeleton}
          title={isSkeleton ? 'Not applied in the skeleton lane (fixed Layher “in the open” value)' : undefined}
          style={{ width: 150, opacity: isSkeleton ? 0.5 : 1 }}>
          {EXPOSURE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {/* headline figure */}
      {r.outOfTable ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: AMBER, margin: '4px 0' }}>
          No indicative figure — out of table
        </div>
      ) : (
        <div className="bom-row" style={{ marginTop: 2 }}>
          <span className="bom-label" style={{ fontWeight: 700 }}>
            Required ballast: {r.ballastKg} kg
          </span>
        </div>
      )}
      {!r.outOfTable && (
        <div className="bom-row" style={{ marginBottom: r.waterAlt != null ? 2 : 6 }}>
          <span className="bom-label" style={{ color: 'var(--gold)', fontWeight: 700 }}>
            {blockLine}
          </span>
        </div>
      )}
      {!r.outOfTable && r.waterAlt != null && (
        <div className="bom-row" style={{ marginBottom: 6 }}>
          <span className="bom-label" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            or {r.waterAlt} × {BLOCK.WATER_T}T water block{r.waterAlt === 1 ? '' : 's'} (permitted ≤ 4.25 m)
          </span>
        </div>
      )}

      {/* confidence flag */}
      <div style={{
        margin: '6px 0', padding: '6px 8px', borderRadius: 4,
        border: `1px solid ${flagColor}`, color: flagColor, fontSize: 11, lineHeight: 1.4,
      }}>
        <strong style={{ letterSpacing: '0.04em' }}>
          {r.confidence === 'green' ? '● ' : '▲ '}{r.flagLabel}
        </strong>
        <div style={{ marginTop: 2 }}>{r.flagWording}</div>
      </div>

      {/* lane + assumptions */}
      <div className="bom-note" style={{ fontStyle: 'normal' }}>
        Lane: {isSkeleton ? 'Skeleton — Layher table' : 'Clad — overturning method'}
      </div>
      <div className="bom-note">Assumptions: {r.assumptions}</div>

      {/* per-result notes */}
      {r.notes.map((n, i) => (
        <div key={i} className="bom-note bom-note--warn">{n}</div>
      ))}

      {/* disclaimer */}
      <div className="bom-note" style={{ marginTop: 8, fontStyle: 'italic' }}>
        {r.disclaimer}
      </div>
    </div>
  );
}
