import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth'
import { useToast } from '../../toast'
import { useI18n } from '../../i18n'
import { useConfirm } from '../../confirm'
import { fetchTeam, setTeamRole, type TeamMember } from '../../lib/admin'
import { smallBtn } from './AdminRequests'
import { Loader2, Mail } from '../../icons'

/** Team members (administrators) can confirm requests, add specialists and see clients. */
export default function AdminTeam() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetchTeam().then(setTeam).catch(err => { console.error(err); setTeam(prev => prev ?? []) })
  }, [])
  useEffect(load, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const clean = email.trim()
    if (!clean) return
    setBusy(true)
    try {
      await setTeamRole(clean, true)
      notify(t('admin.memberAdded'), 'success')
      setEmail('')
      load()
    } catch (err) {
      const msg = (err as { message?: string }).message ?? ''
      notify(/not found/i.test(msg) ? t('admin.memberNotFound') : t('err.updateSession'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(m: TeamMember) {
    const ok = await confirm({ title: t('admin.removeTitle', { email: m.email }), confirmLabel: t('portfolio.remove'), danger: true })
    if (!ok) return
    try {
      await setTeamRole(m.email, false)
      notify(t('admin.updated'), 'success')
      load()
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    }
  }

  return (
    <>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>{t('admin.teamHint')}</p>

      <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
        <div className="glass" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14 }}>
          <Mail size={15} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" strokeWidth={1.8} />
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" placeholder={t('admin.memberEmail')} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 15, fontFamily: 'Outfit, sans-serif' }} />
        </div>
        <button type="submit" disabled={busy} style={{ ...smallBtn, background: '#0ABAB5', color: '#080808', padding: '0 18px', opacity: busy ? 0.6 : 1 }}>{t('admin.add')}</button>
      </form>

      {team === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
      {(team ?? []).map(m => (
        <div key={m.userId} className="glass pop-in" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.fullName || m.email}{m.userId === user?.id ? ` (${t('admin.you')})` : ''}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</p>
          </div>
          {m.userId !== user?.id && (
            <button onClick={() => remove(m)} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', flexShrink: 0 }}>{t('portfolio.remove')}</button>
          )}
        </div>
      ))}
    </>
  )
}
