import { useState, useEffect, useCallback } from 'react'
import type { Screen, Specialist } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { useToast } from '../toast'
import { useI18n, formatDate, formatNumber, monthName } from '../i18n'
import { useConfirm } from '../confirm'
import { categoryLabel, localizeService } from '../data'
import LanguageSwitcher from '../LanguageSwitcher'
import ThemeSwitcher from '../ThemeSwitcher'
import UserAvatar from '../UserAvatar'
import Segmented from '../Segmented'
import { fetchMySpecialistListing, fetchSpecialistOrders, markOrderCompleted, updateSpecialistListing, type SpecialistOrder, type InboxItem } from '../lib/queries'
import BecomeSpecialistForm from './BecomeSpecialistForm'
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
        <Icon size={17} color={accent ? 'var(--accent-text)' : 'rgba(var(--fg-rgb),0.7)'} strokeWidth={1.8} />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: accent ? 'var(--accent-text)' : 'var(--ink)' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),0.5)' }}>{label}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(var(--fg-rgb),0.35)' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'client' | 'specialist'>('client')
  const [showSettings, setShowSettings] = useState(false)
  const { orders, favorites, notificationsEnabled, toggleNotifications, deleteAccount } = useAppStore()
  const { user, signOut } = useAuth()
  const { notify } = useToast()
  const { specialists, reload: reloadSpecialists } = useSpecialists()
  const [openChat, setOpenChat] = useState<InboxItem | null>(null)
  const [inboxUnread, setInboxUnread] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null)

  const spendByMonth = Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (4 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const amount = orders
      .filter(o => o.status !== 'cancelled' && o.rawDate?.startsWith(key))
      .reduce((sum, o) => sum + o.amount, 0)
    return { key, label: monthName(d.getMonth()).slice(0, 3), amount, current: i === 4 }
  })
  const maxSpend = Math.max(...spendByMonth.map(m => m.amount))
  const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0)
  const completedCount = orders.filter(o => o.status === 'completed').length
  const favoriteSpecialists = specialists.filter(s => favorites.includes(s.id))

  const [myListing, setMyListing] = useState<Specialist | null | undefined>(undefined) // undefined = loading
  const [myOrders, setMyOrders] = useState<SpecialistOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const loadListing = useCallback(() => {
    if (!user) return
    setMyListing(undefined)
    fetchMySpecialistListing(user.id)
      .then(setMyListing)
      .catch(err => {
        console.error('Failed to load specialist listing', err)
        setMyListing(null)
      })
  }, [user])

  useEffect(() => {
    if (mode === 'specialist') loadListing()
  }, [mode, loadListing])

  useEffect(() => {
    if (!myListing) {
      setMyOrders([])
      return
    }
    setOrdersLoading(true)
    fetchSpecialistOrders(myListing.id)
      .then(setMyOrders)
      .catch(err => console.error('Failed to load specialist orders', err))
      .finally(() => setOrdersLoading(false))
  }, [myListing])

  async function handleMarkCompleted(orderId: string) {
    try {
      await markOrderCompleted(orderId)
      setMyOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: 'completed' } : o)))
      notify(t('toast.sessionDone'), 'success')
    } catch (err) {
      console.error('Failed to mark order completed', err)
      notify(t('err.updateSession'))
    }
  }

  async function toggleAvailability() {
    if (!myListing) return
    const next = !myListing.available
    setMyListing({ ...myListing, available: next })
    try {
      await updateSpecialistListing(myListing.id, { available: next })
      reloadSpecialists()
    } catch (err) {
      console.error('Failed to update availability', err)
      setMyListing({ ...myListing, available: !next })
      notify(t('err.availability'))
    }
  }

  const upcomingOrders = myOrders.filter(o => o.status === 'confirmed')
  const totalIncome = myOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0)
  const clientCount = new Set(myOrders.map(o => o.clientName)).size
  const profileChecklist = myListing
    ? [
        { label: t('dash.check.bio'), done: myListing.bio.trim().length > 0 },
        { label: t('dash.check.price'), done: myListing.price > 0 },
        { label: t('dash.check.skills'), done: myListing.tags.length > 0 },
        { label: t('dash.check.city'), done: myListing.city.trim().length > 0 },
      ]
    : []
  const completeness = profileChecklist.length
    ? Math.round((profileChecklist.filter(i => i.done).length / profileChecklist.length) * 100)
    : 0

  if (legalDoc) {
    return <LegalScreen doc={legalDoc} onBack={() => setLegalDoc(null)} />
  }

  if (openChat) {
    return <SpecialistChatThread conversationId={openChat.id} clientName={openChat.clientName} onBack={() => setOpenChat(null)} />
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, var(--bg-header) 0%, var(--bg) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <UserAvatar size={64} editable />
            <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--bg)', pointerEvents: 'none' }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(user?.user_metadata?.full_name as string) || t('dash.user')}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            aria-label={t('dash.settings')}
            style={{ background: 'rgba(var(--fg-rgb),0.07)', border: 'none', borderRadius: 12, padding: '8px 12px', color: 'rgba(var(--fg-rgb),0.7)', display: 'flex', alignItems: 'center' }}
          >
            <Settings size={19} strokeWidth={1.8} />
          </button>
        </div>

        {/* Mode toggle */}
        <Segmented<'client' | 'specialist'>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'client', label: t('dash.client') },
            { value: 'specialist', label: t('dash.specialist') },
          ]}
        />
        <p key={mode} className="fade-in" style={{ margin: '10px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),0.5)' }}>
          {mode === 'client' ? t('dash.clientHint') : t('dash.specialistHint')}
        </p>
      </div>

      {mode === 'client' && (
        <div className="fade-in" style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),0.4)' }}>{t('dash.noOrders')}</p>
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
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(var(--fg-rgb),0.45)' }}>{localizeService(order.service)}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),0.3)' }}>{formatDate(order.date)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        {formatNumber(order.amount)}
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
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(var(--fg-rgb),0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('dash.spendByMonth')}
              </p>
              {maxSpend === 0 && (
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(var(--fg-rgb),0.4)' }}>{t('dash.noSpending')}</p>
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
                    <span style={{ fontSize: 10, color: 'rgba(var(--fg-rgb),0.4)' }}>{m.label}</span>
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
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),0.4)' }}>
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
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg-rgb),0.4)' }}>{categoryLabel(sp.categoryKey).split(' ')[0]}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'specialist' && (
        <div className="fade-in" style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {myListing === undefined && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <Loader2 className="spin" size={26} color="var(--accent-text)" strokeWidth={2} />
            </div>
          )}

          {myListing === null && (
            <BecomeSpecialistForm onCreated={sp => { setMyListing(sp); reloadSpecialists() }} />
          )}

          {myListing && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <StatCard icon={Wallet} label={t('dash.totalIncome')} value={(totalIncome / 1_000_000).toFixed(2) + 'M'} sub={t('dash.incomeSub')} accent />
                <StatCard icon={ClipboardList} label={t('dash.activeOrders')} value={String(upcomingOrders.length)} />
                <StatCard icon={Star} label={t('dash.myRating')} value={myListing.reviews > 0 ? myListing.rating.toFixed(1) : '—'} />
                <StatCard icon={Users} label={t('dash.clients')} value={String(clientCount)} />
              </div>

              {/* Availability toggle */}
              <button
                onClick={toggleAvailability}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(var(--fg-rgb),0.08)',
                  background: 'rgba(var(--fg-rgb),0.04)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: myListing.available ? 'var(--ok)' : 'rgba(var(--fg-rgb),0.3)',
                }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
                  {myListing.available ? t('chat.accepting') : t('chat.notAccepting')}
                </span>
                <span style={{
                  width: 40, height: 24, borderRadius: 12, position: 'relative',
                  background: myListing.available ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.15)', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: myListing.available ? 19 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                  }} />
                </span>
              </button>

              {/* Client messages */}
              <div>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquareText size={16} color="var(--accent-text)" strokeWidth={2} /> {t('chat.title')}
                  {inboxUnread > 0 && (
                    <span style={{ background: '#0ABAB5', color: '#080808', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{inboxUnread}</span>
                  )}
                </h2>
                <SpecialistInbox specialistId={myListing.id} onOpen={setOpenChat} onUnreadChange={setInboxUnread} />
              </div>

              {/* Upcoming sessions */}
              <div>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color="var(--accent-text)" strokeWidth={2} /> {t('dash.upcoming')}
                </h2>
                {ordersLoading && <Loader2 className="spin" size={18} color="var(--accent-text)" strokeWidth={2} />}
                {!ordersLoading && upcomingOrders.length === 0 && (
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),0.4)' }}>{t('dash.noUpcoming')}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcomingOrders.map(order => {
                    const [dayNum, monthDay] = formatDate(order.date).split(' ')
                    return (
                      <div key={order.id} className="glass" style={{ borderRadius: 18, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center', border: '1px solid rgba(var(--fg-rgb),0.08)' }}>
                        <div style={{
                          flexShrink: 0, textAlign: 'center', padding: '8px 10px', borderRadius: 12,
                          background: 'rgba(10,186,181,0.1)', border: '1px solid rgba(10,186,181,0.2)', minWidth: 52,
                        }}>
                          <p style={{ margin: '0 0 1px', fontSize: 11, color: 'var(--accent-text)', fontWeight: 700 }}>{monthDay}</p>
                          <p style={{ margin: '0 0 1px', fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>{dayNum}</p>
                          <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg-rgb),0.45)' }}>{order.bookingSlot}</p>
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.clientName}</p>
                          <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),0.5)' }}>{localizeService(order.service)}</p>
                        </div>
                        <button
                          onClick={() => handleMarkCompleted(order.id)}
                          style={{ padding: '6px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(10,186,181,0.15)', color: 'var(--accent-text)', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                        >
                          {t('dash.markDone')}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent completed orders */}
              <div>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="var(--accent-text)" strokeWidth={2} /> {t('dash.completed')}
                </h2>
                {myOrders.filter(o => o.status === 'completed').length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),0.4)' }}>{t('dash.noCompleted')}</p>
                ) : (
                  <div className="glass" style={{ borderRadius: 18, padding: 4 }}>
                    {myOrders.filter(o => o.status === 'completed').map(order => (
                      <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(var(--fg-rgb),0.05)' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{order.clientName}</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),0.4)' }}>{localizeService(order.service)} · {formatDate(order.date)}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-text)' }}>{formatNumber(order.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile completeness */}
              <div style={{ paddingBottom: 20 }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={16} color="var(--accent-text)" strokeWidth={2} /> {t('dash.profile')}
                </h2>
                <div className="glass" style={{ borderRadius: 18, padding: 18, border: '1px solid rgba(var(--fg-rgb),0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{t('dash.completeness')}</p>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--accent-text)' }}>{completeness}%</p>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(var(--fg-rgb),0.1)', marginBottom: 14 }}>
                    <div style={{ width: `${completeness}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #0ABAB5, #08918d)' }} />
                  </div>
                  {profileChecklist.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: item.done ? 'rgba(74,222,128,0.2)' : 'rgba(var(--fg-rgb),0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.done && <CheckCircle2 size={13} color="var(--ok)" strokeWidth={2.5} />}
                      </span>
                      <span style={{ fontSize: 13, color: item.done ? 'rgba(var(--fg-rgb),0.7)' : 'rgba(var(--fg-rgb),0.4)' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showSettings && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="glass slide-up"
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
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(var(--fg-rgb),0.5)', fontWeight: 600 }}>{t('dash.language')}</p>
              <LanguageSwitcher />
              <p style={{ margin: '14px 0 8px', fontSize: 12, color: 'rgba(var(--fg-rgb),0.5)', fontWeight: 600 }}>{t('dash.theme')}</p>
              <ThemeSwitcher />
            </div>

            <button
              onClick={toggleNotifications}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 4px', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(var(--fg-rgb),0.08)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <Bell size={17} color="rgba(var(--fg-rgb),0.7)" strokeWidth={1.8} />
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
                <FileText size={17} color="rgba(var(--fg-rgb),0.7)" strokeWidth={1.8} />
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
              <LogOut size={17} color="rgba(var(--fg-rgb),0.7)" strokeWidth={1.8} />
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
      )}
    </div>
  )
}
