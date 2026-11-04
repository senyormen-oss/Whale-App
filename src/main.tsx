import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth'
import { SpecialistsProvider } from './specialistsData'
import { AppStoreProvider } from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SpecialistsProvider>
        <AppStoreProvider>
          <App />
        </AppStoreProvider>
      </SpecialistsProvider>
    </AuthProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline/installable support is a progressive enhancement — a failed
      // registration (e.g. unsupported browser) must not break the app.
    })
  })
}
