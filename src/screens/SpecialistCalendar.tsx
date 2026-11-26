import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Specialist } from '../types'
import type { SpecialistOrder } from '../lib/queries'
import { useI18n, formatDate, monthName, weekdayLabels } from '../i18n'
import { useToast } from '../toast'
import { useConfirm } from '../confirm'
import { Select } from '../Controls'
import { localizeService, formatOrderPrice } from '../data'
import {
  TIME_OPTIONS, addDaySlot, addWeekly, blockDay, deleteDaySlot, deleteWeekly, fetchSchedule, makeDayOwn, overlaps, resetDay,
  showSlot, slotRange, specialistSetOrderStatus, toMin, type Schedule,
} from '../lib/schedule'
import { Calendar, ChevronLeft, ChevronRight, Loader2, Lock, Phone, X } from '../icons'

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const isoDow = (y: number, m: number, d: number) => ((new Date(y, m, d).getDay() + 6) % 7) + 1

const card: React.CSSProperties = { borderRadius: 18, padding: 14 }
const smallBtn: React.CSSProperties = { padding: '7px 12px', borderRadius: 18, border: 'none', fontSize: 12, fontWeight: 800 }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 11px', borderRadius: 16, fontSize: 13, fontWeight: 700, background: 'rgba(10,186,181,0.12)', color: 'var(--accent-text)' }
const chipX: React.CSSProperties = { width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(var(--fg-rgb),0.1)', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

const DOT = { free: '#0ABAB5', blocked: '#ff4d6d', booked: '#F5A623', pending: '#4DB5E6' } as const

/** Start / end pickers and an "Add" button for one interval. */
function IntervalAdder({ onAdd, busy }: { onAdd: (start: string, end: string) => void; busy: boolean }) {
  const { t } = useI18n()
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('12:00')
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ width: 100 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('cal.from')}</span>
        <Select<string> value={start} onChange={setStart} options={TIME_OPTIONS.map(v => ({ value: v, label: v }))} ariaLabel={t('cal.from')} />
      </div>
      <div style={{ width: 100 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('cal.to')}</span>
        <Select<string> value={end} onChange={setEnd} options={TIME_OPTIONS.map(v => ({ value: v, label: v }))} ariaLabel={t('cal.to')} />
      </div>
      <button type="button" disabled={busy} onClick={() => onAdd(start, end)} style={{ ...smallBtn, padding: '11px 16px', background: '#0ABAB5', color: '#080808', opacity: busy ? 0.6 : 1 }}>
        {t('cal.add')}
      </button>
    </div>
  )
}

/**
 * "My calendar" of the specialist: month view with free / blocked / booked days, the intervals of a chosen
 * date (own or from the weekly schedule), blocking days, confirming requests, and the weekly working hours.
 */
export default function SpecialistCalendar({ listings, orders, onOrdersChanged }: {
  listings: Specialist[]
  orders: SpecialistOrder[]
  onOrdersChanged: () => void
}) {
  const { t } = useI18n()
  const { notify } = useToast()
  const confirm = useConfirm()
  const today = new Date()
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate())

  const [listingId, setListingId] = useState(listings[0]?.id ?? '')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<string>(todayKey)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!listings.some(l => l.id === listingId)) setListingId(listings[0]?.id ?? '')
  }, [listings, listingId])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const fromKey = keyOf(year, month, 1)
  const toKey = keyOf(year, month, daysInMonth)

  const load = useCallback(() => {
    if (!listingId) return
    fetchSchedule(listingId, fromKey, toKey)
      .then(setSchedule)
      .catch(err => { console.error('Failed to load schedule', err); setSchedule({ weekly: [], days: [], daySlots: [] }) })
  }, [listingId, fromKey, toKey])
  useEffect(() => { setSchedule(null); load() }, [load])

  const listingOrders = useMemo(() => orders.filter(o => o.specialistId === listingId && (o.status === 'pending' || o.status === 'confirmed')), [orders, listingId])
  const hasSchedule = !!schedule && (schedule.weekly.length > 0 || schedule.days.length > 0)

  /** Intervals offered on a date, and where they come from. */
  function dayInfo(key: string, dow: number) {
    const s = schedule!
    const own = s.days.find(d => d.day === key)
    if (own?.blocked) return { blocked: true, own: true, intervals: [] as { id: string; start: string; end: string }[] }
    if (own) return { blocked: false, own: true, intervals: s.daySlots.filter(x => x.day === key) }
    return { blocked: false, own: false, intervals: s.weekly.filter(w => w.weekday === dow) }
  }

  async function run(action: () => Promise<void>, okMsg?: string) {
    setBusy(true)
    try {
      await action()
      if (okMsg) notify(okMsg, 'success')
      load()
    } catch (err) {
      console.error(err)
      const msg = (err as { message?: string }).message ?? ''
      notify(/overlap/i.test(msg) ? t('cal.overlap') : t('cal.failed'))
    } finally {
      setBusy(false)
    }
  }

  function validRange(start: string, end: string) {
    if (toMin(end) <= toMin(start)) { notify(t('cal.badRange')); return false }
    return true
  }

  async function setOrder(orderId: string, status: 'confirmed' | 'cancelled') {
    if (status === 'cancelled') {
      const ok = await confirm({ title: t('cal.declineTitle'), confirmLabel: t('cal.decline'), danger: true })
      if (!ok) return
    }
    setBusy(true)
    try {
      await specialistSetOrderStatus(orderId, status)
      notify(status === 'confirmed' ? t('cal.confirmed') : t('cal.declined'), 'success')
      onOrdersChanged()
      load()
    } catch (err) {
      console.error(err)
      notify((err as { code?: string }).code === '23505' ? t('cal.slotTaken') : t('err.updateSession'))
    } finally {
      setBusy(false)
    }
  }

  if (listings.length === 0) return null

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const canPrev = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())
  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const [sy, sm, sd] = selected.split('-').map(Number)
  const selDow = isoDow(sy, sm - 1, sd)
  const info = schedule ? dayInfo(selected, selDow) : null
  const selOrders = listingOrders.filter(o => o.date === selected).sort((a, b) => slotRange(a.bookingSlot)[0] - slotRange(b.bookingSlot)[0])
  const selPast = selected < todayKey

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calendar size={16} color="var(--accent-text)" strokeWidth={2} /> {t('cal.title')}
      </h2>

      {listings.length > 1 && (
        <div style={{ marginBottom: 10 }}>
          <Select<string> value={listingId} onChange={setListingId} options={listings.map(l => ({ value: l.id, label: l.name }))} ariaLabel={t('cal.listing')} />
        </div>
      )}

      {schedule && !hasSchedule && (
        <p style={{ margin: '0 0 10px', padding: '10px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, background: 'rgba(245,166,35,0.1)', color: 'rgba(var(--fg-rgb),calc(0.75 * var(--tb)))' }}>{t('cal.legacyHint')}</p>
      )}

      <div className="cal-layout">
        {/* Month */}
        <div className="glass" style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button type="button" onClick={() => canPrev && shiftMonth(-1)} disabled={!canPrev} aria-label="‹" style={{ background: 'none', border: 'none', color: 'var(--ink)', opacity: canPrev ? 0.7 : 0.2, padding: 4 }}><ChevronLeft size={20} /></button>
            <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>{monthName(month)} {year}{!schedule && <Loader2 className="spin" size={14} />}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="›" style={{ background: 'none', border: 'none', color: 'var(--ink)', opacity: 0.7, padding: 4 }}><ChevronRight size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
            {weekdayLabels().map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const key = keyOf(year, month, day)
              const past = key < todayKey
              const di = schedule ? dayInfo(key, isoDow(year, month, day)) : null
              const dayOrders = listingOrders.filter(o => o.date === key)
              const dots: string[] = []
              if (di?.blocked) dots.push(DOT.blocked)
              else if (di && (di.intervals.length > 0 || !hasSchedule)) dots.push(DOT.free)
              if (dayOrders.some(o => o.status === 'confirmed')) dots.push(DOT.booked)
              if (dayOrders.some(o => o.status === 'pending')) dots.push(DOT.pending)
              const sel = key === selected
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(key)}
                  style={{
                    aspectRatio: '1', borderRadius: 10, border: sel ? '2px solid #0ABAB5' : key === todayKey ? '2px solid rgba(10,186,181,0.35)' : '2px solid transparent',
                    background: sel ? 'rgba(10,186,181,0.18)' : 'rgba(var(--fg-rgb),0.05)', color: 'var(--ink)', opacity: past ? 0.35 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 13, fontWeight: 600, padding: 0,
                  }}
                >
                  {day}
                  <span style={{ display: 'flex', gap: 2, height: 5 }}>{dots.map(c => <span key={c} style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />)}</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 10 }}>
            {([['free', t('cal.legend.free')], ['blocked', t('cal.legend.blocked')], ['booked', t('cal.legend.booked')], ['pending', t('cal.legend.pending')]] as const).map(([k, label]) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT[k] }} /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Selected day */}
        <div className="glass" style={card}>
          <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800 }}>{formatDate(selected)}</p>
          {info && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>
              {info.blocked ? t('cal.legend.blocked') : info.own ? t('cal.ownDay') : hasSchedule ? t('cal.followsWeekly') : ''}
            </p>
          )}

          {!info && <Loader2 className="spin" size={18} />}
          {info && info.blocked && (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Lock size={13} /> {t('cal.dayBlocked')}</p>
              {!selPast && <button type="button" disabled={busy} onClick={() => run(() => resetDay(listingId, selected))} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>{t('cal.unblockDay')}</button>}
            </>
          )}
          {info && !info.blocked && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {info.intervals.length === 0 && hasSchedule && <span style={{ fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('cal.noTime')}</span>}
                {info.intervals.map(iv => {
                  const range: [number, number] = [toMin(iv.start), toMin(iv.end)]
                  const taken = selOrders.find(o => o.status === 'confirmed' && overlaps(slotRange(o.bookingSlot), range))
                  return (
                    <span key={iv.id} style={{ ...chip, background: taken ? 'rgba(245,166,35,0.16)' : chip.background, color: taken ? '#C77F0A' : chip.color }}>
                      {iv.start}–{iv.end}
                      {!selPast && (
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={t('portfolio.remove')}
                          style={chipX}
                          onClick={() => run(async () => {
                            if (info.own) await deleteDaySlot(iv.id)
                            else await makeDayOwn(listingId, selected, info.intervals.filter(x => x.id !== iv.id))
                          })}
                        >
                          <X size={12} strokeWidth={2.4} />
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
              {!selPast && (
                <>
                  <IntervalAdder
                    busy={busy}
                    onAdd={(start, end) => validRange(start, end) && run(async () => {
                      if (!info.own) await makeDayOwn(listingId, selected, info.intervals)
                      await addDaySlot(listingId, selected, start, end)
                    })}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button type="button" disabled={busy} onClick={() => run(() => blockDay(listingId, selected))} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}>{t('cal.blockDay')}</button>
                    {info.own && <button type="button" disabled={busy} onClick={() => run(() => resetDay(listingId, selected))} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>{t('cal.resetDay')}</button>}
                  </div>
                </>
              )}
            </>
          )}

          {selOrders.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(var(--fg-rgb),0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{t('cal.orders')}</p>
              {selOrders.map(o => (
                <div key={o.id} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--fg-rgb),0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13.5 }}>{showSlot(o.bookingSlot)} · {o.clientName}</strong>
                    <span style={{ fontSize: 11, fontWeight: 800, color: o.status === 'confirmed' ? DOT.booked : DOT.pending }}>{o.status === 'confirmed' ? t('cal.booked') : t('cal.waiting')}</span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))' }}>{localizeService(o.service)} · {formatOrderPrice(o)}</p>
                  {o.note && <p style={{ margin: '4px 0 0', fontSize: 12, overflowWrap: 'anywhere' }}>{o.note}</p>}
                  {o.phone && <a href={`tel:${o.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 12.5, fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none' }}><Phone size={12} /> {o.phone}</a>}
                  {o.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button type="button" disabled={busy} onClick={() => setOrder(o.id, 'confirmed')} style={{ ...smallBtn, background: '#0ABAB5', color: '#080808' }}>{t('cal.confirm')}</button>
                      <button type="button" disabled={busy} onClick={() => setOrder(o.id, 'cancelled')} style={{ ...smallBtn, background: 'rgba(255,77,109,0.12)', color: '#ff4d6d' }}>{t('cal.decline')}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="glass" style={{ ...card, marginTop: 12 }}>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800 }}>{t('cal.weekly')}</p>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('cal.weeklyHint')}</p>
        {!schedule ? <Loader2 className="spin" size={18} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weekdayLabels().map((label, i) => {
              const wd = i + 1
              const list = schedule.weekly.filter(w => w.weekday === wd)
              return (
                <WeekdayRow
                  key={wd}
                  label={label}
                  intervals={list}
                  busy={busy}
                  onDelete={id => run(() => deleteWeekly(id))}
                  onAdd={(s, e) => validRange(s, e) && run(() => addWeekly(listingId, wd, s, e))}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function WeekdayRow({ label, intervals, busy, onDelete, onAdd }: {
  label: string
  intervals: { id: string; start: string; end: string }[]
  busy: boolean
  onDelete: (id: string) => void
  onAdd: (start: string, end: string) => void
}) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
      <strong style={{ width: 30, fontSize: 13, paddingTop: 6, flexShrink: 0 }}>{label}</strong>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {intervals.length === 0 && <span style={{ fontSize: 12.5, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', paddingTop: 5 }}>{t('cal.dayOff')}</span>}
          {intervals.map(iv => (
            <span key={iv.id} style={chip}>
              {iv.start}–{iv.end}
              <button type="button" disabled={busy} aria-label={t('portfolio.remove')} style={chipX} onClick={() => onDelete(iv.id)}><X size={12} strokeWidth={2.4} /></button>
            </span>
          ))}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} style={{ ...smallBtn, background: 'rgba(10,186,181,0.1)', color: 'var(--accent-text)' }}>+ {t('cal.addInterval')}</button>
          )}
        </div>
        {adding && <IntervalAdder busy={busy} onAdd={(s, e) => { onAdd(s, e); setAdding(false) }} />}
      </div>
    </div>
  )
}
