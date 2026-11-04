import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Specialist } from './types'
import { fetchSpecialists } from './lib/queries'

interface SpecialistsState {
  specialists: Specialist[]
  loading: boolean
  error: string | null
  reload: () => void
}

const SpecialistsContext = createContext<SpecialistsState | null>(null)

export function SpecialistsProvider({ children }: { children: ReactNode }) {
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSpecialists()
      .then(data => {
        if (!cancelled) {
          setSpecialists(data)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load specialists.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadTick])

  return (
    <SpecialistsContext.Provider
      value={{ specialists, loading, error, reload: () => setReloadTick(t => t + 1) }}
    >
      {children}
    </SpecialistsContext.Provider>
  )
}

export function useSpecialists(): SpecialistsState {
  const ctx = useContext(SpecialistsContext)
  if (!ctx) throw new Error('useSpecialists must be used within SpecialistsProvider')
  return ctx
}
