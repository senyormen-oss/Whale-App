import { useState, useEffect } from 'react'
import { getLevelConfig, formatPrice, getSubscriptionPlans, categoryLabel } from '../data'
import type { Screen, Review } from '../types'
import { useAppStore } from '../store'
import { useSpecialists } from '../specialistsData'
import { fetchReviews } from '../lib/queries'
import { useI18n, formatDate } from '../i18n'
import { useAuth } from '../auth'
import ReportModal from './ReportModal'
import Segmented from '../Segmented'
import { LEVEL_ICONS, ArrowLeft, Heart, Share2, BadgeCheck, Star, MessageCircle, MapPin, Flag } from '../icons'

interface Props {
  specialistId: string
  onNavigate: (screen: Screen) => void
  onBack: () => void
}

type Tab = 'portfolio' | 'about' | 'reviews'

export default function SpecialistScreen({ specialistId, onNavigate, onBack }: Props) {
  const { t } = useI18n()
  const { specialists } = useSpecialists()
  const sp = specialists.find(s => s.id === specialistId)
  const { favorites, toggleFavorite, startConversation } = useAppStore()
  const [tab, setTab] = useState<Tab>('portfolio')
  const [copied, setCopied] = useState(false)
  const [reporting, setReporting] = useState(false)
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const liked = favorites.includes(specialistId)

  useEffect(() => {
    let cancelled = false
    fetchReviews(specialistId).then(data => {
      if (!cancelled) setReviews(data)
    }).catch(err => console.error('Failed to load reviews', err))
    return () => {
      cancelled = true
    }
  }, [specialistId])

  async function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}#specialist/${specialistId}`
    const shareData = { title: t('spec.shareTitle', { name: sp?.name ?? '' }), text: t('spec.shareText', { name: sp?.name ?? '' }), url }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
    } catch {
      // User cancelled the native share sheet — fall through to clipboard.
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access can be denied by the browser — nothing more we can do.
    }
  }

  if (!sp) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
      {t('spec.notFound')}
    </div>
  )

  const level = getLevelConfig(sp.level)
  const avgOf = (key: 'quality' | 'timing' | 'communication') =>
    reviews.length ? Math.round((reviews.reduce((sum, r) => sum + r[key], 0) / reviews.length) * 10) / 10 : 0
  const LevelIcon = LEVEL_ICONS[sp.level].icon

  return (
    <div style={{ minHeight: '100%', paddingBottom: 100 }}>

      {/* Hero */}
      <div style={{ position: 'relative' }}>
        {sp.cover ? (
          <img
            src={sp.cover}
            alt={sp.name}
            style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block', background: 'var(--surface)' }}
          />
        ) : (
          <div style={{ width: '100%', height: 280, background: 'linear-gradient(135deg, #0a2a29 0%, #0ABAB5 100%)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(var(--bg-rgb),0.95) 100%)' }} />

        {/* Back + actions */}
        <div style={{ position: 'absolute', top: 52, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 20px' }}>
          <button
            onClick={onBack}
            aria-label={t('common.back')}
            style={{
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(var(--fg-rgb),0.15)',
              borderRadius: '50%', width: 40, height: 40,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => toggleFavorite(specialistId)}
              style={{
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(var(--fg-rgb),0.15)',
                borderRadius: '50%', width: 40, height: 40,
                color: liked ? '#ff4d6d' : 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.2s',
              }}
            >
              <Heart size={18} strokeWidth={2} fill={liked ? '#ff4d6d' : 'none'} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleShare}
                style={{
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(var(--fg-rgb),0.15)',
                  borderRadius: '50%', width: 40, height: 40,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Share2 size={17} strokeWidth={2} />
              </button>
              {copied && (
                <span className="fade-in" style={{
                  position: 'absolute', top: 46, right: 0, whiteSpace: 'nowrap',
                  background: '#0ABAB5', color: '#080808', fontSize: 11, fontWeight: 700,
                  padding: '5px 10px', borderRadius: 8,
                }}>
                  {t('spec.linkCopied')}
                </span>
              )}
            </div>
            {sp.ownerId !== user?.id && (
              <button
                onClick={() => setReporting(true)}
                aria-label={t('report.button')}
                title={t('report.button')}
                style={{
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(var(--fg-rgb),0.15)',
                  borderRadius: '50%', width: 40, height: 40, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Flag size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Profile info overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <img
                src={sp.avatar}
                alt={sp.name}
                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #0ABAB5', background: 'var(--surface)', flexShrink: 0 }}
              />
              {sp.available && (
                <span className="online-dot" style={{
                  position: 'absolute', bottom: 3, right: 3,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--ok)', border: '2px solid var(--bg)',
                }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{sp.name}</h1>
                {sp.verified && (
                  <span
                    className="verified-pulse"
                    style={{
                      background: '#0ABAB5', borderRadius: '50%', width: 22, height: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <BadgeCheck size={13} color="#080808" strokeWidth={2.5} />
                  </span>
                )}
                <LevelIcon size={17} color={level.color} strokeWidth={2} />
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))', display: 'flex', alignItems: 'center', gap: 4 }}>
                {categoryLabel(sp.categoryKey)} · <MapPin size={12} strokeWidth={2} /> {sp.city}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={13} color="#FFD700" fill="#FFD700" strokeWidth={0} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{sp.rating}</span>
                <span style={{ fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>({t('spec.reviewsCount', { n: sp.reviews })})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ padding: '16px 20px' }}>
        <div className="glass" style={{ borderRadius: 16, padding: '16px 0', display: 'flex' }}>
          {[
            { label: t('spec.stat.projects'), value: sp.projects },
            { label: t('spec.stat.reviews'), value: sp.reviews },
            { label: t('spec.stat.experience'), value: t('spec.years', { n: sp.experience }) },
            { label: t('spec.stat.age'), value: sp.age },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1, textAlign: 'center',
              borderRight: i < 3 ? '1px solid rgba(var(--fg-rgb),0.08)' : undefined,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{stat.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 20px 16px' }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'portfolio', label: t('spec.tab.portfolio') },
            { value: 'about', label: t('spec.tab.about') },
            { value: 'reviews', label: t('spec.tab.reviews') },
          ]}
        />
      </div>

      {/* Tab content */}
      <div className="fade-in" key={tab}>
        {tab === 'portfolio' && (
          <div style={{ padding: '0 20px' }}>
            {sp.portfolio.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))', fontSize: 13 }}>
                {t('spec.noPortfolio')}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {sp.portfolio.map((img, i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: 14, overflow: 'hidden',
                    aspectRatio: i === 0 ? '2/1.4' : '1/1',
                    gridColumn: i === 0 ? 'span 2' : undefined,
                    background: 'var(--surface)',
                  }}
                >
                  <img
                    src={img}
                    alt={t('spec.portfolioAlt', { n: i + 1 })}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'about' && (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('spec.about')}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'rgba(var(--fg-rgb),calc(0.8 * var(--tb)))' }}>{sp.bio}</p>
            </div>

            {sp.qualification && (
              <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('spec.qualification')}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'rgba(var(--fg-rgb),calc(0.8 * var(--tb)))', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{sp.qualification}</p>
              </div>
            )}

            <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('spec.skills')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sp.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    background: 'rgba(10,186,181,0.1)', color: 'var(--accent-text)',
                    border: '1px solid rgba(10,186,181,0.25)',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('spec.pricing')}</h3>
              {getSubscriptionPlans(sp.price).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{item.description}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--accent-text)' }}>{formatPrice(item.price)}</p>
                </div>
              ))}
            </div>

            {/* Level badge */}
            <div
              className="glass"
              style={{
                borderRadius: 16, padding: 16,
                border: `1px solid ${level.color}22`,
                background: `${level.color}08`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LevelIcon size={30} color={level.color} strokeWidth={1.8} />
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 800, color: level.color }}>{t('spec.levelSpecialist', { level: level.label })}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {t('spec.basedOn', { projects: sp.projects, reviews: sp.reviews, rating: sp.rating })} <Star size={10} color="#FFD700" fill="#FFD700" strokeWidth={0} />
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'reviews' && (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Rating summary — computed from real reviews only */}
            {reviews.length > 0 && (
            <div className="glass" style={{ borderRadius: 16, padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 2px', fontSize: 44, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{sp.rating}</p>
                <p style={{ margin: '0 0 4px', display: 'flex', gap: 2, justifyContent: 'center' }}>
                  {Array.from({ length: Math.max(1, Math.round(sp.rating)) }).map((_, i) => (
                    <Star key={i} size={14} color="#FFD700" fill="#FFD700" strokeWidth={0} />
                  ))}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{t('spec.reviewsCount', { n: sp.reviews })}</p>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[[t('review.quality'), avgOf('quality')], [t('review.timing'), avgOf('timing')], [t('review.communication'), avgOf('communication')]].map(([label, val]) => (
                  <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', width: 90 }}>{label}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(var(--fg-rgb),0.1)' }}>
                      <div style={{ width: `${((val as number) / 5) * 100}%`, height: '100%', borderRadius: 2, background: '#0ABAB5' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--accent-text)', width: 24 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            )}

            {reviews.map(r => (
              <div key={r.id} className="glass" style={{ borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  {r.avatar ? (
                    <img src={r.avatar} alt={r.author} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)' }} />
                  ) : (
                    <div aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(10,186,181,0.15)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>
                      {(r.author || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700 }}>{r.author}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'flex', gap: 1 }}>
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} size={11} color="#FFD700" fill="#FFD700" strokeWidth={0} />
                        ))}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{formatDate(r.date)}</span>
                    </div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(var(--fg-rgb),calc(0.75 * var(--tb)))' }}>{r.text}</p>
              </div>
            ))}

            {reviews.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>
                {t('spec.noReviews')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        padding: '16px 20px 32px',
        background: 'linear-gradient(to top, var(--bg) 60%, transparent)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={async () => {
              const conversationId = await startConversation(specialistId)
              if (conversationId) onNavigate({ name: 'chat', conversationId })
            }}
            className="glass"
            style={{
              padding: '14px 18px', borderRadius: 16, border: '1px solid rgba(var(--fg-rgb),0.15)',
              color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MessageCircle size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => sp.available && onNavigate({ name: 'booking', specialistId: sp.id })}
            disabled={!sp.available}
            className={sp.available ? 'tiffany-glow' : ''}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 16, border: 'none',
              background: sp.available ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.1)',
              color: sp.available ? '#080808' : 'rgba(var(--fg-rgb),calc(0.35 * var(--tb)))',
              fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
              cursor: sp.available ? 'pointer' : 'not-allowed',
            }}
          >
            {sp.available ? t('spec.book', { price: formatPrice(sp.price) }) : t('spec.unavailable')}
          </button>
        </div>
      </div>

      {reporting && <ReportModal specialistId={sp.id} specialistName={sp.name} onClose={() => setReporting(false)} />}
    </div>
  )
}
