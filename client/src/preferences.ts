// Global app preferences (theme, default model, defaults).
// Stored in localStorage for now; moves server-side once accounts exist.

import type { Waveshape } from './api/client'

export interface AppSettings {
  theme: 'dark' | 'light'
  defaultModel: string
  defaultThresholdDb: number
  defaultWaveshape: Waveshape
}

const KEY = 'a2m-preferences'

const DEFAULTS: AppSettings = {
  theme: 'dark',
  defaultModel: 'demucs_htdemucs',
  defaultThresholdDb: -60,
  defaultWaveshape: 'saw',
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
