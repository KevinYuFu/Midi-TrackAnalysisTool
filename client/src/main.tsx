import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, loadPreferences } from './preferences'
import './theme/tokens.css'
import './styles.css'

applyTheme(loadPreferences().theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
