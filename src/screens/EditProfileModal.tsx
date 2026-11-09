import { useState } from 'react'
import Sheet from '../Sheet'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { useI18n } from '../i18n'
import { updateProfileName, updateSpecialistName } from '../lib/queries'
import { User } from '../icons'

/** Lets the user change the display name shown in the app, in reviews and on their listing. */
export default function EditProfileModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { t } = useI18n()
  const { user, updateName } = useAuth()
  const { notify } = useToast()
  const [name, setName] = useState((user?.user_metadata?.full_name as string) || '')
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!user) return
    if (clean.length < 2) return notify(t('profile.nameShort'))
    if (clean.length > 100) return notify(t('auth.nameLong'))
    setBusy(true)
    try {
      const { error } = await updateName(clean)
      if (error) throw new Error(error)
      await updateProfileName(user.id, clean).catch(err => console.error('profile row not updated', err))
      await updateSpecialistName(user.id, clean).catch(err => console.error('listing name not updated', err))
      notify(t('profile.saved'), 'success')
      onSaved?.()
      onClose()
    } catch (err) {
      console.error('Failed to update profile', err)
      notify(t('err.profile'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('dash.editProfile')} onClose={onClose}>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('auth.fullName')}</label>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 14 }}>
            <User size={16} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" strokeWidth={1.8} />
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              autoComplete="name"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 16, fontFamily: 'Outfit, sans-serif' }}
            />
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', lineHeight: 1.5 }}>{t('profile.nameHint')}</p>
        <button
          type="submit"
          disabled={busy}
          className={busy ? '' : 'tiffany-glow'}
          style={{ padding: '14px 0', borderRadius: 14, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? t('auth.saving') : t('form.save')}
        </button>
      </form>
    </Sheet>
  )
}
