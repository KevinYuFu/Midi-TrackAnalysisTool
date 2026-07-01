// Thin API layer. Mirrors the server's pydantic models.

export type Waveshape = 'sine' | 'triangle' | 'saw' | 'square'
export type SweepMode = 'snap' | 'start_end' | 'mpe'

export interface AnalysisSettings {
  root: string // "C".."B"
  scale: string // "Major", "Minor", "Dorian", ...
  bpm: number | null
  downbeat_ms: number
  period: string
  waveshape: Waveshape
  sweep_mode: SweepMode
  separation_model: string
  // Spectral params — edited in Preferences, sent with each conversion.
  threshold_db: number
  harmonic_strength: number
  velocity_from_fft: boolean
}

export interface SuggestedSettings {
  settings: AnalysisSettings
  assumed_fields: string[]
}

export interface ModelInfo {
  id: string
  name: string
  stems: string[]
  description: string
}

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetch('/api/models')
  if (!res.ok) throw new Error('Failed to load models')
  return res.json()
}

export async function suggest(file: File): Promise<SuggestedSettings> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/suggest', { method: 'POST', body })
  if (!res.ok) throw new Error('Suggest failed')
  return res.json()
}

export async function process(file: File, settings: AnalysisSettings): Promise<Blob> {
  const body = new FormData()
  body.append('file', file)
  body.append('settings', JSON.stringify(settings))
  const res = await fetch('/api/process', { method: 'POST', body })
  if (!res.ok) throw new Error('Process failed')
  return res.blob()
}
