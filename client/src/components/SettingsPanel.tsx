import { useEffect, useState } from 'react'
import { getModels, type ModelInfo } from '../api/client'
import type { AppSettings } from '../preferences'

interface Props {
  prefs: AppSettings
  onChange: (prefs: AppSettings) => void
  onClose: () => void
}

// Global preferences: theme + default separation model live here (not in the
// per-conversion popup). This is the "app defaults" surface.
export function SettingsPanel({ prefs, onChange, onClose }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([])

  useEffect(() => {
    getModels().then(setModels).catch(() => setModels([]))
  }, [])

  return (
    <div className="card">
      <div className="topbar">
        <strong>Preferences</strong>
        <button className="ghost" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="row">
        <div className="field">
          <label>Theme</label>
          <select
            value={prefs.theme}
            onChange={(e) => onChange({ ...prefs, theme: e.target.value as AppSettings['theme'] })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="field">
          <label>Default stem model</label>
          <select
            value={prefs.defaultModel}
            onChange={(e) => onChange({ ...prefs, defaultModel: e.target.value })}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {models.length > 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          {models.find((m) => m.id === prefs.defaultModel)?.description}
        </p>
      )}
    </div>
  )
}
