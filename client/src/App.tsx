import { useMemo, useRef, useState } from 'react'
import {
  process,
  suggest,
  type AnalysisSettings,
  type SuggestedSettings,
  type Waveshape,
} from './api/client'
import { DragNumber } from './components/DragNumber'
import { Dropdown } from './components/Dropdown'
import { Knob } from './components/Knob'
import { SettingsPanel } from './components/SettingsPanel'
import { WaveSelector } from './components/WaveSelector'
import { Waveform } from './components/Waveform'
import { loadPreferences, savePreferences, type AppSettings } from './preferences'

const PERIODS = ['1', '1/2', '1/4', '1/8', '1/16', '1/32'] // 1 = a full bar
const SCALES = ['Major', 'Minor', 'Dorian', 'Phrygian']
const ROOTS = [
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C#/Db' },
  { value: 'D', label: 'D' },
  { value: 'D#', label: 'D#/Eb' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'F#', label: 'F#/Gb' },
  { value: 'G', label: 'G' },
  { value: 'G#', label: 'G#/Ab' },
  { value: 'A', label: 'A' },
  { value: 'A#', label: 'A#/Bb' },
  { value: 'B', label: 'B' },
]

// Starting values so the controls are visible before any track loads.
function defaultSettings(p: AppSettings): AnalysisSettings {
  return {
    root: 'C',
    scale: 'Minor',
    bpm: 120,
    downbeat_ms: 0,
    period: '1/16',
    waveshape: 'saw',
    sweep_mode: p.sweepMode,
    separation_model: p.separationModel,
    threshold_db: p.thresholdDb,
    harmonic_strength: p.harmonicStrength,
    velocity_from_fft: p.velocityFromFft,
  }
}

export default function App() {
  const [prefs, setPrefs] = useState<AppSettings>(loadPreferences)
  const [showPrefs, setShowPrefs] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [suggestion, setSuggestion] = useState<SuggestedSettings | null>(null)
  const [settings, setSettings] = useState<AnalysisSettings>(() => defaultSettings(prefs))
  const [analyzing, setAnalyzing] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const assumed = useMemo(() => new Set(suggestion?.assumed_fields ?? []), [suggestion])
  const isAssumed = (f: string) => assumed.has(f)

  function updatePrefs(next: AppSettings) {
    setPrefs(next)
    savePreferences(next)
  }

  async function onPick(f: File) {
    setFile(f)
    setAnalyzing(true)
    try {
      const s = await suggest(f)
      setSuggestion(s)
      setSettings(s.settings)
    } finally {
      setAnalyzing(false)
    }
  }

  async function onConvert() {
    if (!file) return
    setBusy(true)
    try {
      // Spectral params live in Preferences — merge them into the payload.
      const payload: AnalysisSettings = {
        ...settings,
        separation_model: prefs.separationModel,
        threshold_db: prefs.thresholdDb,
        harmonic_strength: prefs.harmonicStrength,
        velocity_from_fft: prefs.velocityFromFft,
        sweep_mode: prefs.sweepMode,
      }
      const blob = await process(file, payload)
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

  const set = (patch: Partial<AnalysisSettings>) => setSettings((s) => ({ ...s, ...patch }))

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
        <button type="button" className="track-loader" onClick={() => fileRef.current?.click()}>
          <span className={`track-name${file ? '' : ' empty'}`}>
            {file ? file.name : 'Load a track'}
          </span>
          <span className="track-cta">{file ? 'Change' : 'Browse'}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
        />

        <Waveform
          file={file}
          bpm={settings.bpm ?? 120}
          onDownbeatChange={(ms) => set({ downbeat_ms: ms })}
        />

        <div className="divider" />

        <div className="module-body">
          <div className={`ctl${isAssumed('bpm') ? ' assumed' : ''}`}>
            <label>BPM</label>
            <DragNumber
              value={settings.bpm ?? 120}
              min={20}
              max={300}
              step={1}
              onChange={(v) => set({ bpm: v })}
            />
          </div>
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

          <div className={`ctl${isAssumed('root') ? ' assumed' : ''}`}>
            <label>Root</label>
            <Dropdown
              value={settings.root}
              options={ROOTS}
              width={100}
              onChange={(v) => set({ root: v })}
            />
          </div>

          <div className={`ctl${isAssumed('scale') ? ' assumed' : ''}`}>
            <label>Scale</label>
            <Dropdown
              value={settings.scale}
              options={SCALES}
              width={130}
              onChange={(v) => set({ scale: v })}
            />
          </div>

          <div className="ctl">
            <label>Waveshape</label>
            <WaveSelector
              value={settings.waveshape}
              onChange={(v) => set({ waveshape: v as Waveshape })}
            />
          </div>
        </div>
      </div>

      <div className="actions">
        <button disabled={busy || analyzing || !file} onClick={onConvert}>
          {busy ? 'Converting…' : 'Convert to MIDI'}
        </button>
      </div>
    </div>
  )
}
