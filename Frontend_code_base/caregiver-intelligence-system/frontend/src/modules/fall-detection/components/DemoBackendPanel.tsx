// Trained-model output panel — shows every backend model's per-patient
// prediction in a single supervisor-glanceable view.
//
// Layout (top → bottom):
//   1. Header strip identifying the test sequence + dataset
//   2. Caption explaining what the panel shows
//   3. Four rows — one per trained model:
//        Random Forest baseline · Posture classifier · ST-GCN · Fusion (final)
//      Each row shows the model's three class probabilities, its predicted
//      class, and a "winner" highlight on the winning column.
//   4. Final outputs row: predicted risk, posture, ground truth ✓/✗
//
// All numbers come from /demo_data/manifest.json (real test-set output).

import { useState } from 'react'
import { useFallStore } from '../store/useFallStore'

interface Props { patientId: string }

interface ProbRow {
  modelLabel: string
  modelHint: string
  pLow: number | null
  pModerate: number | null
  pHigh: number | null
}

export function DemoBackendPanel({ patientId }: Props) {
  const manifest = useFallStore(s => s.demoManifest)
  const entry = manifest?.entries.find(e => e.patientId === patientId)
  const [whyOpen, setWhyOpen] = useState(false)
  if (!entry) return null

  const ok = entry.correct
  const okColor = ok ? '#10B981' : '#EF4444'
  const sourceColor = entry.source === 'UR' ? '#3B82F6' : '#8B5CF6'

  // Three rows correspond to the three risk-classification models. Posture
  // is a different problem (4-class pose) so it's shown separately below.
  const rows: ProbRow[] = [
    {
      modelLabel: 'Random Forest (baseline)',
      modelHint: 'Shallow model · 18 hand-crafted motion features · 87.48% test accuracy',
      pLow: entry.rfLow, pModerate: entry.rfModerate, pHigh: entry.rfHigh,
    },
    {
      modelLabel: 'ST-GCN (deep)',
      modelHint: 'Spatio-Temporal Graph CNN · 14-joint skeleton · 91.86% test accuracy',
      pLow: entry.stgcnLow, pModerate: entry.stgcnModerate, pHigh: entry.stgcnHigh,
    },
    {
      modelLabel: 'Fusion MLP (final)',
      modelHint: 'Combines RF + ST-GCN + features · 94.24% test accuracy · drives the dashboard',
      pLow: entry.pLow, pModerate: entry.pModerate, pHigh: entry.pHigh,
    },
  ]

  return (
    <div style={{
      background: '#0F172A', borderRadius: 16, padding: '16px 20px',
      border: '1px solid #1E293B', marginBottom: 14, color: '#E5E7EB',
    }}>
      {/* Header strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 900, letterSpacing: '0.12em',
            color: '#14B8A6', textTransform: 'uppercase',
          }}>● Trained-Model Output</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Test sequence&nbsp;
            <code style={{
              color: '#E2E8F0', background: '#1E293B', padding: '2px 7px',
              borderRadius: 5, fontSize: 12,
            }}>{entry.sequenceId}</code>
          </span>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          color: sourceColor, background: `${sourceColor}15`, border: `1px solid ${sourceColor}30`,
        }}>
          {entry.modality}
        </span>
      </div>

      {/* Caption */}
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 14, lineHeight: 1.5 }}>
        Each row below is one trained model's prediction for this patient's held-out test sequence.
        The Fusion model's verdict is what the dashboard card displays.
      </div>

      {/* Three probability rows — RF / ST-GCN / Fusion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <ProbabilityRow key={r.modelLabel} row={r} />
        ))}
      </div>

      {/* Final-outputs summary */}
      <div style={{
        marginTop: 14, padding: '12px 14px', borderRadius: 12,
        background: '#1E293B', display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
      }}>
        <SummaryCell
          label="Final Risk"
          value={entry.riskLevel}
          hint="Fusion model · highest class above"
          valueColor={
            entry.riskLevel === 'High Risk' ? '#EF4444' :
            entry.riskLevel === 'Moderate Risk' ? '#F59E0B' : '#14B8A6'
          }
        />
        <SummaryCell
          label="Posture"
          value={`${entry.posture} · ${Math.round(entry.posturePrior * 100)}%`}
          hint="Posture model · 4-class · 99.78% test acc"
          valueColor="#3B82F6"
        />
        <div title={ok ? 'Prediction matches the dataset label' : 'Prediction differs — honest miss'}
             style={{ cursor: 'help' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: 4 }}>
            DATASET · GROUND TRUTH
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800,
            color: okColor, fontSize: 16,
          }}>
            {entry.groundTruth}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%', background: `${okColor}25`,
              color: okColor, fontSize: 13, fontWeight: 900,
            }}>{ok ? '✓' : '✗'}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
            {ok ? 'Prediction matches' : 'Honest classification error'}
          </div>
        </div>
      </div>

      {/* ── Why this prediction? — click to expand per-patient justification ── */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setWhyOpen(o => !o)}
          style={{
            width: '100%', textAlign: 'left',
            background: whyOpen ? '#1E293B' : '#172033',
            border: '1px solid #1E293B', borderRadius: 10,
            padding: '10px 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#E5E7EB', fontWeight: 700, fontSize: 14,
          }}
        >
          <span>
            <span style={{ color: '#14B8A6', marginRight: 8 }}>Why this prediction?</span>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
              click to see the per-patient justification
            </span>
          </span>
          <span style={{ color: '#94A3B8', fontSize: 16 }}>{whyOpen ? '▴' : '▾'}</span>
        </button>

        {whyOpen && (
          <div style={{
            background: '#0B1220', border: '1px solid #1E293B', borderTop: 'none',
            borderRadius: '0 0 10px 10px', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: 4 }}>
              SOURCE · ACTION ANNOTATION
            </div>
            <div style={{ fontSize: 13, color: '#E5E7EB', fontWeight: 600, marginBottom: 12 }}>
              {entry.actionDescription || '—'}
            </div>

            <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: 4 }}>
              WHY THE MODEL CLASSIFIED IT THIS WAY
            </div>
            <div style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.55, marginBottom: 14 }}>
              {entry.justification}
            </div>

            {entry.features && (
              <>
                <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: 6 }}>
                  KEY MOTION FEATURES (the model's evidence)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <FeatureChip label="Vertical drop"           value={entry.features.vertical_drop.toFixed(2)}            hint="Hip-Y drop over the clip" />
                  <FeatureChip label="Sudden vert. change"     value={entry.features.sudden_vertical_change.toFixed(2)}   hint="Fast downward movement spike" />
                  <FeatureChip label="Torso tilt (max)"        value={`${entry.features.torso_angle_max.toFixed(0)}°`}    hint="Largest body lean during the clip" />
                  <FeatureChip label="Instability score"       value={entry.features.instability_score.toFixed(2)}        hint="Centre-of-mass deviation over time" />
                  <FeatureChip label="Joint speed (max)"       value={entry.features.max_joint_speed.toFixed(2)}          hint="Fastest single-joint motion" />
                  <FeatureChip label="Joint speed (mean)"      value={entry.features.mean_joint_speed.toFixed(2)}         hint="Average motion across all joints" />
                  <FeatureChip label="Torso tilt (mean)"       value={`${entry.features.torso_angle_mean.toFixed(0)}°`}   hint="Average body lean" />
                  <FeatureChip label="Center speed (max)"      value={entry.features.center_speed_max.toFixed(2)}         hint="Fastest centre-of-mass speed" />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureChip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div title={hint} style={{
      cursor: 'help', background: '#1E293B', borderRadius: 8, padding: '8px 10px',
      borderLeft: '3px solid #14B8A6',
    }}>
      <div style={{ fontSize: 10, color: '#94A3B8', letterSpacing: '0.04em' }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#E2E8F0', marginTop: 2 }}>{value}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
function ProbabilityRow({ row }: { row: ProbRow }) {
  const have = row.pLow != null && row.pModerate != null && row.pHigh != null
  if (!have) return null

  const cells = [
    { label: 'Low Risk',      v: row.pLow!,      color: '#14B8A6' },
    { label: 'Moderate Risk', v: row.pModerate!, color: '#F59E0B' },
    { label: 'High Risk',     v: row.pHigh!,     color: '#EF4444' },
  ]
  const winnerIdx = cells.indexOf(cells.reduce((a, b) => (a.v >= b.v ? a : b)))

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '210px 1fr 1fr 1fr', gap: 8,
      alignItems: 'center',
    }}>
      <div title={row.modelHint} style={{ cursor: 'help' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#E5E7EB' }}>{row.modelLabel}</div>
        <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>hover for details</div>
      </div>
      {cells.map((c, i) => {
        const winning = i === winnerIdx
        return (
          <div key={c.label} title={`${row.modelLabel} thinks there is a ${(c.v * 100).toFixed(1)}% chance this patient is ${c.label}`}
               style={{
                 cursor: 'help',
                 background: winning ? `${c.color}22` : '#1E293B',
                 border: `1px solid ${winning ? c.color + '50' : '#27324A'}`,
                 borderLeft: `4px solid ${c.color}`,
                 padding: '10px 14px', borderRadius: 10,
               }}>
            <div style={{
              fontSize: 11, color: winning ? c.color : '#94A3B8',
              fontWeight: winning ? 800 : 500, letterSpacing: '0.04em',
            }}>
              {c.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: 22, fontWeight: 900, color: c.color, lineHeight: 1.1,
              }}>{(c.v * 100).toFixed(1)}</span>
              <span style={{ fontSize: 13, color: c.color, fontWeight: 700 }}>%</span>
              {winning && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 800,
                  color: c.color, letterSpacing: '0.08em',
                }}>← PICK</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
function SummaryCell({ label, value, hint, valueColor }: {
  label: string; value: string; hint: string; valueColor: string
}) {
  return (
    <div title={hint} style={{ cursor: 'help' }}>
      <div style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, lineHeight: 1.3 }}>{hint}</div>
    </div>
  )
}
