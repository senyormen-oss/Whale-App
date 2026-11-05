import { useState } from 'react'
import { useAuth, validatePassword } from '../auth'
import { useI18n } from '../i18n'
import LanguageSwitcher from '../LanguageSwitcher'
import Segmented from '../Segmented'
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
  const { t } = useI18n()
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
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
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
  const { t } = useI18n()
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
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>{t('auth.newPassword')}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{t('auth.pw.hint')}</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PasswordField value={password} onChange={setPassword} placeholder={t('auth.newPasswordPlaceholder')} autoComplete="new-password" />
        <ErrorLine message={error} />
        <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? t('auth.saving') : t('auth.savePassword')}
        </button>
      </form>
    </Shell>
  )
}

export default function AuthScreen() {
  const { t } = useI18n()
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
      if (!cleanEmail) return setError(t('auth.enterEmail'))
      setBusy(true)
      const { error: err } = await resetPassword(cleanEmail)
      setBusy(false)
      if (err) return setError(err)
      setPendingEmail(cleanEmail)
      return switchView('reset-sent')
    }

    if (!cleanEmail || !password || (view === 'signup' && !cleanName)) {
      return setError(t('auth.fillAll'))
    }
    if (view === 'signup') {
      const problem = validatePassword(password)
      if (problem) return setError(problem)
      if (cleanName.length > 100) return setError(t('auth.nameLong'))
      if (!agreed) return setError(t('auth.acceptTerms'))
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
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>{t('auth.checkEmail')}</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 320 }}>
          {isReset
            ? <>{t('auth.resetSent')} <strong style={{ color: 'white' }}>{pendingEmail}</strong></>
            : <>{t('auth.confirmSent')} <strong style={{ color: 'white' }}>{pendingEmail}</strong>. {t('auth.confirmThen')}</>}
        </p>

        {!isReset && (resendState === 'sent' ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4ade80', margin: '0 0 20px' }}>
            <CheckCircle2 size={15} strokeWidth={2} /> {t('auth.resent')}
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendState === 'sending'}
            style={{ ...linkBtn, marginBottom: 20, cursor: resendState === 'sending' ? 'wait' : 'pointer' }}
          >
            {resendState === 'sending' ? t('auth.sending') : t('auth.resend')}
          </button>
        ))}

        <button
          onClick={() => switchView('signin')}
          className="tiffany-glow"
          style={{ padding: '14px 28px', borderRadius: 16, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800 }}
        >
          {t('auth.backToSignIn')}
        </button>
      </Shell>
    )
  }

  const title = view === 'signin' ? t('auth.signIn') : view === 'signup' ? t('auth.createAccount') : t('auth.sendReset')

  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <LanguageSwitcher compact />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 className="gradient-text floaty" style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 900 }}>Whale</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          {view === 'forgot' ? t('auth.resetTitle') : t('auth.tagline')}
        </p>
      </div>

      {!configured && (
        <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 14, padding: 14, marginBottom: 20, fontSize: 12.5, color: '#F5A623', lineHeight: 1.5 }}>
          {t('auth.notConfigured')}
        </div>
      )}

      {view !== 'forgot' && (
        <Segmented<'signin' | 'signup'>
          value={view === 'signup' ? 'signup' : 'signin'}
          onChange={switchView}
          style={{ marginBottom: 20 }}
          options={[
            { value: 'signin', label: t('auth.signInTab') },
            { value: 'signup', label: t('auth.signUpTab') },
          ]}
        />
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {view === 'signup' && (
          <div className="glass fade-in" style={fieldStyle}>
            <User size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('auth.fullName')} autoComplete="name" maxLength={100} style={inputStyle} />
          </div>
        )}
        <div className="glass" style={fieldStyle}>
          <Mail size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.email')} type="email" autoComplete="email" inputMode="email" maxLength={254} style={inputStyle} />
        </div>
        {view !== 'forgot' && (
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder={t('auth.password')}
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
          />
        )}

        {view === 'signup' && (
          <>
            <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{t('auth.pw.hint')}</p>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: '#0ABAB5', flexShrink: 0 }}
              />
              <span>
                {t('auth.agree1')}{' '}
                <button type="button" onClick={() => setLegalDoc('terms')} style={{ ...linkBtn, fontSize: 12.5 }}>{t('legal.terms')}</button>
                {' '}{t('auth.and')}{' '}
                <button type="button" onClick={() => setLegalDoc('privacy')} style={{ ...linkBtn, fontSize: 12.5 }}>{t('legal.privacy')}</button>.
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
          {view === 'signin' && <button type="button" onClick={() => switchView('forgot')} style={linkBtn}>{t('auth.forgot')}</button>}
          {view === 'forgot' && <button type="button" onClick={() => switchView('signin')} style={linkBtn}>{t('auth.backToSignIn')}</button>}
        </div>
      </form>

      {view !== 'signup' && (
        <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.3)' }}>
          <button type="button" onClick={() => setLegalDoc('terms')} style={{ ...linkBtn, color: 'rgba(255,255,255,0.4)', fontSize: 11.5, fontWeight: 500 }}>{t('legal.termsShort')}</button>
          {' · '}
          <button type="button" onClick={() => setLegalDoc('privacy')} style={{ ...linkBtn, color: 'rgba(255,255,255,0.4)', fontSize: 11.5, fontWeight: 500 }}>{t('legal.privacyShort')}</button>
        </p>
      )}
    </Shell>
  )
}
