import { useState } from 'react'
import { useAuth, validatePassword } from '../auth'
import LegalScreen from './LegalScreen'
import { Mail, Lock, User, ArrowUp, CheckCircle2, Eye, EyeOff, AlertCircle } from '../icons'

type View = 'signin' | 'signup' | 'forgot' | 'confirm' | 'reset-sent'

const inputStyle = {
  flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'white',
  fontSize: 16, fontFamily: 'Outfit, sans-serif',
} as const

const fieldStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14 } as const

const primaryBtn = {
  marginTop: 8, padding: '15px 0', borderRadius: 16, border: 'none', background: '#0ABAB5', color: '#080808',
  fontSize: 15, fontWeight: 800, fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 8, width: '100%',
} as const

const linkBtn = {
  background: 'none', border: 'none', color: '#0ABAB5', fontSize: 13, fontWeight: 700, padding: 0,
  fontFamily: 'Outfit, sans-serif',
} as const

function Shell({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div style={{ background: '#080808', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div
        className="fade-in"
        style={{
          width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '32px 24px', textAlign: center ? 'center' : 'left', alignItems: center ? 'center' : 'stretch',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function PasswordField({ value, onChange, placeholder, autoComplete }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="glass" style={fieldStyle}>
      <Lock size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        maxLength={72}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ background: 'none', border: 'none', padding: 4, color: 'rgba(255,255,255,0.5)', display: 'flex' }}
      >
        {show ? <EyeOff size={17} strokeWidth={1.8} /> : <Eye size={17} strokeWidth={1.8} />}
      </button>
    </div>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="fade-in" style={{ margin: 0, fontSize: 12.5, color: '#ff4d6d', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> {message}
    </p>
  )
}

/** Shown after the user opens a password-reset email link. */
function NewPasswordForm() {
  const { updatePassword, finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem = validatePassword(password)
    if (problem) return setError(problem)
    setBusy(true)
    const { error: err } = await updatePassword(password)
    setBusy(false)
    if (err) return setError(err)
    finishRecovery()
  }

  return (
    <Shell>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>Choose a new password</h1>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>At least 8 characters, with a letter and a digit.</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PasswordField value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" />
        <ErrorLine message={error} />
        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </Shell>
  )
}

export default function AuthScreen() {
  const { signIn, signUp, resendConfirmation, resetPassword, configured, user, recovering } = useAuth()
  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [busy, setBusy] = useState(false)
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null)

  if (user && recovering) return <NewPasswordForm />
  if (legalDoc) return <LegalScreen doc={legalDoc} onBack={() => setLegalDoc(null)} />

  function switchView(next: View) {
    setView(next)
    setError(null)
    setResendState('idle')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cleanEmail = email.trim()
    const cleanName = fullName.trim()

    if (view === 'forgot') {
      if (!cleanEmail) return setError('Enter your email.')
      setBusy(true)
      const { error: err } = await resetPassword(cleanEmail)
      setBusy(false)
      if (err) return setError(err)
      setPendingEmail(cleanEmail)
      return switchView('reset-sent')
    }

    if (!cleanEmail || !password || (view === 'signup' && !cleanName)) {
      return setError('Please fill in all fields.')
    }
    if (view === 'signup') {
      const problem = validatePassword(password)
      if (problem) return setError(problem)
      if (cleanName.length > 100) return setError('Name is too long.')
      if (!agreed) return setError('Please accept the Terms of Service and Privacy Policy.')
    }

    setBusy(true)
    const result = view === 'signin' ? await signIn(cleanEmail, password) : await signUp(cleanEmail, password, cleanName)
    setBusy(false)

    if (result.error) {
      if (/email.*not.*confirmed/i.test(result.error)) {
        setPendingEmail(cleanEmail)
        return switchView('confirm')
      }
      return setError(result.error)
    }
    if (view === 'signup') {
      setPendingEmail(cleanEmail)
      switchView('confirm')
    }
  }

  async function handleResend() {
    setResendState('sending')
    await resendConfirmation(pendingEmail)
    setResendState('sent')
  }

  if (view === 'confirm' || view === 'reset-sent') {
    const isReset = view === 'reset-sent'
    return (
      <Shell center>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(10,186,181,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Mail size={26} color="#0ABAB5" strokeWidth={1.8} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Check your email</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 320 }}>
          {isReset
            ? <>If an account exists for <strong style={{ color: 'white' }}>{pendingEmail}</strong>, we sent a link to reset the password.</>
            : <>We sent a confirmation link to <strong style={{ color: 'white' }}>{pendingEmail}</strong>. Open it, then come back and sign in.</>}
        </p>

        {!isReset && (resendState === 'sent' ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4ade80', margin: '0 0 20px' }}>
            <CheckCircle2 size={15} strokeWidth={2} /> Email resent
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendState === 'sending'}
            style={{ ...linkBtn, marginBottom: 20, cursor: resendState === 'sending' ? 'wait' : 'pointer' }}
          >
            {resendState === 'sending' ? 'Sending…' : "Didn't get it? Resend"}
          </button>
        ))}

        <button
          onClick={() => switchView('signin')}
          className="tiffany-glow"
          style={{ padding: '14px 28px', borderRadius: 16, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800 }}
        >
          Back to Sign In
        </button>
      </Shell>
    )
  }

  const title = view === 'signin' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Send reset link'

  return (
    <Shell>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 className="gradient-text" style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 900 }}>Whale</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          {view === 'forgot' ? 'Reset your password' : 'Book verified digital specialists'}
        </p>
      </div>

      {!configured && (
        <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 14, padding: 14, marginBottom: 20, fontSize: 12.5, color: '#F5A623', lineHeight: 1.5 }}>
          The service is not configured yet. Please try again later.
        </div>
      )}

      {view !== 'forgot' && (
        <div className="glass" style={{ borderRadius: 14, padding: 4, display: 'flex', marginBottom: 20 }}>
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchView(m)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                background: view === m ? '#0ABAB5' : 'transparent',
                color: view === m ? '#080808' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.2s',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {view === 'signup' && (
          <div className="glass fade-in" style={fieldStyle}>
            <User size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" autoComplete="name" maxLength={100} style={inputStyle} />
          </div>
        )}
        <div className="glass" style={fieldStyle}>
          <Mail size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" inputMode="email" maxLength={254} style={inputStyle} />
        </div>
        {view !== 'forgot' && (
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Password"
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
          />
        )}

        {view === 'signup' && (
          <>
            <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>At least 8 characters, including a letter and a digit.</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: '#0ABAB5', flexShrink: 0 }}
              />
              <span>
                I am 18 or older and I accept the{' '}
                <button type="button" onClick={() => setLegalDoc('terms')} style={{ ...linkBtn, fontSize: 12.5 }}>Terms of Service</button>
                {' '}and{' '}
                <button type="button" onClick={() => setLegalDoc('privacy')} style={{ ...linkBtn, fontSize: 12.5 }}>Privacy Policy</button>.
              </span>
            </label>
          </>
        )}

        <ErrorLine message={error} />

        <button
          type="submit"
          disabled={busy || !configured}
          className={busy ? '' : 'tiffany-glow'}
          style={{ ...primaryBtn, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Please wait…' : title}
          {!busy && <ArrowUp size={16} strokeWidth={2.4} style={{ transform: 'rotate(90deg)' }} />}
        </button>

        <div style={{ textAlign: 'center', marginTop: 4 }}>
          {view === 'signin' && <button type="button" onClick={() => switchView('forgot')} style={linkBtn}>Forgot password?</button>}
          {view === 'forgot' && <button type="button" onClick={() => switchView('signin')} style={linkBtn}>Back to Sign In</button>}
        </div>
      </form>

      {view !== 'signup' && (
        <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>
          <button type="button" onClick={() => setLegalDoc('terms')} style={{ ...linkBtn, color: 'rgba(255,255,255,0.4)', fontSize: 11.5, fontWeight: 500 }}>Terms</button>
          {' · '}
          <button type="button" onClick={() => setLegalDoc('privacy')} style={{ ...linkBtn, color: 'rgba(255,255,255,0.4)', fontSize: 11.5, fontWeight: 500 }}>Privacy</button>
        </p>
      )}
    </Shell>
  )
}
