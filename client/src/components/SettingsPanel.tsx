import { useEffect, useState } from 'react'
import { getModels, type ModelInfo, type SweepMode } from '../api/client'
import type { AppSettings } from '../preferences'
import { Dropdown } from './Dropdown'
import { Knob } from './Knob'
import { Selector } from './Selector'
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
          <button
            type="button"
            className="ghost theme-toggle"
            onClick={() => set({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
          >
            {prefs.theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5 5.6 5.6 0 1 0 13.5 9.6z" fill="currentColor" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1" />
              </svg>
            )}
            <span>{prefs.theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>

        <div className="ctl">
          <label>Stem model</label>
          <Dropdown
            value={prefs.separationModel}
            width={200}
            options={models.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(v) => set({ separationModel: v })}
          />
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

        <div className="ctl">
          <label>Pitch sweeps</label>
          <Selector
            value={prefs.sweepMode}
            onChange={(v) => set({ sweepMode: v as SweepMode })}
            options={[
              { value: 'snap', label: 'Snap' },
              { value: 'start_end', label: 'Start+End' },
              { value: 'mpe', label: 'MPE' },
            ]}
          />
        </div>

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
