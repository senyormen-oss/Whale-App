import { createPortal } from 'react-dom'
import { useState, useEffect, useCallback } from 'react'
import type { Screen, Specialist } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { useToast } from '../toast'
import { useI18n, formatDate, formatNumber, monthName } from '../i18n'
import { useConfirm } from '../confirm'
import { categoryLabel, localizeService, formatOrderPrice, sumUzs } from '../data'
import LanguageSwitcher from '../LanguageSwitcher'
import ThemeSwitcher from '../ThemeSwitcher'
import UserAvatar from '../UserAvatar'
import SpecialistWorkspace from './SpecialistWorkspace'
import AdminPanel from './AdminPanel'
import { fetchIsAdmin } from '../lib/admin'
import EditProfileModal from './EditProfileModal'
import Segmented from '../Segmented'
import type { InboxItem } from '../lib/queries'
import BecomeSpecialistForm from './BecomeSpecialistForm'
import { TELEGRAM_BOT, fetchTelegramLinked, telegramLinkUrl, unlinkTelegram } from '../notifications'
import { Send } from '../icons'
import { SpecialistInbox, SpecialistChatThread } from './SpecialistInbox'
import LegalScreen from './LegalScreen'
import {
  Settings, User, Briefcase, ClipboardList, Wallet, CheckCircle2, Star,
  Calendar, TrendingUp, Heart, BarChart3, Users, Bell, Trash2, LogOut, X, Loader2, MessageSquareText, FileText, type IconType,
} from '../icons'

interface Props {
  onNavigate: (screen: Screen) => void
}

const STATUS_CONFIG: Record<string, { label: Parameters<typeof import('../i18n').t>[0]; color: string; bg: string }> = {
  pending:   { label: 'status.pending',   color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  confirmed: { label: 'status.confirmed', color: 'var(--accent-text)', bg: 'rgba(10,186,181,0.12)' },
  completed: { label: 'status.done',      color: 'var(--ok)', bg: 'rgba(74,222,128,0.12)' },
  cancelled: { label: 'status.cancelled', color: '#ff4d6d', bg: 'rgba(255,77,109,0.12)' },
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: IconType; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="glass"
      style={{
        borderRadius: 18, padding: '18px 16px',
        border: accent ? '1px solid rgba(10,186,181,0.3)' : '1px solid rgba(var(--fg-rgb),0.08)',
        background: accent ? 'linear-gradient(135deg, rgba(10,186,181,0.1) 0%, rgba(10,186,181,0.03) 100%)' : undefined,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, marginBottom: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: accent ? 'rgba(10,186,181,0.15)' : 'rgba(var(--fg-rgb),0.06)',
      }}>
        <Icon size={17} color={accent ? 'var(--accent-text)' : 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))'} strokeWidth={1.8} />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: accent ? 'var(--accent-text)' : 'var(--ink)' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{label}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.35 * var(--tb)))' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'client' | 'specialist' | 'admin'>('client')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { orders, favorites, notificationsEnabled, toggleNotifications, deleteAccount } = useAppStore()
  const { user, signOut } = useAuth()
  const { notify } = useToast()
  const { specialists, reload: reloadSpecialists } = useSpecialists()
  const [openChat, setOpenChat] = useState<InboxItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null)

  const spendByMonth = Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (4 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const amount = orders
      .filter(o => o.status !== 'cancelled' && o.currency === 'UZS' && o.rawDate?.startsWith(key))
      .reduce((sum, o) => sum + o.amount, 0)
    return { key, label: monthName(d.getMonth()).slice(0, 3), amount, current: i === 4 }
  })
  const maxSpend = Math.max(...spendByMonth.map(m => m.amount))
  const totalSpent = sumUzs(orders)
  const completedCount = orders.filter(o => o.status === 'completed').length
  const favoriteSpecialists = specialists.filter(s => favorites.includes(s.id))

  useEffect(() => {
    if (user) fetchIsAdmin(user.id).then(setIsAdmin)
  }, [user])

  if (legalDoc) {
    return <LegalScreen doc={legalDoc} onBack={() => setLegalDoc(null)} />
  }

  if (openChat) {
    return <SpecialistChatThread conversationId={openChat.id} clientName={openChat.clientName} onBack={() => setOpenChat(null)} />
  }

  return (
    <div style={{ minHeight: '100%', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, var(--bg-header) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <UserAvatar size={64} editable />
            <span className="online-dot" style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--bg)', pointerEvents: 'none' }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(user?.user_metadata?.full_name as string) || t('dash.user')}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || (user?.phone ? `+${user.phone}` : '')}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            aria-label={t('dash.settings')}
            style={{ background: 'rgba(var(--fg-rgb),0.07)', border: 'none', borderRadius: 12, padding: '8px 12px', color: 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))', display: 'flex', alignItems: 'center' }}
          >
            <Settings size={19} strokeWidth={1.8} />
          </button>
        </div>

        {/* Mode toggle */}
        <Segmented<'client' | 'specialist' | 'admin'>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'client', label: t('dash.client') },
            { value: 'specialist', label: t('dash.specialist') },
            ...(isAdmin ? [{ value: 'admin' as const, label: t('dash.admin') }] : []),
          ]}
        />
        <p key={mode} className="fade-in" style={{ margin: '10px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
          {mode === 'client' ? t('dash.clientHint') : mode === 'specialist' ? t('dash.specialistHint') : t('dash.adminHint')}
        </p>
      </div>

      {mode === 'admin' && isAdmin && (
        <div style={{ padding: '0 20px' }}><AdminPanel /></div>
      )}

      {mode === 'client' && (
        <div className="fade-in" style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Stats */}
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <StatCard icon={ClipboardList} label={t('dash.totalOrders')} value={String(orders.length)} accent />
            <StatCard icon={Wallet} label={t('dash.totalSpent')} value={(totalSpent / 1_000_000).toFixed(2) + 'M'} sub={t('common.uzs')} />
            <StatCard icon={CheckCircle2} label={t('dash.completed')} value={String(completedCount)} />
            <StatCard icon={Heart} label={t('dash.favorites')} value={String(favorites.length)} />
          </div>

          {/* Recent orders */}
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{t('dash.recentOrders')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {orders.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{t('dash.noOrders')}</p>
              )}
              {orders.map(order => {
                const sp = specialists.find(s => s.id === order.specialistId)
                if (!sp) return null
                const status = STATUS_CONFIG[order.status]
                return (
                  <button
                    key={order.id}
                    onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
                    className="glass"
                    style={{
                      borderRadius: 18, padding: '14px 16px',
                      display: 'flex', gap: 12, alignItems: 'center',
                      border: '1px solid rgba(var(--fg-rgb),0.08)',
                      textAlign: 'left', cursor: 'pointer',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <img src={sp.avatar} alt={sp.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--surface)' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{localizeService(order.service)}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.3 * var(--tb)))' }}>{formatDate(order.date)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        {formatOrderPrice(order)}
                      </p>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: status.bg, color: status.color,
                      }}>
                        {t(status.label)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Analytics */}
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="var(--accent-text)" strokeWidth={2} /> {t('dash.analytics')}
            </h2>
            <div className="glass" style={{ borderRadius: 18, padding: 18 }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('dash.spendByMonth')}
              </p>
              {maxSpend === 0 && (
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{t('dash.noSpending')}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
                {spendByMonth.map(m => (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: '100%', borderRadius: 6,
                        height: `${Math.max(m.amount > 0 ? 6 : 2, (m.amount / (maxSpend || 1)) * 72)}px`,
                        background: m.current ? '#0ABAB5' : 'rgba(10,186,181,0.25)',
                        transition: 'height 0.5s ease',
                      }}
                    />
                    <span style={{ fontSize: 10, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Favorites */}
          <div style={{ paddingBottom: 20 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Heart size={16} color="#ff4d6d" strokeWidth={2.2} /> {t('dash.favorites')}
            </h2>
            {favoriteSpecialists.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>
                {t('dash.noFavorites')}
              </p>
            ) : (
              <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                {favoriteSpecialists.map(sp => (
                  <button
                    key={sp.id}
                    onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
                    style={{
                      flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '14px 16px', borderRadius: 18, border: 'none',
                      background: 'rgba(var(--fg-rgb),0.05)', cursor: 'pointer', minWidth: 88,
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <img src={sp.avatar} alt={sp.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)' }} />
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>
                      {sp.name.split(' ')[0]}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{categoryLabel(sp.categoryKey).split(' ')[0]}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'specialist' && (
        <div className="fade-in" style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SpecialistWorkspace onOpenChat={setOpenChat} />
        </div>
      )}

      {showSettings && createPortal(
        <div
          className="sheet-backdrop"
          style={{
            position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="glass slide-up sheet-panel"
            style={{
              width: '100%', maxWidth: 430, borderRadius: '24px 24px 0 0',
              padding: '20px 20px 40px', border: '1px solid rgba(var(--fg-rgb),0.1)', borderBottom: 'none',
              background: 'var(--sheet)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('dash.settings')}</h2>
              <button
                onClick={() => setShowSettings(false)}
                aria-label={t('common.close')}
                style={{ background: 'rgba(var(--fg-rgb),0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div style={{ padding: '4px 0 16px', borderBottom: '1px solid rgba(var(--fg-rgb),0.08)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', fontWeight: 600 }}>{t('dash.language')}</p>
              <LanguageSwitcher />
              <p style={{ margin: '14px 0 8px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', fontWeight: 600 }}>{t('dash.theme')}</p>
              <ThemeSwitcher />
            </div>

            <button
              onClick={() => { setShowSettings(false); setEditProfile(true) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 4px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.08)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <User size={17} color="rgba(var(--fg-rgb),calc(0.7 * var(--tb)))" strokeWidth={1.8} />
              <span style={{ fontSize: 14, color: 'var(--ink)' }}>{t('dash.editProfile')}</span>
            </button>

            <button
              onClick={toggleNotifications}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 4px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.08)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Bell size={17} color="rgba(var(--fg-rgb),calc(0.7 * var(--tb)))" strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--ink)' }}>{t('home.notifications')}</span>
              <span style={{
                width: 40, height: 24, borderRadius: 12, position: 'relative',
                background: notificationsEnabled ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.15)', transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute', top: 3, left: notificationsEnabled ? 19 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                }} />
              </span>
            </button>

            <TelegramRow />

            {(['terms', 'privacy'] as const).map(doc => (
              <button
                key={doc}
                onClick={() => { setShowSettings(false); setLegalDoc(doc) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 4px', background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(var(--fg-rgb),0.08)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <FileText size={17} color="rgba(var(--fg-rgb),calc(0.7 * var(--tb)))" strokeWidth={1.8} />
                <span style={{ fontSize: 14, color: 'var(--ink)' }}>{doc === 'terms' ? t('legal.terms') : t('legal.privacy')}</span>
              </button>
            ))}

            <button
              onClick={() => signOut()}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 4px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.08)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <LogOut size={17} color="rgba(var(--fg-rgb),calc(0.7 * var(--tb)))" strokeWidth={1.8} />
              <span style={{ fontSize: 14, color: 'var(--ink)' }}>{t('dash.signOut')}</span>
            </button>

            <button
              onClick={async () => {
                if (deleting) return
                if (!(await confirm({ title: t('dash.deleteTitle'), message: t('dash.deleteText'), confirmLabel: t('dash.deleteConfirm'), danger: true }))) return
                if (!(await confirm({ title: t('dash.deleteTitle2'), message: t('dash.deleteText2'), confirmLabel: t('dash.deleteFinal'), danger: true }))) return
                setDeleting(true)
                const ok = await deleteAccount()
                setDeleting(false)
                if (ok) setShowSettings(false)
              }}
              disabled={deleting}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 4px', background: 'none', border: 'none',
                cursor: deleting ? 'wait' : 'pointer', textAlign: 'left', opacity: deleting ? 0.6 : 1,
              }}
            >
              <Trash2 size={17} color="#ff4d6d" strokeWidth={1.8} />
              <span style={{ fontSize: 14, color: '#ff4d6d' }}>{deleting ? t('dash.deleting') : t('dash.deleteAccount')}</span>
            </button>
          </div>
        </div>
      , document.body)}
      {editProfile && <EditProfileModal onClose={() => setEditProfile(false)} />}
    </div>
  )
}


/** "Telegram notifications": opens the bot with a one-time code; shows the state once linked. */
function TelegramRow() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { notify } = useToast()
  const [linked, setLinked] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchTelegramLinked(user.id).then(setLinked).catch(() => setLinked(false))
    // After the user presses Start in the bot and comes back, refresh the state.
    const onFocus = () => fetchTelegramLinked(user.id).then(setLinked).catch(() => {})
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user])

  if (!TELEGRAM_BOT) return null

  async function connect() {
    setBusy(true)
    // Open the window first (in the click) so browsers do not block it, then point it at the bot.
    const win = window.open('', '_blank')
    try {
      const url = await telegramLinkUrl()
      if (win) win.location.href = url
      else window.location.href = url
      notify(t('notif.afterConnect'), 'success')
    } catch (err) {
      console.error(err)
      win?.close()
      notify(t('notif.connectFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!user) return
    setBusy(true)
    try {
      await unlinkTelegram(user.id)
      setLinked(false)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px', borderBottom: '1px solid rgba(var(--fg-rgb),0.08)' }}>
      <Send size={17} color="rgba(var(--fg-rgb),calc(0.7 * var(--tb)))" strokeWidth={1.8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>{linked ? t('notif.connected') : t('notif.telegram')}</p>
        {!linked && <p style={{ margin: '2px 0 0', fontSize: 11.5, lineHeight: 1.4, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('notif.telegramHint')}</p>}
      </div>
      {linked === null ? null : linked ? (
        <button onClick={disconnect} disabled={busy} style={{ padding: '7px 12px', borderRadius: 16, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', fontSize: 12, fontWeight: 700 }}>{t('notif.disconnect')}</button>
      ) : (
        <button onClick={connect} disabled={busy} style={{ padding: '7px 12px', borderRadius: 16, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{t('notif.connect')}</button>
      )}
    </div>
  )
}
