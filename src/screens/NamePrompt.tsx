import { useState } from 'react'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { useI18n } from '../i18n'
import { updateProfileName } from '../lib/queries'
import LanguageSwitcher from '../LanguageSwitcher'
import { User } from '../icons'

/** Shown once after a first phone sign-in: the account has no name yet. */
export default function NamePrompt() {
  const { t } = useI18n()
  const { user, updateName, signOut } = useAuth()
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!user) return
    if (clean.length < 2) return notify(t('profile.nameShort'))
    setBusy(true)
    const { error } = await updateName(clean)
    if (error) {
      setBusy(false)
      return notify(t('err.profile'))
    }
    await updateProfileName(user.id, clean).catch(err => console.error('profile row not updated', err))
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div className="fade-in" style={{ width: '100%', maxWidth: 430, padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <LanguageSwitcher compact />
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>{t('welcome.title')}</h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', lineHeight: 1.5 }}>{t('welcome.hint')}</p>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14 }}>
            <User size={16} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" strokeWidth={1.8} />
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('auth.fullName')}
              autoComplete="name"
              maxLength={100}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 16, fontFamily: 'Outfit, Onest, sans-serif' }}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className={busy ? '' : 'tiffany-glow'}
            style={{ marginTop: 8, padding: '15px 0', borderRadius: 16, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? t('auth.saving') : t('welcome.continue')}
          </button>
        </form>
        <button onClick={() => signOut()} style={{ marginTop: 18, background: 'none', border: 'none', color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', fontSize: 12.5 }}>
          {t('dash.signOut')}
        </button>
      </div>
    </div>
  )
}
