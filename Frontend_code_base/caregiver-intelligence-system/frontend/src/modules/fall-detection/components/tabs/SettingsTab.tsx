import { useState } from 'react'

interface ToggleProps { checked: boolean; onChange: () => void; color?: string }
function Toggle({ checked, onChange, color = '#2563EB' }: ToggleProps) {
  return (
    <div onClick={onChange} style={{ width: 42, height: 24, borderRadius: 12, background: checked ? color : '#D1D5DB', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
    </div>
  )
}

interface SliderProps { value: number; min: number; max: number; color?: string; onChange: (v: number) => void }
function Slider({ value, min, max, color = '#2563EB', onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input type="range" min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', height: 4, appearance: 'none', background: `linear-gradient(to right, ${color} ${pct}%, #E5E7EB ${pct}%)`, borderRadius: 2, cursor: 'pointer', outline: 'none' }} />
  )
}

export function SettingsTab() {
  const [notifs, setNotifs] = useState({ highRisk: true, moderateRisk: true, lowRisk: false, email: true, sound: true, desktop: true })
  const [cam, setCam] = useState('USB Camera 01')
  const [fps, setFps] = useState(25)
  const [thresholds, setThresholds] = useState({ low: 40, moderate: 70 })
  const [autoDelete, setAutoDelete] = useState(true)
  const [retention, setRetention] = useState(30)
  const [name, setName] = useState('Supervisor')
  const [email, setEmail] = useState('supervisor@hospital.com')
  const [role] = useState('Supervisor')
  const [saved, setSaved] = useState(false)
  const [pwChange, setPwChange] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const toggle = (key: keyof typeof notifs) => setNotifs(n => ({ ...n, [key]: !n[key] }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      {/* User Settings */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>👤</span> User Settings
        </div>
        {[
          { label: 'Name',  value: name,  setValue: setName  as ((v: string) => void) | undefined, type: 'text'  },
          { label: 'Email', value: email, setValue: setEmail as ((v: string) => void) | undefined, type: 'email' },
          { label: 'Role',  value: role,  setValue: undefined, type: 'text' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{f.label}</div>
            {f.setValue ? (
              <input type={f.type} value={f.value} onChange={e => f.setValue!(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #E5E7EB', fontSize: 13, color: '#111827', background: '#F9FAFB', outline: 'none', boxSizing: 'border-box' }} />
            ) : (
              <div style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #E5E7EB', fontSize: 13, color: '#6B7280', background: '#F3F4F6', opacity: 0.9 }}>{f.value}</div>
            )}
          </div>
        ))}
        {!pwChange ? (
          <button onClick={() => setPwChange(true)}
            style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
            🔑 Change Password
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="password" placeholder="Current password"
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #E5E7EB', fontSize: 13, color: '#111827', background: '#F9FAFB', outline: 'none' }} />
            <input type="password" placeholder="New password"
              style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #E5E7EB', fontSize: 13, color: '#111827', background: '#F9FAFB', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPwChange(false)}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#2563EB', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>Update</button>
              <button onClick={() => setPwChange(false)}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Settings */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔔</span> Notification Settings
        </div>
        {[
          { key: 'highRisk',     label: 'High Risk Alerts',      desc: 'Immediate alerts for high-risk patients', color: '#EF4444' },
          { key: 'moderateRisk', label: 'Moderate Risk Alerts',  desc: 'Warnings for moderate risk events',        color: '#F59E0B' },
          { key: 'lowRisk',      label: 'Low Risk Alerts',       desc: 'Informational low-risk notifications',     color: '#14B8A6' },
          { key: 'email',        label: 'Email Notifications',   desc: 'Send alerts to registered email',          color: '#2563EB' },
          { key: 'sound',        label: 'Sound Alerts',          desc: 'Play audio when alerts trigger',           color: '#7C3AED' },
          { key: 'desktop',      label: 'Desktop Notifications', desc: 'Browser push notifications',              color: '#1E3A8A' },
        ].map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{item.desc}</div>
            </div>
            <Toggle checked={notifs[item.key as keyof typeof notifs]} onChange={() => toggle(item.key as keyof typeof notifs)} color={item.color} />
          </div>
        ))}
      </div>

      {/* System Settings */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚙️</span> System Settings
        </div>
        {/* Camera Source */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Camera Source</div>
          <select value={cam} onChange={e => setCam(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #E5E7EB', fontSize: 13, color: '#111827', background: '#F9FAFB', cursor: 'pointer', outline: 'none' }}>
            {['USB Camera 01', 'USB Camera 02', 'IP Camera 01', 'IP Camera 02'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        {/* FPS */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            <span>Refresh Rate</span>
            <span style={{ color: '#2563EB', fontWeight: 800 }}>{fps} FPS</span>
          </div>
          <Slider value={fps} min={10} max={60} onChange={setFps} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280', marginTop: 4 }}>
            <span>10 FPS</span><span>30 FPS</span><span>60 FPS</span>
          </div>
        </div>
        {/* Risk Thresholds */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Risk Thresholds</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#374151', marginBottom: 4 }}>
                <span>Low Risk</span>
                <span style={{ fontWeight: 700, color: '#14B8A6' }}>0 – {thresholds.low}</span>
              </div>
              <Slider value={thresholds.low} min={10} max={60} color="#14B8A6" onChange={v => setThresholds(t => ({ ...t, low: Math.min(v, t.moderate - 5) }))} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#374151', marginBottom: 4 }}>
                <span>Moderate Risk</span>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>{thresholds.low + 1} – {thresholds.moderate}</span>
              </div>
              <Slider value={thresholds.moderate} min={50} max={90} color="#F59E0B" onChange={v => setThresholds(t => ({ ...t, moderate: Math.max(v, t.low + 5) }))} />
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#374151' }}>
                <span>High Risk</span>
                <span style={{ fontWeight: 700, color: '#EF4444' }}>{thresholds.moderate + 1} – 100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔒</span> Data & Privacy
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Auto Delete Old Data</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>Automatically delete recordings beyond retention period</div>
          </div>
          <Toggle checked={autoDelete} onChange={() => setAutoDelete(v => !v)} />
        </div>
        <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
            <span>Retention Period</span>
            <span style={{ color: '#2563EB', fontWeight: 800 }}>{retention} Days</span>
          </div>
          <Slider value={retention} min={7} max={180} onChange={setRetention} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280', marginTop: 4 }}>
            <span>7 days</span><span>90 days</span><span>180 days</span>
          </div>
        </div>
        <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Storage used: <b style={{ color: '#111827' }}>12.4 GB</b> of 50 GB</div>
          <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '24.8%', background: '#1E3A8A', borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ paddingTop: 14, display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid rgba(30,58,138,0.3)', background: 'rgba(30,58,138,0.08)', color: '#1E3A8A', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
            ⬇ Export Data
          </button>
          <button style={{ flex: 1, padding: '9px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
            🗑 Clear Cache
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Reset to Defaults
        </button>
        <button onClick={handleSave}
          style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: saved ? '#14B8A6' : 'linear-gradient(135deg,#1E3A8A,#2563EB)', color: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 800, transition: 'all 0.2s' }}>
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
