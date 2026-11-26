import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Specialist } from '../types'
import { categoryLabel, localizeService, formatOrderPrice, sumUzs } from '../data'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { useConfirm } from '../confirm'
import { useSpecialists } from '../specialistsData'
import { useI18n, formatDate, formatNumber } from '../i18n'
import { subscribeToTables } from '../lib/realtime'
import {
  fetchMyListings, fetchSpecialistOrders, markOrderCompleted, setListingPublished, submitListingForReview,
  deleteMyListing, type SpecialistOrder, type InboxItem,
} from '../lib/queries'
import { Switch } from '../Controls'
import Sheet from '../Sheet'
import BecomeSpecialistForm from './BecomeSpecialistForm'
import ListingTools from './ListingTools'
import SpecialistCalendar from './SpecialistCalendar'
import { specialistSetOrderStatus, showSlot } from '../lib/schedule'
import { SpecialistInbox } from './SpecialistInbox'
import { Briefcase, Calendar, ClipboardList, Loader2, MessageSquareText, Phone, TrendingUp, Trash2, Users, Wallet, type IconType } from '../icons'

const MOD_COLORS: Record<Specialist['moderationStatus'], string> = {
  pending: '#F5A623',
  approved: 'var(--ok)',
  rejected: '#ff4d6d',
  needs_changes: '#4DB5E6',
}

function Stat({ icon: Icon, label, value, accent }: { icon: IconType; label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass" style={{ borderRadius: 18, padding: '16px 14px', border: accent ? '1px solid rgba(10,186,181,0.3)' : undefined }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: accent ? 'rgba(10,186,181,0.15)' : 'rgba(var(--fg-rgb),0.06)' }}>
        <Icon size={16} color={accent ? 'var(--accent-text)' : 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))'} strokeWidth={1.8} />
      </div>
      <p style={{ margin: '0 0 2px', fontSize: 21, fontWeight: 900, color: accent ? 'var(--accent-text)' : 'var(--ink)' }}>{value}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{label}</p>
    </div>
  )
}

const sectionTitle = { margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 } as const
const mutedText = { margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' } as const

/** The owner's cabinet: several listings, moderation status, incoming orders and messages. */
export default function SpecialistWorkspace({ onOpenChat }: { onOpenChat: (item: InboxItem) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { notify } = useToast()
  const confirm = useConfirm()
  const { reload: reloadSpecialists } = useSpecialists()

  const [listings, setListings] = useState<Specialist[] | undefined>(undefined) // undefined = loading
  const [orders, setOrders] = useState<SpecialistOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [inboxUnread, setInboxUnread] = useState(0)

  const loadListings = useCallback(() => {
    if (!user) return
    fetchMyListings(user.id)
      .then(setListings)
      .catch(err => {
        console.error('Failed to load listings', err)
        setListings(prev => prev ?? [])
      })
  }, [user])

  useEffect(() => {
    loadListings()
    return subscribeToTables(['specialists', 'orders'], loadListings)
  }, [loadListings])

  const ids = useMemo(() => (listings ?? []).map(l => l.id), [listings])
  const nameById = useMemo(() => Object.fromEntries((listings ?? []).map(l => [l.id, l.name])), [listings])

  const loadOrders = useCallback(() => {
    if (ids.length === 0) {
      setOrders([])
      return
    }
    setOrdersLoading(true)
    fetchSpecialistOrders(ids, nameById)
      .then(setOrders)
      .catch(err => console.error('Failed to load orders', err))
      .finally(() => setOrdersLoading(false))
  }, [ids, nameById])

  useEffect(() => {
    loadOrders()
    return subscribeToTables(['orders'], loadOrders)
  }, [loadOrders])

  function replaceListing(sp: Specialist) {
    setListings(prev => (prev ?? []).map(l => (l.id === sp.id ? sp : l)))
    reloadSpecialists()
  }

  async function togglePublished(l: Specialist) {
    setBusyId(l.id)
    try {
      replaceListing(await setListingPublished(l.id, !l.published))
    } catch (err) {
      console.error(err)
      notify(t('err.availability'))
    } finally {
      setBusyId(null)
    }
  }

  async function resubmit(l: Specialist) {
    setBusyId(l.id)
    try {
      await submitListingForReview(l.id)
      notify(t('mod.resubmitted'), 'success')
      loadListings()
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(l: Specialist) {
    const ok = await confirm({ title: t('listings.deleteTitle'), message: t('listings.deleteText'), confirmLabel: t('listings.delete'), danger: true })
    if (!ok) return
    setBusyId(l.id)
    try {
      await deleteMyListing(l.id)
      notify(t('listings.deleted'), 'success')
      setOpenId(null)
      loadListings()
      reloadSpecialists()
    } catch (err) {
      const msg = (err as { message?: string }).message ?? ''
      notify(/has orders/i.test(msg) ? t('listings.hasOrders') : t('err.updateSession'))
    } finally {
      setBusyId(null)
    }
  }

  const [busyOrder, setBusyOrder] = useState<string | null>(null)
  async function decide(orderId: string, status: 'confirmed' | 'cancelled') {
    if (status === 'cancelled') {
      const ok = await confirm({ title: t('cal.declineTitle'), confirmLabel: t('cal.decline'), danger: true })
      if (!ok) return
    }
    setBusyOrder(orderId)
    try {
      await specialistSetOrderStatus(orderId, status)
      notify(status === 'confirmed' ? t('cal.confirmed') : t('cal.declined'), 'success')
      loadOrders()
    } catch (err) {
      console.error(err)
      notify((err as { code?: string }).code === '23505' ? t('cal.slotTaken') : t('err.updateSession'))
    } finally {
      setBusyOrder(null)
    }
  }

  async function markDone(orderId: string) {
    try {
      await markOrderCompleted(orderId)
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: 'completed' } : o)))
      notify(t('toast.sessionDone'), 'success')
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    }
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const upcomingOrders = orders.filter(o => o.status === 'confirmed')
  const completedOrders = orders.filter(o => o.status === 'completed')
  const totalIncome = sumUzs(completedOrders)
  const clientCount = new Set(orders.map(o => o.clientName)).size

  if (listings === undefined) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Loader2 className="spin" size={26} color="var(--accent-text)" strokeWidth={2} /></div>
  }

  return (
    <>
      {listings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <Stat icon={Wallet} label={t('dash.totalIncome')} value={(totalIncome / 1_000_000).toFixed(2) + 'M'} accent />
          <Stat icon={ClipboardList} label={t('orders.new')} value={String(pendingOrders.length)} />
          <Stat icon={Briefcase} label={t('listings.count')} value={String(listings.length)} />
          <Stat icon={Users} label={t('dash.clients')} value={String(clientCount)} />
        </div>
      )}

      {/* My listings */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ ...sectionTitle, margin: 0 }}><Briefcase size={16} color="var(--accent-text)" strokeWidth={2} /> {t('listings.title')}</h2>
          <button onClick={() => setCreating(true)} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 12, fontWeight: 800 }}>+ {t('listings.add')}</button>
        </div>

        {listings.length === 0 && (
          <div className="glass" style={{ borderRadius: 18, padding: 18 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.6, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>{t('listings.empty')}</p>
            <button onClick={() => setCreating(true)} className="tiffany-glow" style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800 }}>{t('form.create')}</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {listings.map(l => {
            const color = MOD_COLORS[l.moderationStatus]
            const open = openId === l.id
            const busy = busyId === l.id
            return (
              <div key={l.id} className="glass pop-in" style={{ borderRadius: 18, padding: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <img src={l.avatar} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>
                      {categoryLabel(l.categoryKey)} · {l.city} · {formatNumber(l.price)} {t('common.uzs')}
                    </p>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color, background: 'rgba(var(--fg-rgb),0.06)', flexShrink: 0 }}>
                    {t(`mod.${l.moderationStatus}` as 'mod.pending')}
                  </span>
                </div>

                {l.moderationStatus === 'pending' && (
                  <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>{t('mod.pendingHint')}</p>
                )}
                {(l.moderationStatus === 'rejected' || l.moderationStatus === 'needs_changes') && (
                  <div style={{ margin: '10px 0 0', padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--fg-rgb),0.05)', borderLeft: `3px solid ${color}` }}>
                    <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color }}>{t('mod.reason')}</p>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{l.moderationComment}</p>
                  </div>
                )}

                {l.moderationStatus === 'approved' && (
                  <div style={{ marginTop: 10 }}>
                    <Switch checked={l.published} onChange={() => !busy && togglePublished(l)}>{t('listings.visible')}</Switch>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => setOpenId(open ? null : l.id)} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>
                    {open ? t('listings.close') : t('listings.manage')}
                  </button>
                  {(l.moderationStatus === 'rejected' || l.moderationStatus === 'needs_changes') && (
                    <button disabled={busy} onClick={() => resubmit(l)} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 800, background: '#0ABAB5', color: '#080808', opacity: busy ? 0.6 : 1 }}>{t('mod.resubmit')}</button>
                  )}
                  <button disabled={busy} onClick={() => remove(l)} aria-label={t('listings.delete')} style={{ padding: '8px 12px', borderRadius: 20, border: 'none', background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', display: 'inline-flex', alignItems: 'center' }}>
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>

                {open && (
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(var(--fg-rgb),0.08)' }}>
                    <ListingTools listing={l} onChange={replaceListing} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* My calendar */}
      {listings.length > 0 && <SpecialistCalendar listings={listings} orders={orders} onOrdersChanged={loadOrders} />}

      {/* New requests */}
      {listings.length > 0 && (
        <div>
          <h2 style={sectionTitle}><ClipboardList size={16} color="var(--accent-text)" strokeWidth={2} /> {t('orders.new')}</h2>
          {ordersLoading && pendingOrders.length === 0 && <Loader2 className="spin" size={18} color="var(--accent-text)" strokeWidth={2} />}
          {!ordersLoading && pendingOrders.length === 0 && <p style={mutedText}>{t('orders.noNew')}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingOrders.map(o => (
              <div key={o.id} className="glass" style={{ borderRadius: 18, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{o.clientName}</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-text)' }}>{formatOrderPrice(o)}</p>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(var(--fg-rgb),calc(0.65 * var(--tb)))' }}>
                  {o.specialistName && <>{o.specialistName} · </>}{formatDate(o.date)}, {showSlot(o.bookingSlot)} · {localizeService(o.service)}
                </p>
                {o.note && <p style={{ margin: '8px 0 0', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5, background: 'rgba(var(--fg-rgb),0.05)', overflowWrap: 'anywhere' }}>{o.note}</p>}
                {o.phone && (
                  <a href={`tel:${o.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none' }}>
                    <Phone size={13} strokeWidth={2.2} /> {o.phone}
                  </a>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button disabled={busyOrder === o.id} onClick={() => decide(o.id, 'confirmed')} style={{ padding: '8px 14px', borderRadius: 18, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 12, fontWeight: 800 }}>{t('cal.confirm')}</button>
                  <button disabled={busyOrder === o.id} onClick={() => decide(o.id, 'cancelled')} style={{ padding: '8px 14px', borderRadius: 18, border: 'none', background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', fontSize: 12, fontWeight: 800 }}>{t('cal.decline')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client messages */}
      {listings.length > 0 && (
        <div>
          <h2 style={sectionTitle}>
            <MessageSquareText size={16} color="var(--accent-text)" strokeWidth={2} /> {t('chat.title')}
            {inboxUnread > 0 && <span style={{ background: '#0ABAB5', color: '#080808', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{inboxUnread}</span>}
          </h2>
          <SpecialistInbox specialistIds={ids} onOpen={onOpenChat} onUnreadChange={setInboxUnread} />
        </div>
      )}

      {/* Upcoming */}
      {listings.length > 0 && (
        <div>
          <h2 style={sectionTitle}><Calendar size={16} color="var(--accent-text)" strokeWidth={2} /> {t('dash.upcoming')}</h2>
          {upcomingOrders.length === 0 && <p style={mutedText}>{t('dash.noUpcoming')}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcomingOrders.map(o => {
              const [dayNum, monthDay] = formatDate(o.date).split(' ')
              return (
                <div key={o.id} className="glass" style={{ borderRadius: 18, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ flexShrink: 0, textAlign: 'center', padding: '8px 10px', borderRadius: 12, background: 'rgba(10,186,181,0.1)', border: '1px solid rgba(10,186,181,0.2)', minWidth: 52 }}>
                    <p style={{ margin: '0 0 1px', fontSize: 11, color: 'var(--accent-text)', fontWeight: 700 }}>{monthDay}</p>
                    <p style={{ margin: '0 0 1px', fontSize: 16, fontWeight: 900 }}>{dayNum}</p>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{showSlot(o.bookingSlot)}</p>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.clientName}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{o.specialistName && <>{o.specialistName} · </>}{localizeService(o.service)}</p>
                  </div>
                  <button onClick={() => markDone(o.id)} style={{ padding: '6px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(10,186,181,0.15)', color: 'var(--accent-text)', border: 'none', flexShrink: 0 }}>{t('dash.markDone')}</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {listings.length > 0 && (
        <div style={{ paddingBottom: 20 }}>
          <h2 style={sectionTitle}><TrendingUp size={16} color="var(--accent-text)" strokeWidth={2} /> {t('dash.completed')}</h2>
          {completedOrders.length === 0 ? <p style={mutedText}>{t('dash.noCompleted')}</p> : (
            <div className="glass" style={{ borderRadius: 18, padding: 4 }}>
              {completedOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(var(--fg-rgb),0.05)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{o.clientName}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{localizeService(o.service)} · {formatDate(o.date)}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-text)' }}>{formatOrderPrice(o)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <Sheet title={t('listings.add')} onClose={() => setCreating(false)}>
          <BecomeSpecialistForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false)
              loadListings()
              reloadSpecialists()
            }}
          />
        </Sheet>
      )}
    </>
  )
}

