import { Globe2, Wand2, BellRing, FileDown, Palette, Mic, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { useVoiceLogUI } from '../components/VoiceLogLayout'

export function SettingsPage() {
  const { design, setDesign } = useVoiceLogUI()

  const [lang, setLang] = useState('en-US')
  const [tts, setTts] = useState(true)
  const [autoSummary, setAutoSummary] = useState(true)
  const [autoADL, setAutoADL] = useState(true)
  const [autoAlerts, setAutoAlerts] = useState(true)
  const [alertThreshold, setAlertThreshold] = useState('Medium')
  const [exportMode, setExportMode] = useState('PDF + CSV')
  const [themeMode, setThemeMode] = useState('Light')

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Settings</div>
          <div className="mt-1 text-sm vl-subtle">Voice, automation, exports, and UI preferences.</div>
        </div>
        <Button className="vl-btn" variant="primary" size="sm" onClick={() => window.alert('Mock: Save settings')}>
          Save changes
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="vl-card">
          <div className="vl-cardHeader">
            <div className="flex items-center gap-2">
              <Palette size={16} color="rgba(15,23,42,0.55)" />
              <div>
                <div className="vl-cardTitle">Design Mode</div>
                <div className="text-xs vl-subtle">Preview 3 variations from your prototype</div>
              </div>
            </div>
            <StatusBadge label={design} tone="info" />
          </div>
          <div className="vl-cardBody">
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-semibold text-[rgba(15,23,42,0.70)]">
                Mode
                <select
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                  style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                  value={design}
                  onChange={(e) => setDesign(e.target.value as never)}
                >
                  <option value="classic">Classic Clinical</option>
                  <option value="soft">Modern Soft Gradient</option>
                  <option value="compact">Compact Admin</option>
                </select>
              </label>
              <div className="grid gap-2 text-sm">
                <div className="rounded-2xl border bg-white p-3" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                  <div className="font-extrabold tracking-tight">Classic Clinical</div>
                  <div className="mt-1 text-xs vl-subtle">White cards, minimal shadows, very clean.</div>
                </div>
                <div className="rounded-2xl border bg-white p-3" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                  <div className="font-extrabold tracking-tight">Modern Soft Gradient</div>
                  <div className="mt-1 text-xs vl-subtle">Soft gradients, glass-like surfaces, richer accents.</div>
                </div>
                <div className="rounded-2xl border bg-white p-3" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                  <div className="font-extrabold tracking-tight">Compact Admin</div>
                  <div className="mt-1 text-xs vl-subtle">Denser layout for staff/admin workflows.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="vl-card">
          <div className="vl-cardHeader">
            <div className="flex items-center gap-2">
              <Mic size={16} color="rgba(15,23,42,0.55)" />
              <div>
                <div className="vl-cardTitle">Voice</div>
                <div className="text-xs vl-subtle">Speech-to-text + TTS controls (mock)</div>
              </div>
            </div>
            <StatusBadge label={tts ? 'TTS On' : 'TTS Off'} tone={tts ? 'good' : 'neutral'} />
          </div>
          <div className="vl-cardBody">
            <div className="grid gap-3">
              <RowToggle icon={<Globe2 size={16} />} label="Voice language">
                <select
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                  style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="si-LK">Sinhala (LK)</option>
                  <option value="ta-LK">Tamil (LK)</option>
                </select>
              </RowToggle>
              <RowToggle icon={<Wand2 size={16} />} label="TTS enabled">
                <Toggle checked={tts} onChange={setTts} />
              </RowToggle>
            </div>
          </div>
        </div>

        <div className="vl-card">
          <div className="vl-cardHeader">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} color="rgba(15,23,42,0.55)" />
              <div>
                <div className="vl-cardTitle">Automation</div>
                <div className="text-xs vl-subtle">Extraction, alerts, summaries, reviews</div>
              </div>
            </div>
            <span className="vl-chip">Mock</span>
          </div>
          <div className="vl-cardBody">
            <div className="grid gap-3">
              <RowToggle icon={<Wand2 size={16} />} label="Auto ADL extraction">
                <Toggle checked={autoADL} onChange={setAutoADL} />
              </RowToggle>
              <RowToggle icon={<BellRing size={16} />} label="Auto alert detection">
                <Toggle checked={autoAlerts} onChange={setAutoAlerts} />
              </RowToggle>
              <RowToggle icon={<Wand2 size={16} />} label="Auto handover summary generation">
                <Toggle checked={autoSummary} onChange={setAutoSummary} />
              </RowToggle>
              <RowToggle icon={<BellRing size={16} />} label="Alert thresholds">
                <select
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                  style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </RowToggle>
            </div>
          </div>
        </div>

        <div className="vl-card">
          <div className="vl-cardHeader">
            <div className="flex items-center gap-2">
              <FileDown size={16} color="rgba(15,23,42,0.55)" />
              <div>
                <div className="vl-cardTitle">Export</div>
                <div className="text-xs vl-subtle">Downloads for reports + summaries</div>
              </div>
            </div>
            <StatusBadge label={exportMode} tone="info" />
          </div>
          <div className="vl-cardBody">
            <div className="grid gap-3">
              <RowToggle icon={<FileDown size={16} />} label="Export settings">
                <select
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                  style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                  value={exportMode}
                  onChange={(e) => setExportMode(e.target.value)}
                >
                  <option>PDF + CSV</option>
                  <option>PDF only</option>
                  <option>CSV only</option>
                  <option>Summary TXT + Audio</option>
                </select>
              </RowToggle>
              <RowToggle icon={<Palette size={16} />} label="Theme mode">
                <select
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-semibold outline-none"
                  style={{ borderColor: 'rgba(15,23,42,0.10)' }}
                  value={themeMode}
                  onChange={(e) => setThemeMode(e.target.value)}
                >
                  <option>Light</option>
                  <option>System (mock)</option>
                </select>
              </RowToggle>
              <div className="rounded-2xl border bg-white p-3 text-xs vl-subtle" style={{ borderColor: 'rgba(15,23,42,0.10)' }}>
                Next: map exports to backend-generated PDFs and signed URLs for audio.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RowToggle({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-3.5 py-3 transition-all"
      style={{ borderColor: 'rgba(15,23,42,0.09)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 place-items-center rounded-xl border"
          style={{
            borderColor: 'rgba(124,58,237,0.15)',
            background: 'linear-gradient(135deg,rgba(124,58,237,0.10),rgba(30,58,138,0.07))',
            color: '#7C3AED',
          }}
        >
          {icon}
        </span>
        <span className="text-[13px] font-semibold" style={{ color: 'rgba(15,23,42,0.82)' }}>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-8 w-[54px] rounded-full border transition-all duration-200"
      style={{
        borderColor: checked ? 'rgba(124,58,237,0.30)' : 'rgba(15,23,42,0.12)',
        background: checked
          ? 'linear-gradient(135deg,rgba(124,58,237,0.18),rgba(30,58,138,0.14))'
          : 'rgba(15,23,42,0.05)',
      }}
      aria-pressed={checked}
    >
      <span
        className="absolute top-0.5 h-7 w-7 rounded-full transition-all duration-200"
        style={{
          left: checked ? 24 : 3,
          background: checked ? 'linear-gradient(135deg,#7C3AED,#1E3A8A)' : 'rgba(15,23,42,0.28)',
          boxShadow: checked ? '0 4px 12px rgba(124,58,237,0.35)' : '0 2px 6px rgba(15,23,42,0.10)',
        }}
      />
    </button>
  )
}

