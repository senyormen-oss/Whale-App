import { useState } from 'react'
import { CATEGORIES } from '../data'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { CATEGORY_ICONS, LEVEL_ICONS, Bell, Search, BadgeCheck, Star, Sparkles, MessageSquareText, User, Briefcase } from '../icons'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

interface Props {
  onNavigate: (screen: Screen) => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Star size={12} color="#FFD700" fill="#FFD700" strokeWidth={0} />
      <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>{rating}</span>
    </span>
  )
}

function LevelBadge({ level }: { level: string }) {
  const cfg = LEVEL_ICONS[level as keyof typeof LEVEL_ICONS] ?? LEVEL_ICONS.bronze
  const Icon = cfg.icon
  return <Icon size={15} color={cfg.color} strokeWidth={2} />
}

export default function HomeScreen({ onNavigate }: Props) {
  const [searchValue, setSearchValue] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const { conversations, notificationsEnabled, markConversationRead } = useAppStore()
  const { specialists } = useSpecialists()
  const { user } = useAuth()
  const firstName = ((user?.user_metadata?.full_name as string) || '').trim().split(' ')[0] || 'there'

  const featured = specialists.filter(s => s.reviews > 0).sort((a, b) => b.rating - a.rating).slice(0, 5)
  const newOnes  = specialists.filter(s => s.isNew).slice(0, 4)
  const unreadConversations = conversations.filter(c => c.unread > 0)
  const hasNotifications = notificationsEnabled && unreadConversations.length > 0

  function openConversation(conversationId: string) {
    markConversationRead(conversationId)
    setShowNotifications(false)
    onNavigate({ name: 'chat', conversationId })
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    onNavigate({ name: 'search', query: searchValue.trim() || undefined })
  }

  return (
    <div style={{ background: '#080808', minHeight: '100%', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 24px', background: 'linear-gradient(180deg, #0f1410 0%, #080808 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {greeting()}
            </p>
            <h1 className="gradient-text" style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
              {firstName}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: showNotifications ? 'rgba(10,186,181,0.18)' : 'rgba(255,255,255,0.07)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}
            >
              <Bell size={19} color="white" strokeWidth={1.8} />
              {hasNotifications && (
                <span style={{
                  position: 'absolute', top: 8, right: 8, width: 8, height: 8,
                  borderRadius: '50%', background: '#0ABAB5', border: '2px solid #080808',
                }} />
              )}
            </button>

            {showNotifications && (
              <div
                className="glass fade-in"
                style={{
                  position: 'absolute', top: 52, right: 0, width: 280, zIndex: 200,
                  borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                  background: 'rgba(10,10,10,0.97)',
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Notifications</p>
                </div>
                {unreadConversations.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>You're all caught up</p>
                  </div>
                ) : (
                  unreadConversations.map(conv => {
                    const sp = specialists.find(s => s.id === conv.specialistId)
                    if (!sp) return null
                    return (
                      <button
                        key={conv.id}
                        onClick={() => openConversation(conv.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px', background: 'none', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', cursor: 'pointer',
                        }}
                      >
                        <MessageSquareText size={15} color="#0ABAB5" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 700, color: 'white' }}>{sp.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.lastMessage}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <div
              style={{
                width: 44, height: 44, borderRadius: '50%', border: '2px solid #0ABAB5',
                background: 'rgba(10,186,181,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <User size={20} color="#0ABAB5" strokeWidth={1.8} />
            </div>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch}>
          <div
            className="glass"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 18px', borderRadius: 16,
            }}
          >
            <Search size={17} color="rgba(255,255,255,0.5)" strokeWidth={1.8} />
            <input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Search specialists, skills..."
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'white', fontSize: 15, fontFamily: 'Outfit, sans-serif',
              }}
            />
            <button
              type="submit"
              style={{
                background: '#0ABAB5', border: 'none', borderRadius: 10,
                padding: '6px 14px', color: '#080808', fontWeight: 700, fontSize: 13,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              Find
            </button>
          </div>
        </form>
      </div>

      {/* Promo banner */}
      <div style={{ padding: '0 20px', marginBottom: 28 }}>
        <div
          className="fade-up"
          style={{
            borderRadius: 20, overflow: 'hidden', position: 'relative',
            background: 'linear-gradient(135deg, #0a2a29 0%, #0ABAB5 100%)',
            padding: '24px 20px', minHeight: 130,
          }}
        >
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              <Sparkles size={13} color="rgba(255,255,255,0.8)" strokeWidth={2} />
              VERIFIED SPECIALISTS
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>
              Book a creator<br />in a few taps
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 16 }}>
              Photo, video, SMM, design and more
            </div>
            <button
              onClick={() => onNavigate({ name: 'search' })}
              style={{
                background: 'white', border: 'none', borderRadius: 10,
                padding: '9px 18px', color: '#080808', fontWeight: 700, fontSize: 13,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              Browse Specialists →
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Categories</h2>
          <button
            onClick={() => onNavigate({ name: 'search' })}
            style={{ background: 'none', border: 'none', color: '#0ABAB5', fontSize: 13, fontWeight: 600 }}
          >
            See all
          </button>
        </div>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 20px' }}>
          {CATEGORIES.map(cat => {
            const Icon = CATEGORY_ICONS[cat.key]
            return (
              <button
                key={cat.key}
                onClick={() => onNavigate({ name: 'search', category: cat.key as any })}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 8, padding: '14px 18px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'white', cursor: 'pointer', minWidth: 78,
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span style={{
                  width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${cat.color}1a`,
                }}>
                  <Icon size={20} color={cat.color} strokeWidth={1.8} />
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8, textAlign: 'center', lineHeight: 1.3, maxWidth: 60 }}>
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {specialists.length === 0 && (
        <div style={{ padding: '0 20px', marginBottom: 32 }}>
          <div className="glass" style={{ borderRadius: 18, padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6 }}>
            No specialists yet. Be the first — open Profile → Specialist and create your listing.
          </div>
        </div>
      )}

      {/* Top Specialists */}
      {featured.length > 0 && (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={17} color="#FFD700" fill="#FFD700" strokeWidth={0} /> Top Specialists
          </h2>
          <button
            onClick={() => onNavigate({ name: 'search' })}
            style={{ background: 'none', border: 'none', color: '#0ABAB5', fontSize: 13, fontWeight: 600 }}
          >
            See all
          </button>
        </div>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 20px' }}>
          {featured.map(sp => (
            <button
              key={sp.id}
              onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
              style={{
                flexShrink: 0, width: 180, borderRadius: 20, overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', padding: 0, textAlign: 'left',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ position: 'relative' }}>
                {sp.cover ? (
                  <img
                    src={sp.cover}
                    alt={sp.name}
                    style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', background: '#111' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: 110, background: 'linear-gradient(135deg, #0a2a29 0%, #0ABAB5 100%)' }} />
                )}
                {sp.verified && (
                  <span
                    className="verified-pulse"
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: '#0ABAB5', borderRadius: '50%',
                      width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <BadgeCheck size={13} color="#080808" strokeWidth={2.5} />
                  </span>
                )}
                <img
                  src={sp.avatar}
                  alt=""
                  style={{
                    position: 'absolute', bottom: -16, left: 12,
                    width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid #0ABAB5', background: '#111',
                  }}
                />
              </div>
              <div style={{ padding: '22px 12px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'white' }}>{sp.name}</p>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{sp.category}</p>
                  </div>
                  <LevelBadge level={sp.level} />
                </div>
                <StarRating rating={sp.rating} />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#0ABAB5', fontWeight: 600 }}>
                  from {new Intl.NumberFormat().format(sp.price)} UZS
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* New Specialists */}
      {newOnes.length > 0 && (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={17} color="#0ABAB5" strokeWidth={2} /> New on Whale
          </h2>
        </div>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {newOnes.map(sp => (
            <button
              key={sp.id}
              onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
              className="glass"
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 18, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={sp.avatar}
                  alt={sp.name}
                  style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', background: '#111' }}
                />
                {sp.available && (
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 13, height: 13, borderRadius: '50%',
                    background: '#4ade80', border: '2px solid #080808',
                  }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white' }}>{sp.name}</p>
                  {sp.verified && <BadgeCheck size={14} color="#0ABAB5" strokeWidth={2} />}
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{sp.category} · {sp.city}</p>
                <StarRating rating={sp.rating} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#0ABAB5' }}>
                  {new Intl.NumberFormat().format(sp.price)}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>UZS</p>
              </div>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* Offer your services */}
      <div style={{ padding: '0 20px' }}>
        <div
          className="glass"
          style={{
            borderRadius: 20, padding: '20px',
            border: '1px solid rgba(10,186,181,0.25)',
            background: 'linear-gradient(135deg, rgba(10,186,181,0.08) 0%, rgba(10,186,181,0.03) 100%)',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,186,181,0.15)',
          }}>
            <Briefcase size={22} color="#0ABAB5" strokeWidth={1.8} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Offer your services</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            Are you a photographer, videographer, designer or marketer? Create a listing and start receiving bookings.
          </p>
          <button
            onClick={() => onNavigate({ name: 'dashboard' })}
            style={{
              background: '#0ABAB5', border: 'none', borderRadius: 12,
              padding: '11px 20px', color: '#080808', fontWeight: 700, fontSize: 14,
              fontFamily: 'Outfit, sans-serif', width: '100%',
            }}
            className="tiffany-glow"
          >
            Become a specialist →
          </button>
        </div>
      </div>

    </div>
  )
}
