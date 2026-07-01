import { useMemo, useState } from 'react'
import { process, suggest, type AnalysisSettings, type SuggestedSettings } from './api/client'
import { Knob } from './components/Knob'
import { SettingsPanel } from './components/SettingsPanel'
import { loadPreferences, savePreferences, type AppSettings } from './preferences'

const PERIODS = ['1/4', '1/8', '1/16', '1/32', '1'] // 1 = a full bar
const WAVES = ['sine', 'triangle', 'saw', 'square'] as const

export default function App() {
  const [prefs, setPrefs] = useState<AppSettings>(loadPreferences)
  const [showPrefs, setShowPrefs] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [suggestion, setSuggestion] = useState<SuggestedSettings | null>(null)
  const [settings, setSettings] = useState<AnalysisSettings | null>(null)
  const [busy, setBusy] = useState(false)

  const assumed = useMemo(() => new Set(suggestion?.assumed_fields ?? []), [suggestion])
  const isAssumed = (f: string) => assumed.has(f)

  function updatePrefs(next: AppSettings) {
    setPrefs(next)
    savePreferences(next)
  }

  async function onPick(f: File) {
    setFile(f)
    setBusy(true)
    try {
      const s = await suggest(f)
      // Fold in the user's global defaults where the popup shows them.
      s.settings.separation_model = prefs.defaultModel
      s.settings.waveshape = prefs.defaultWaveshape
      s.settings.threshold_db = prefs.defaultThresholdDb
      setSuggestion(s)
      setSettings(s.settings)
    } finally {
      setBusy(false)
    }
  }

  async function onConvert() {
    if (!file || !settings) return
    setBusy(true)
    try {
      const blob = await process(file, settings)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'output.mid'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Partial<AnalysisSettings>) =>
    setSettings((s) => (s ? { ...s, ...patch } : s))

  return (
    <div className="app">
      <div className="topbar">
        <span className="brand">audio → midi</span>
        <button className="ghost" onClick={() => setShowPrefs((v) => !v)}>
          ⚙ Preferences
        </button>
      </div>

      {showPrefs && (
        <SettingsPanel prefs={prefs} onChange={updatePrefs} onClose={() => setShowPrefs(false)} />
      )}

      <div className="card">
        <div className="field">
          <label>Track</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          />
        </div>
        {busy && !settings && <p className="muted">Analyzing…</p>}
      </div>

      {settings && (
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Purple = auto-guessed. Check these before converting.
          </p>

          <div className="row">
            <div className={`field ${isAssumed('key') ? 'assumed' : ''}`}>
              <label>Key</label>
              <input
                value={settings.key ?? ''}
                placeholder="e.g. A minor"
                onChange={(e) => set({ key: e.target.value })}
              />
            </div>
            <div className={`field ${isAssumed('bpm') ? 'assumed' : ''}`}>
              <label>BPM</label>
              <input
                type="number"
                value={settings.bpm ?? ''}
                onChange={(e) => set({ bpm: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div className="field">
              <label>Waveshape</label>
              <select
                value={settings.waveshape}
                onChange={(e) => set({ waveshape: e.target.value as AnalysisSettings['waveshape'] })}
              >
                {WAVES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="knobs">
            <Knob
              label="Period"
              value={PERIODS.indexOf(settings.period)}
              min={0}
              max={PERIODS.length - 1}
              step={1}
              format={(v) => PERIODS[v] ?? '?'}
              onChange={(v) => set({ period: PERIODS[v] })}
            />
            <Knob
              label="Threshold"
              value={settings.threshold_db}
              min={-90}
              max={0}
              step={1}
              format={(v) => `${v} dB`}
              onChange={(v) => set({ threshold_db: v })}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <button disabled={busy} onClick={onConvert}>
              {busy ? 'Converting…' : 'Convert to MIDI'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
