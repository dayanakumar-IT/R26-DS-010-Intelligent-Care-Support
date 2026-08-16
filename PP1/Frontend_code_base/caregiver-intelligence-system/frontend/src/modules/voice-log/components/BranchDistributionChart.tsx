import type { Branch } from '../data/mockCareData'

export function BranchDistributionChart({
  femaleCount,
  maleCount,
  selectedBranch,
}: {
  femaleCount: number
  maleCount: number
  selectedBranch: Branch
}) {
  const totalRaw = femaleCount + maleCount
  const total = Math.max(1, totalRaw)
  const femalePct = Math.round((femaleCount / total) * 100)
  const malePct = totalRaw === 0 ? 0 : Math.max(0, 100 - femalePct)

  const active = selectedBranch === 'All Branches' ? 'All' : selectedBranch

  // Use explicit hex values — CSS vars don't always resolve inside conic-gradient
  const femaleHex = '#7C3AED'   // brand purple
  const maleHex   = '#1E3A8A'   // brand blue
  const nullColor = '#E2E8F0'   // placeholder when one branch is 0

  const donutBg = totalRaw === 0
    ? nullColor
    : `conic-gradient(${femaleHex} 0 ${femalePct}%, ${maleHex} ${femalePct}% 100%)`

  return (
    <div className="vl-dashCard">
      <div className="vl-dashCardHeader">
        <div>
          <div className="vl-dashTitle">Branch Distribution</div>
          <div className="vl-dashSubtle">Female vs Male branch totals</div>
        </div>
        <span className="vl-chip">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7C3AED,#1E3A8A)' }}
          />
          {active} Branch
        </span>
      </div>
      <div className="vl-dashCardBody">
        <div className="vl-branchDist">
          <div
            role="img"
            aria-label={`Donut chart: ${femalePct}% Female, ${malePct}% Male`}
            className="relative grid place-items-center rounded-full"
            style={{
              width: 160,
              height: 160,
              background: donutBg,
              boxShadow: '0 8px 28px rgba(124,58,237,0.20)',
              transition: 'background 400ms ease',
            }}
          >
            <div
              className="grid place-items-center rounded-full"
              style={{
                width: 108,
                height: 108,
                background: '#ffffff',
                boxShadow: 'inset 0 2px 8px rgba(15,23,42,0.06)',
              }}
            >
              <div className="text-center">
                <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--vl-muted)' }}>Total</div>
                <div className="text-2xl font-extrabold" style={{ color: 'var(--vl-text)' }}>{femaleCount + maleCount}</div>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="grid gap-3">
              <LegendRow
                color={femaleHex}
                label="Female Branch"
                value={`${femaleCount} (${femalePct}%)`}
              />
              <LegendRow
                color={maleHex}
                label="Male Branch"
                value={`${maleCount} (${malePct}%)`}
              />
              <div className="vl-divider" />
              <div className="text-xs font-medium text-[#64748B]">
                Percentages update with the branch selector.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold text-[rgba(15,23,42,0.82)]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[rgba(15,23,42,0.70)]">{value}</span>
    </div>
  )
}

