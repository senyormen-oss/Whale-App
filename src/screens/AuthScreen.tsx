import { useState } from 'react'
import { useAuth } from '../auth'
import { Mail, Lock, User, ArrowUp, CheckCircle2 } from '../icons'

export default function AuthScreen() {
  const { signIn, signUp, resendConfirmation, configured } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password.trim() || (mode === 'signup' && !fullName.trim())) {
      setError('Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    const result = mode === 'signin'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, fullName.trim())
    setBusy(false)

    if (result.error) {
      if (/email.*not.*confirmed/i.test(result.error)) {
        setPendingEmail(email.trim())
        setNeedsConfirmation(true)
      } else {
        setError(result.error)
      }
      return
    }
    if (mode === 'signup') {
      setPendingEmail(email.trim())
      setNeedsConfirmation(true)
    }
  }

  async function handleResend() {
    setResendState('sending')
    await resendConfirmation(pendingEmail)
    setResendState('sent')
  }

  if (needsConfirmation) {
    return (
      <div style={{
        background: '#080808', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: '32px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(10,186,181,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Mail size={26} color="#0ABAB5" strokeWidth={1.8} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Check your email</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 320 }}>
          We sent a confirmation link to <strong style={{ color: 'white' }}>{pendingEmail}</strong>. Open it, then come back and sign in.
        </p>

        {resendState === 'sent' ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4ade80', margin: '0 0 20px' }}>
            <CheckCircle2 size={15} strokeWidth={2} /> Email resent
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendState === 'sending'}
            style={{
              background: 'none', border: 'none', color: '#0ABAB5', fontSize: 13, fontWeight: 700,
              marginBottom: 20, cursor: resendState === 'sending' ? 'wait' : 'pointer',
            }}
          >
            {resendState === 'sending' ? 'Sending…' : "Didn't get it? Resend"}
          </button>
        )}

        <button
          onClick={() => { setNeedsConfirmation(false); setMode('signin'); setResendState('idle') }}
          className="tiffany-glow"
          style={{
            padding: '14px 28px', borderRadius: 16, border: 'none',
            background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
          }}
        >
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: '#080808', minHeight: '100vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '32px 24px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 className="gradient-text" style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 900 }}>Whale</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Book verified digital specialists</p>
      </div>

      {!configured && (
        <div style={{
          background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)',
          borderRadius: 14, padding: 14, marginBottom: 20, fontSize: 12.5, color: '#F5A623', lineHeight: 1.5,
        }}>
          Supabase isn't configured yet — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (see .env.example) and restart the dev server.
        </div>
      )}

      <div className="glass" style={{ borderRadius: 14, padding: 4, display: 'flex', marginBottom: 20 }}>
        {(['signin', 'signup'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null) }}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              fontSize: 13, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
              background: mode === m ? '#0ABAB5' : 'transparent',
              color: mode === m ? '#080808' : 'rgba(255,255,255,0.45)',
              transition: 'all 0.2s',
            }}
          >
            {m === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'signup' && (
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14 }}>
            <User size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 15, fontFamily: 'Outfit, sans-serif' }}
            />
          </div>
        )}
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14 }}>
          <Mail size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 15, fontFamily: 'Outfit, sans-serif' }}
          />
        </div>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14 }}>
          <Lock size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 15, fontFamily: 'Outfit, sans-serif' }}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: 12.5, color: '#ff4d6d' }}>{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className={busy ? '' : 'tiffany-glow'}
          style={{
            marginTop: 8, padding: '15px 0', borderRadius: 16, border: 'none',
            background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800,
            fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          {!busy && <ArrowUp size={16} strokeWidth={2.4} style={{ transform: 'rotate(90deg)' }} />}
        </button>
      </form>
    </div>
  )
}
