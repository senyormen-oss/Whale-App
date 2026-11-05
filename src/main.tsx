import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary, { OfflineBanner } from './ErrorBoundary'
import { AuthProvider } from './auth'
import { ToastProvider } from './toast'
import { I18nProvider } from './i18n'
import { ThemeProvider } from './theme'
import { ConfirmProvider } from './confirm'
import { SpecialistsProvider } from './specialistsData'
import { AppStoreProvider } from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <SpecialistsProvider>
                <AppStoreProvider>
                  <OfflineBanner />
                  <App />
                </AppStoreProvider>
              </SpecialistsProvider>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
      </ThemeProvider>
    </I18nProvider>
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
