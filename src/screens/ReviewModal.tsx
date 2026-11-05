import { useState } from 'react'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { createReview } from '../lib/queries'
import { Star, X } from '../icons'

interface Props {
  orderId: string
  specialistId: string
  specialistName: string
  onClose: () => void
  onSubmitted: () => void
}

function StarPicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            style={{ background: 'none', border: 'none', padding: 2, display: 'flex' }}
          >
            <Star size={22} color="#FFD700" fill={n <= value ? '#FFD700' : 'none'} strokeWidth={1.8} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ReviewModal({ orderId, specialistId, specialistName, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const { notify } = useToast()
  const [rating, setRating] = useState(5)
  const [quality, setQuality] = useState(5)
  const [timing, setTiming] = useState(5)
  const [communication, setCommunication] = useState(5)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!user || busy) return
    const trimmed = text.trim()
    if (trimmed.length < 5) {
      notify('Please write a few words about your experience.')
      return
    }
    setBusy(true)
    try {
      await createReview(user.id, { orderId, specialistId, rating, quality, timing, communication, text: trimmed })
      notify('Thank you — your review is published.', 'success')
      onSubmitted()
    } catch (err) {
      const code = (err as { code?: string }).code
      notify(code === '23505' ? 'You have already reviewed this order.' : 'Could not publish your review. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${specialistName}`}
        className="glass slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430, borderRadius: '24px 24px 0 0', padding: '20px 20px 32px',
          border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', background: 'rgba(10,10,10,0.97)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Review {specialistName}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <StarPicker label="Overall" value={rating} onChange={setRating} />
        <StarPicker label="Quality" value={quality} onChange={setQuality} />
        <StarPicker label="Timing" value={timing} onChange={setTiming} />
        <StarPicker label="Communication" value={communication} onChange={setCommunication} />

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={1500}
          rows={4}
          placeholder="How was your experience?"
          style={{
            width: '100%', marginTop: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', resize: 'vertical',
          }}
        />

        <button
          onClick={submit}
          disabled={busy}
          className={busy ? '' : 'tiffany-glow'}
          style={{
            width: '100%', marginTop: 14, padding: '14px 0', borderRadius: 14, border: 'none',
            background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
            opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? 'Publishing…' : 'Publish review'}
        </button>
      </div>
    </div>
  )
}
