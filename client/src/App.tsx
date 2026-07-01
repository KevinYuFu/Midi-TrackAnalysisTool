import { useMemo, useState } from 'react'
import {
  process,
  suggest,
  type AnalysisSettings,
  type Stem,
  type SuggestedSettings,
  type SweepMode,
  type Waveshape,
} from './api/client'
import { Knob } from './components/Knob'
import { Panel } from './components/Panel'
import { Selector } from './components/Selector'
import { SettingsPanel } from './components/SettingsPanel'
import { Toggle } from './components/Toggle'
import { WaveSelector } from './components/WaveSelector'
import { loadPreferences, savePreferences, type AppSettings } from './preferences'

const PERIODS = ['1/4', '1/8', '1/16', '1/32', '1'] // 1 = a full bar
const pct = (v: number) => `${Math.round(v * 100)}%`

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
        <div className="ctl">
          <label>Track</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          />
        </div>
        {busy && !settings && <p className="muted" style={{ marginBottom: 0 }}>Analyzing…</p>}
      </div>

      {settings && (
        <>
          <p className="muted hint">Purple label = auto-guessed — check those before converting.</p>

          <div className="rack">
            <Panel title="Source">
              <div className="ctl">
                <label>Stem</label>
                <Selector
                  value={settings.stem}
                  onChange={(v) => set({ stem: v as Stem })}
                  options={[
                    { value: 'bass', label: 'Bass' },
                    { value: 'other', label: 'Other' },
                    { value: 'vocals', label: 'Vocals' },
                    { value: 'drums', label: 'Drums' },
                  ]}
                />
              </div>
            </Panel>

            <Panel title="Sync">
              <Knob
                label="BPM"
                value={settings.bpm ?? 120}
                min={60}
                max={200}
                step={1}
                assumed={isAssumed('bpm')}
                onChange={(v) => set({ bpm: v })}
              />
              <Knob
                label="Downbeat"
                value={settings.downbeat_ms}
                min={0}
                max={2000}
                step={5}
                format={(v) => `${v} ms`}
                onChange={(v) => set({ downbeat_ms: v })}
              />
              <Knob
                label="Period"
                value={PERIODS.indexOf(settings.period)}
                min={0}
                max={PERIODS.length - 1}
                step={1}
                format={(v) => PERIODS[v] ?? '?'}
                assumed={isAssumed('period')}
                onChange={(v) => set({ period: PERIODS[v] })}
              />
            </Panel>

            <Panel title="Pitch">
              <div className={`ctl${isAssumed('key') ? ' assumed' : ''}`}>
                <label>Key</label>
                <input
                  value={settings.key ?? ''}
                  placeholder="e.g. A minor"
                  onChange={(e) => set({ key: e.target.value })}
                />
              </div>
              <div className={`ctl${isAssumed('waveshape') ? ' assumed' : ''}`}>
                <label>Waveshape</label>
                <WaveSelector
                  value={settings.waveshape}
                  onChange={(v) => set({ waveshape: v as Waveshape })}
                />
              </div>
              <div className="ctl">
                <label>Pitch sweeps</label>
                <Selector
                  value={settings.sweep_mode}
                  onChange={(v) => set({ sweep_mode: v as SweepMode })}
                  options={[
                    { value: 'snap', label: 'Snap' },
                    { value: 'start_end', label: 'Start+End' },
                    { value: 'mpe', label: 'MPE' },
                  ]}
                />
              </div>
            </Panel>

            <Panel title="Spectrum">
              <Knob
                label="Threshold"
                value={settings.threshold_db}
                min={-90}
                max={0}
                step={1}
                format={(v) => `${v} dB`}
                assumed={isAssumed('threshold_db')}
                onChange={(v) => set({ threshold_db: v })}
              />
              <Knob
                label="Harmonic cut"
                value={settings.harmonic_strength}
                min={0}
                max={1}
                step={0.01}
                format={pct}
                onChange={(v) => set({ harmonic_strength: v })}
              />
              <Knob
                label="Unison"
                value={settings.unison_cluster}
                min={0}
                max={1}
                step={0.01}
                format={pct}
                onChange={(v) => set({ unison_cluster: v })}
              />
            </Panel>

            <Panel title="Notes">
              <Knob
                label="Min length"
                value={settings.min_note_ms}
                min={0}
                max={500}
                step={5}
                format={(v) => `${v} ms`}
                onChange={(v) => set({ min_note_ms: v })}
              />
              <Knob
                label="Max poly"
                value={settings.max_polyphony}
                min={1}
                max={12}
                step={1}
                onChange={(v) => set({ max_polyphony: v })}
              />
              <div className="ctl inline">
                <label>Velocity from FFT</label>
                <Toggle
                  checked={settings.velocity_from_fft}
                  onChange={(v) => set({ velocity_from_fft: v })}
                />
              </div>
            </Panel>
          </div>

          <div className="actions">
            <button disabled={busy} onClick={onConvert}>
              {busy ? 'Converting…' : 'Convert to MIDI'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
