import { useEffect, useState } from 'react'
import { getModels, type ModelInfo } from '../api/client'
import type { AppSettings } from '../preferences'
import { Knob } from './Knob'
import { Toggle } from './Toggle'

interface Props {
  prefs: AppSettings
  onChange: (prefs: AppSettings) => void
  onClose: () => void
}

// Global preferences: theme, stem model, and the "set once" spectral params.
export function SettingsPanel({ prefs, onChange, onClose }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])

  useEffect(() => {
    getModels().then(setModels).catch(() => setModels([]))
  }, [])

  const set = (patch: Partial<AppSettings>) => onChange({ ...prefs, ...patch })

  return (
    <div className="card">
      <div className="topbar">
        <strong>Preferences</strong>
        <button className="ghost" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="module-body">
        <div className="ctl">
          <label>Theme</label>
          <select
            value={prefs.theme}
            onChange={(e) => set({ theme: e.target.value as AppSettings['theme'] })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="ctl">
          <label>Stem model</label>
          <select
            value={prefs.separationModel}
            onChange={(e) => set({ separationModel: e.target.value })}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <Knob
          label="Threshold"
          value={prefs.thresholdDb}
          min={-90}
          max={0}
          step={1}
          format={(v) => `${v} dB`}
          onChange={(v) => set({ thresholdDb: v })}
        />
        <Knob
          label="Harmonic cut"
          value={prefs.harmonicStrength}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => set({ harmonicStrength: v })}
        />

        <div className="ctl inline">
          <label>Velocity from FFT</label>
          <Toggle
            checked={prefs.velocityFromFft}
            onChange={(v) => set({ velocityFromFft: v })}
          />
        </div>
      </div>
    </div>
  )
}
