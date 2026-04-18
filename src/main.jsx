import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function waitForAppFont() {
  if (!document.fonts?.load) return

  const timeout = new Promise((resolve) => {
    window.setTimeout(resolve, 1500)
  })

  try {
    await Promise.race([
      document.fonts.load('1em purrabet-regular'),
      timeout,
    ])
  } catch {
    // Ignore font API failures and continue rendering.
  }
}

async function boot() {
  await waitForAppFont()
  createRoot(document.getElementById('root')).render(
    <App />
  )
}

boot()
