import { useState, useEffect } from 'react'
import { SUBSCRIPTIONS, AVAILABLE_SLOTS, formatPrice } from '../data'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useSpecialists } from '../specialistsData'
import { fetchBookedSlotsInRange } from '../lib/queries'
import { isClickConfigured, isPaymeConfigured, buildClickPaymentUrl, buildPaymePaymentUrl } from '../lib/payments'
import { ArrowLeft, ChevronLeft, ChevronRight, CreditCard, Wallet, Landmark, Lock, PartyPopper, AlertCircle, SUBSCRIPTION_ICONS } from '../icons'

interface Props {
  specialistId: string
  onNavigate: (screen: Screen) => void
  onBack: () => void
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const PAYMENT_METHODS = [
  { id: 'click',   label: 'Click',     icon: CreditCard, color: '#1B9CF0' },
  { id: 'payme',   label: 'Payme',     icon: Wallet,     color: '#1877F2' },
  { id: 'uzum',    label: 'Uzum Bank', icon: Landmark,   color: '#F5A623' },
  { id: 'visa',    label: 'Visa',      icon: CreditCard, color: '#1A1F71' },
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export default function BookingScreen({ specialistId, onNavigate, onBack }: Props) {
  const { specialists } = useSpecialists()
  const sp = specialists.find(s => s.id === specialistId)
  const { confirmBooking, createPendingOrder } = useAppStore()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedSub, setSelectedSub] = useState(SUBSCRIPTIONS[0].id)
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_METHODS[0].id)
  const [booked, setBooked] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [step, setStep] = useState<'date' | 'sub' | 'pay'>('date')
  const [bookedByDate, setBookedByDate] = useState<Record<string, string[]>>({})
  const [slotsLoading, setSlotsLoading] = useState(true)

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  useEffect(() => {
    if (!sp) return
    let cancelled = false
    setSlotsLoading(true)
    const startKey = `${viewYear}-${pad2(viewMonth + 1)}-01`
    const endKey = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(daysInMonth)}`
    fetchBookedSlotsInRange(sp.id, startKey, endKey)
      .then(data => {
        if (!cancelled) setBookedByDate(data)
      })
      .catch(err => console.error('Failed to load booked slots', err))
      .finally(() => {
        if (!cancelled) setSlotsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.id, viewYear, viewMonth])

  if (!sp) return null

  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7 // Monday-start
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const dayKey = (day: number) => `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`

  const isPast = (day: number) => {
    const d = new Date(viewYear, viewMonth, day)
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return d < t
  }
  const isBusy = (day: number) => {
    if (isPast(day)) return true
    const taken = bookedByDate[dayKey(day)] ?? []
    return taken.length >= AVAILABLE_SLOTS.length
  }
  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate()

  const canGoPrevMonth = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth())

  function goPrevMonth() {
    if (!canGoPrevMonth) return
    const base = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    setSelectedDay(null)
    setSelectedSlot(null)
  }
  function goNextMonth() {
    const base = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    setSelectedDay(null)
    setSelectedSlot(null)
  }

  const sub = SUBSCRIPTIONS.find(s => s.id === selectedSub) ?? SUBSCRIPTIONS[0]
  const dateLabel = selectedDay ? `${MONTH_NAMES[viewMonth].slice(0, 3)} ${selectedDay}, ${viewYear}` : '—'
  const dateKey = selectedDay ? dayKey(selectedDay) : ''
  const takenSlotsForSelectedDay = selectedDay ? (bookedByDate[dateKey] ?? []) : []
  const availableSlots = AVAILABLE_SLOTS.filter(slot => !takenSlotsForSelectedDay.includes(slot))

  const useRealGateway =
    (selectedPayment === 'click' && isClickConfigured) ||
    (selectedPayment === 'payme' && isPaymeConfigured)

  async function handleConfirm() {
    if (!selectedDay || !selectedSlot || confirming) return
    setConfirming(true)
    setConfirmError(null)

    if (useRealGateway) {
      const result = await createPendingOrder({
        specialistId,
        dateKey,
        slot: selectedSlot,
        serviceName: sub.name,
        amount: sub.price,
      })
      setConfirming(false)

      if ('error' in result) {
        setConfirmError(result.error)
        setBookedByDate(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] ?? []), selectedSlot] }))
        setSelectedSlot(null)
        return
      }

      const returnUrl = window.location.origin
      const paymentUrl = selectedPayment === 'click'
        ? buildClickPaymentUrl(result.order.id, sub.price, returnUrl)
        : buildPaymePaymentUrl(result.order.id, sub.price, returnUrl)
      window.location.href = paymentUrl
      return
    }

    const result = await confirmBooking({
      specialistId,
      dateKey,
      slot: selectedSlot,
      serviceName: sub.name,
      amount: sub.price,
    })
    setConfirming(false)

    if ('error' in result) {
      setConfirmError(result.error)
      // Someone else may have just taken this slot — refresh so the calendar reflects reality.
      setBookedByDate(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] ?? []), selectedSlot] }))
      setSelectedSlot(null)
      return
    }

    setBooked(true)
    setTimeout(() => onNavigate({ name: 'chat', conversationId: result.conversationId }), 2200)
  }

  if (booked) {
    return (
      <div style={{
        background: '#080808', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center',
      }}>
        <div className="slide-up" style={{ marginBottom: 8 }}>
          <PartyPopper size={64} color="#0ABAB5" strokeWidth={1.5} />
        </div>
        <h2 className="slide-up gradient-text" style={{ margin: 0, fontSize: 28, fontWeight: 900, animationDelay: '0.1s' }}>
          Booking Confirmed!
        </h2>
        <p className="slide-up" style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, animationDelay: '0.2s' }}>
          Your session with <strong style={{ color: 'white' }}>{sp.name}</strong> is booked for<br />
          <strong style={{ color: '#0ABAB5' }}>{dateLabel}, {selectedSlot}</strong>
        </p>
        <p className="slide-up" style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)', animationDelay: '0.3s' }}>
          Opening chat...
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: '#080808', minHeight: '100%', paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ padding: '52px 20px 20px', background: 'linear-gradient(180deg, #0f1410 0%, #080808 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
              width: 40, height: 40, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Book a Session</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>with {sp.name}</p>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(['date', 'sub', 'pay'] as const).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                onClick={() => {
                  if (s === 'sub' && !selectedDay) return
                  if (s === 'pay' && !selectedSlot) return
                  setStep(s)
                }}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: step === s ? '#0ABAB5' : (
                    (s === 'sub' && (step === 'pay' || (step === 'sub'))) ||
                    (s === 'date')
                      ? 'rgba(10,186,181,0.2)'
                      : 'rgba(255,255,255,0.1)'
                  ),
                  color: step === s ? '#080808' : '#0ABAB5',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {i + 1}
              </div>
              <span style={{ fontSize: 12, color: step === s ? 'white' : 'rgba(255,255,255,0.4)', fontWeight: step === s ? 600 : 400 }}>
                {s === 'date' ? 'Date & Time' : s === 'sub' ? 'Service' : 'Payment'}
              </span>
              {i < 2 && <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Step: Date */}
      {step === 'date' && (
        <div style={{ padding: '0 20px' }} className="fade-in">
          <div className="glass" style={{ borderRadius: 20, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button
                onClick={goPrevMonth}
                disabled={!canGoPrevMonth}
                style={{
                  background: 'none', border: 'none',
                  color: canGoPrevMonth ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                  cursor: canGoPrevMonth ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
                }}
              >
                <ChevronLeft size={20} strokeWidth={2} />
              </button>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
                {slotsLoading && <span className="spin" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(10,186,181,0.3)', borderTopColor: '#0ABAB5', borderRadius: '50%' }} />}
              </h3>
              <button
                onClick={goNextMonth}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4,
                }}
              >
                <ChevronRight size={20} strokeWidth={2} />
              </button>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', padding: '4px 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />
                const busy = isBusy(day)
                const today = isToday(day)
                const sel = selectedDay === day
                return (
                  <button
                    key={idx}
                    disabled={busy}
                    onClick={() => { setSelectedDay(day); setSelectedSlot(null) }}
                    style={{
                      aspectRatio: '1', borderRadius: 10, border: sel ? '2px solid #0ABAB5' : today ? '2px solid rgba(10,186,181,0.4)' : '2px solid transparent',
                      background: sel ? '#0ABAB5' : busy ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                      color: sel ? '#080808' : busy ? 'rgba(255,255,255,0.2)' : 'white',
                      fontSize: 13, fontWeight: sel ? 800 : 500,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      textDecoration: busy ? 'line-through' : 'none',
                      fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { color: '#0ABAB5', label: 'Available' },
                { color: 'rgba(255,255,255,0.15)', label: 'Busy' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Time slots */}
          {selectedDay && (
            <div className="slide-up">
              <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
                Available times — {dateLabel}
              </h3>
              {availableSlots.length === 0 && (
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  All slots on this day are already booked. Pick another date.
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {availableSlots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    style={{
                      padding: '14px 0', borderRadius: 14, border: 'none', fontSize: 15, fontWeight: 700,
                      fontFamily: 'Outfit, sans-serif',
                      background: selectedSlot === slot ? '#0ABAB5' : 'rgba(255,255,255,0.07)',
                      color: selectedSlot === slot ? '#080808' : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step: Service */}
      {step === 'sub' && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }} className="fade-in">
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Choose your plan</p>
          {SUBSCRIPTIONS.map(s => {
            const SubIcon = SUBSCRIPTION_ICONS[s.level]
            return (
            <button
              key={s.id}
              onClick={() => setSelectedSub(s.id)}
              style={{
                borderRadius: 18, padding: '16px 18px', border: 'none',
                background: selectedSub === s.id
                  ? 'linear-gradient(135deg, rgba(10,186,181,0.2) 0%, rgba(10,186,181,0.05) 100%)'
                  : 'rgba(255,255,255,0.05)',
                borderColor: selectedSub === s.id ? '#0ABAB5' : 'rgba(255,255,255,0.08)',
                borderStyle: 'solid', borderWidth: 1,
                textAlign: 'left', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {(s as any).popular && (
                <div style={{
                  position: 'absolute', top: -1, right: 14,
                  background: '#0ABAB5', color: '#080808',
                  fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: '0 0 8px 8px',
                }}>
                  POPULAR
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selectedSub === s.id ? 'rgba(10,186,181,0.2)' : 'rgba(255,255,255,0.06)',
                }}>
                  <SubIcon size={20} color={selectedSub === s.id ? '#0ABAB5' : 'rgba(255,255,255,0.6)'} strokeWidth={1.8} />
                </span>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: 'white' }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{s.description}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: selectedSub === s.id ? '#0ABAB5' : 'white' }}>
                  {new Intl.NumberFormat().format(s.price)}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>UZS</p>
              </div>
            </button>
          )})}
        </div>
      )}

      {/* Step: Payment */}
      {step === 'pay' && (
        <div style={{ padding: '0 20px' }} className="fade-in">
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Payment method</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
            {PAYMENT_METHODS.map(pm => {
              const PmIcon = pm.icon
              const live = (pm.id === 'click' && isClickConfigured) || (pm.id === 'payme' && isPaymeConfigured)
              return (
                <button
                  key={pm.id}
                  onClick={() => setSelectedPayment(pm.id)}
                  style={{
                    position: 'relative',
                    padding: '16px 12px', borderRadius: 16, border: 'none',
                    background: selectedPayment === pm.id ? 'rgba(10,186,181,0.15)' : 'rgba(255,255,255,0.05)',
                    borderColor: selectedPayment === pm.id ? '#0ABAB5' : 'rgba(255,255,255,0.08)',
                    borderStyle: 'solid', borderWidth: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {!live && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8, fontSize: 8, fontWeight: 800,
                      color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      Demo
                    </span>
                  )}
                  <PmIcon size={22} color={selectedPayment === pm.id ? '#0ABAB5' : pm.color} strokeWidth={1.8} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: selectedPayment === pm.id ? '#0ABAB5' : 'white' }}>{pm.label}</span>
                </button>
              )
            })}
          </div>

          {/* Order summary */}
          <div className="glass" style={{ borderRadius: 18, padding: 18, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Order Summary</h3>
            {[
              { label: 'Specialist', value: sp.name },
              { label: 'Date', value: dateLabel },
              { label: 'Time', value: selectedSlot ?? '—' },
              { label: 'Service', value: sub.name },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#0ABAB5' }}>{formatPrice(sub.price)}</span>
            </div>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 5 }}>
            <Lock size={12} style={{ flexShrink: 0, marginTop: 2 }} strokeWidth={2} />
            <span>
              {useRealGateway
                ? `You'll be redirected to ${selectedPayment === 'click' ? 'Click' : 'Payme'} to complete payment securely.`
                : 'Demo mode: no real charge happens. Payment is simulated as held by Whale until the session is completed.'}
            </span>
          </p>

          {confirmError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
              padding: '10px 14px', borderRadius: 12, background: 'rgba(255,77,109,0.1)',
              border: '1px solid rgba(255,77,109,0.25)',
            }}>
              <AlertCircle size={16} color="#ff4d6d" strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#ff4d6d' }}>{confirmError}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom nav buttons */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        padding: '16px 20px 32px',
        background: 'linear-gradient(to top, #080808 60%, transparent)',
        zIndex: 50,
      }}>
        {step === 'date' && (
          <button
            onClick={() => setStep('sub')}
            disabled={!selectedDay || !selectedSlot}
            className={selectedDay && selectedSlot ? 'tiffany-glow' : ''}
            style={{
              width: '100%', padding: '16px', borderRadius: 18, border: 'none',
              background: selectedDay && selectedSlot ? '#0ABAB5' : 'rgba(255,255,255,0.1)',
              color: selectedDay && selectedSlot ? '#080808' : 'rgba(255,255,255,0.3)',
              fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
              cursor: selectedDay && selectedSlot ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {selectedDay && selectedSlot ? `Continue — ${dateLabel}, ${selectedSlot}` : 'Select a date & time'}
          </button>
        )}
        {step === 'sub' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('date')} className="glass" style={{ padding: '16px 18px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.15)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={18} strokeWidth={2} /></button>
            <button
              onClick={() => setStep('pay')}
              className="tiffany-glow"
              style={{ flex: 1, padding: '16px', borderRadius: 18, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}
            >
              Continue — {formatPrice(sub.price)}
            </button>
          </div>
        )}
        {step === 'pay' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('sub')} disabled={confirming} className="glass" style={{ padding: '16px 18px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.15)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={18} strokeWidth={2} /></button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className={confirming ? '' : 'tiffany-glow'}
              style={{
                flex: 1, padding: '16px', borderRadius: 18, border: 'none',
                background: '#0ABAB5', color: '#080808', fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
                opacity: confirming ? 0.7 : 1, cursor: confirming ? 'wait' : 'pointer',
              }}
            >
              {confirming
                ? (useRealGateway ? 'Redirecting…' : 'Confirming…')
                : useRealGateway
                  ? `Continue to ${selectedPayment === 'click' ? 'Click' : 'Payme'} →`
                  : `Pay ${formatPrice(sub.price)} → (demo)`}
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
