import { useState } from 'react'
import { CATEGORIES, categoryLabel } from '../data'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { useI18n, formatNumber } from '../i18n'
import UserAvatar from '../UserAvatar'
import { CATEGORY_ICONS, LEVEL_ICONS, Bell, Search, BadgeCheck, Star, Sparkles, MessageSquareText, User, Briefcase } from '../icons'

function greetingKey() {
  const h = new Date().getHours()
  if (h < 5) return 'home.greeting.night' as const
  if (h < 12) return 'home.greeting.morning' as const
  if (h < 18) return 'home.greeting.afternoon' as const
  return 'home.greeting.evening' as const
}

interface Props {
  onNavigate: (screen: Screen) => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Star size={12} color="#FFD700" fill="#FFD700" strokeWidth={0} />
      <span style={{ color: 'var(--ink)', fontSize: 11, fontWeight: 600 }}>{rating}</span>
    </span>
  )
}

function LevelBadge({ level }: { level: string }) {
  const cfg = LEVEL_ICONS[level as keyof typeof LEVEL_ICONS] ?? LEVEL_ICONS.bronze
  const Icon = cfg.icon
  return <Icon size={15} color={cfg.color} strokeWidth={2} />
}

export default function HomeScreen({ onNavigate }: Props) {
  const { t } = useI18n()
  const [searchValue, setSearchValue] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const { conversations, notificationsEnabled, markConversationRead } = useAppStore()
  const { specialists } = useSpecialists()
  const { user } = useAuth()
  const firstName = ((user?.user_metadata?.full_name as string) || '').trim().split(' ')[0] || t('home.there')

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
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 24px', background: 'linear-gradient(180deg, var(--bg-header) 0%, var(--bg) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', fontSize: 13, margin: '0 0 4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t(greetingKey())}
            </p>
            <h1 className="gradient-text" style={{ margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
              {firstName}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              aria-label={t('home.notifications')}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: showNotifications ? 'rgba(10,186,181,0.18)' : 'rgba(var(--fg-rgb),0.07)', color: 'var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}
            >
              <Bell size={19} color="var(--ink)" strokeWidth={1.8} />
              {hasNotifications && (
                <span style={{
                  position: 'absolute', top: 8, right: 8, width: 8, height: 8,
                  borderRadius: '50%', background: '#0ABAB5', border: '2px solid var(--bg)',
                }} />
              )}
            </button>

            {showNotifications && (
              <div
                className="glass fade-in"
                style={{
                  position: 'absolute', top: 52, right: 0, width: 280, zIndex: 200,
                  borderRadius: 16, border: '1px solid rgba(var(--fg-rgb),0.1)',
                  overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                  background: 'var(--sheet)',
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(var(--fg-rgb),0.08)' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t('home.notifications')}</p>
                </div>
                {unreadConversations.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{t('home.caughtUp')}</p>
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
                          borderBottom: '1px solid rgba(var(--fg-rgb),0.05)', textAlign: 'left', cursor: 'pointer',
                        }}
                      >
                        <MessageSquareText size={15} color="var(--accent-text)" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <p style={{ margin: '0 0 1px', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.lastMessage}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <UserAvatar size={44} />
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
            <Search size={17} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" strokeWidth={1.8} />
            <input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 15, fontFamily: 'Outfit, sans-serif',
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
              {t('home.find')}
            </button>
          </div>
        </form>
      </div>

      {/* Promo banner */}
      <div style={{ padding: '0 20px', marginBottom: 28 }}>
        <div
          className="fade-up on-dark"
          style={{
            borderRadius: 20, overflow: 'hidden', position: 'relative',
            background: 'linear-gradient(135deg, #0a2a29 0%, #0ABAB5 100%)',
            padding: '24px 20px', minHeight: 130,
          }}
        >
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(var(--fg-rgb),0.06)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(var(--fg-rgb),0.04)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))', marginBottom: 6 }}>
              <Sparkles size={13} color="rgba(var(--fg-rgb),calc(0.8 * var(--tb)))" strokeWidth={2} />
              {t('home.promo.badge')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>
              {t('home.promo.title')}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.75 * var(--tb)))', marginBottom: 16 }}>
              {t('home.promo.subtitle')}
            </div>
            <button
              onClick={() => onNavigate({ name: 'search' })}
              style={{
                background: 'white', border: 'none', borderRadius: 10,
                padding: '9px 18px', color: '#080808', fontWeight: 700, fontSize: 13,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {t('home.promo.cta')} →
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('home.categories')}</h2>
          <button
            onClick={() => onNavigate({ name: 'search' })}
            style={{ background: 'none', border: 'none', color: 'var(--accent-text)', fontSize: 13, fontWeight: 600 }}
          >
            {t('common.seeAll')}
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
                  background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.08)',
                  color: 'var(--ink)', cursor: 'pointer', minWidth: 78,
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
                  {categoryLabel(cat.key)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {specialists.length === 0 && (
        <div style={{ padding: '0 20px', marginBottom: 32 }}>
          <div className="glass" style={{ borderRadius: 18, padding: 20, textAlign: 'center', color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))', fontSize: 14, lineHeight: 1.6 }}>
            {t('home.noSpecialists')}
          </div>
        </div>
      )}

      {/* Top Specialists */}
      {featured.length > 0 && (
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={17} color="#FFD700" fill="#FFD700" strokeWidth={0} /> {t('home.top')}
          </h2>
          <button
            onClick={() => onNavigate({ name: 'search' })}
            style={{ background: 'none', border: 'none', color: 'var(--accent-text)', fontSize: 13, fontWeight: 600 }}
          >
            {t('common.seeAll')}
          </button>
        </div>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 20px' }}>
          {featured.map(sp => (
            <button
              key={sp.id}
              onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
              style={{
                flexShrink: 0, width: 180, borderRadius: 20, overflow: 'hidden',
                background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.08)',
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
                    style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', background: 'var(--surface)' }}
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
                    border: '2px solid #0ABAB5', background: 'var(--surface)',
                  }}
                />
              </div>
              <div style={{ padding: '22px 12px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{categoryLabel(sp.categoryKey)}</p>
                  </div>
                  <LevelBadge level={sp.level} />
                </div>
                <StarRating rating={sp.rating} />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--accent-text)', fontWeight: 600 }}>
                  {t('common.from')} {formatNumber(sp.price)} {t('common.uzs')}
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
            <Sparkles size={17} color="var(--accent-text)" strokeWidth={2} /> {t('home.new')}
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
                border: '1px solid rgba(var(--fg-rgb),0.08)', textAlign: 'left',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={sp.avatar}
                  alt={sp.name}
                  style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)' }}
                />
                {sp.available && (
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 13, height: 13, borderRadius: '50%',
                    background: 'var(--ok)', border: '2px solid var(--bg)',
                  }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                  {sp.verified && <BadgeCheck size={14} color="var(--accent-text)" strokeWidth={2} />}
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{categoryLabel(sp.categoryKey)} · {sp.city}</p>
                <StarRating rating={sp.rating} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-text)' }}>
                  {formatNumber(sp.price)}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg-rgb),calc(0.35 * var(--tb)))' }}>{t('common.uzs')}</p>
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
            <Briefcase size={22} color="var(--accent-text)" strokeWidth={1.8} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{t('home.offer.title')}</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))', lineHeight: 1.5 }}>
            {t('home.offer.text')}
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
            {t('home.offer.cta')} →
          </button>
        </div>
      </div>

    </div>
  )
}
