import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useSpecialists } from '../specialistsData'
import { ClipboardList } from '../icons'

interface Props {
  onNavigate: (screen: Screen) => void
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#F5A623', bg: 'rgba(245,166,35,0.12)' },
  confirmed: { label: 'Confirmed', color: '#0ABAB5', bg: 'rgba(10,186,181,0.12)' },
  completed: { label: 'Done',      color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  cancelled: { label: 'Cancelled', color: '#ff4d6d', bg: 'rgba(255,77,109,0.12)' },
}

export default function BookingsScreen({ onNavigate }: Props) {
  const { orders } = useAppStore()
  const { specialists } = useSpecialists()

  return (
    <div style={{ background: '#080808', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, #0f1410 0%, #080808 100%)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>My Bookings</h1>
      </div>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'rgba(255,255,255,0.4)' }}>
          <ClipboardList size={44} color="rgba(255,255,255,0.25)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <p>No bookings yet.<br />Book a specialist to see it here.</p>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  border: '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <img src={sp.avatar} alt={sp.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#111' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'white' }}>{sp.name}</p>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{order.service}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{order.date}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'white' }}>
                    {new Intl.NumberFormat().format(order.amount)}
                  </p>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: status.bg, color: status.color,
                  }}>
                    {status.label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
