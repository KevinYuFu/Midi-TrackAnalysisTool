// Global app preferences. Stored in localStorage for now; moves server-side
// once accounts exist. Holds the "set once and forget" params too.

import type { SweepMode } from './api/client'

export interface AppSettings {
  theme: 'dark' | 'light'
  separationModel: string
  thresholdDb: number
  harmonicStrength: number
  velocityFromFft: boolean
  sweepMode: SweepMode
}

const KEY = 'a2m-preferences'

const DEFAULTS: AppSettings = {
  theme: 'dark',
  separationModel: 'demucs_htdemucs',
  thresholdDb: -60,
  harmonicStrength: 0.7,
  velocityFromFft: true,
  sweepMode: 'snap',
}

export function loadPreferences(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function savePreferences(prefs: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
  applyTheme(prefs.theme)
}

export function applyTheme(theme: AppSettings['theme']): void {
  document.documentElement.setAttribute('data-theme', theme)
}
