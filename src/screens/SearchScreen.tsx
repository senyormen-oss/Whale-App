import { useState, useMemo } from 'react'
import { CATEGORIES, categoryLabel } from '../data'
import type { Screen, CategoryKey } from '../types'
import { useSpecialists } from '../specialistsData'
import { useI18n, formatNumber } from '../i18n'
import { CATEGORY_ICONS, Search, BadgeCheck, Star, SlidersHorizontal, SearchX, MapPin } from '../icons'

interface Props {
  initialCategory?: CategoryKey
  initialQuery?: string
  onNavigate: (screen: Screen) => void
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Star size={12} color="#FFD700" fill="#FFD700" strokeWidth={0} />
      <span style={{ color: 'rgba(var(--fg-rgb),0.7)', fontSize: 12 }}>{rating}</span>
    </span>
  )
}

export default function SearchScreen({ initialCategory, initialQuery, onNavigate }: Props) {
  const { t, lang } = useI18n()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(initialCategory ?? null)
  const [sortBy, setSortBy] = useState<'rating' | 'price_low' | 'price_high' | 'projects'>('rating')
  const [showFilters, setShowFilters] = useState(false)
  const { specialists } = useSpecialists()

  const results = useMemo(() => {
    let list = [...specialists]
    if (activeCategory) list = list.filter(s => s.categoryKey === activeCategory)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        categoryLabel(s.categoryKey).toLowerCase().includes(q) ||
        s.tags.some(tag => tag.toLowerCase().includes(q))
      )
    }
    switch (sortBy) {
      case 'rating':     return list.sort((a, b) => b.rating - a.rating)
      case 'price_low':  return list.sort((a, b) => a.price - b.price)
      case 'price_high': return list.sort((a, b) => b.price - a.price)
      case 'projects':   return list.sort((a, b) => b.projects - a.projects)
    }
  }, [specialists, query, activeCategory, sortBy, lang])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '56px 20px 16px', background: 'linear-gradient(180deg, var(--bg-header) 0%, var(--bg) 100%)' }}>
        <h1 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 800 }}>{t('search.title')}</h1>
        <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16 }}>
          <Search size={16} color="rgba(var(--fg-rgb),0.5)" strokeWidth={1.8} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 15, fontFamily: 'Outfit, sans-serif',
            }}
          />
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: showFilters ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.1)',
              border: 'none', borderRadius: 8, padding: '5px 12px',
              color: showFilters ? '#080808' : 'var(--ink)', fontSize: 12, fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            <SlidersHorizontal size={13} strokeWidth={2} />
            {t('search.filters')}
          </button>
        </div>
      </div>

      {/* Sort options */}
      {showFilters && (
        <div style={{ padding: '0 20px 16px' }} className="fade-in">
          <div className="glass" style={{ borderRadius: 16, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(var(--fg-rgb),0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('search.sortBy')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'rating', label: t('search.sort.rating') },
                { key: 'price_low', label: t('search.sort.priceLow') },
                { key: 'price_high', label: t('search.sort.priceHigh') },
                { key: 'projects', label: t('search.sort.projects') },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key as any)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: 'none', fontFamily: 'Outfit, sans-serif',
                    background: sortBy === opt.key ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)',
                    color: sortBy === opt.key ? '#080808' : 'rgba(var(--fg-rgb),0.7)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category chips */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 16px' }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            flexShrink: 0, padding: '8px 16px', borderRadius: 20,
            border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
            background: !activeCategory ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.07)',
            color: !activeCategory ? '#080808' : 'rgba(var(--fg-rgb),0.7)',
          }}
        >
          {t('search.all')}
        </button>
        {CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat.key]
          const active = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(active ? null : cat.key as CategoryKey)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 20, border: 'none',
                fontSize: 13, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                background: active ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.07)',
                color: active ? '#080808' : 'rgba(var(--fg-rgb),0.7)',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} color={active ? '#080808' : 'rgba(var(--fg-rgb),0.7)'} strokeWidth={1.8} />
              {categoryLabel(cat.key)}
            </button>
          )
        })}
      </div>

      {/* Results count */}
      <div style={{ padding: '0 20px 14px' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),0.4)' }}>
          {t('search.found', { n: results.length })}
        </p>
      </div>

      {/* Specialist cards */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {results.map((sp, i) => (
          <button
            key={sp.id}
            onClick={() => onNavigate({ name: 'specialist', id: sp.id })}
            className="glass fade-up"
            style={{
              borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
              border: '1px solid rgba(var(--fg-rgb),0.08)',
              padding: 0, textAlign: 'left', width: '100%',
              animationDelay: `${i * 0.05}s`,
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {/* Cover */}
            <div style={{ position: 'relative' }}>
              {sp.cover ? (
                <img
                  src={sp.cover}
                  alt={sp.name}
                  style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', background: 'var(--surface)' }}
                />
              ) : (
                <div style={{ width: '100%', height: 130, background: 'linear-gradient(135deg, #0a2a29 0%, #0ABAB5 100%)' }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
              {sp.verified && (
                <div
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    background: '#0ABAB5', borderRadius: 8,
                    padding: '3px 8px', fontSize: 10, fontWeight: 800,
                    color: '#080808', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <BadgeCheck size={12} strokeWidth={2.5} /> {t('common.verified')}
                </div>
              )}
              {sp.isNew && (
                <div
                  style={{
                    position: 'absolute', top: 10, left: 10,
                    background: 'rgba(10,186,181,0.2)', border: '1px solid rgba(10,186,181,0.4)',
                    borderRadius: 8, padding: '3px 8px', fontSize: 10, fontWeight: 700,
                    color: 'var(--accent-text)',
                  }}
                >
                  {t('common.new')}
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '14px 16px', display: 'flex', gap: 12 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={sp.avatar}
                  alt={sp.name}
                  style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #0ABAB5', background: 'var(--surface)' }}
                />
                {sp.available && (
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1, width: 13, height: 13,
                    borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--surface)',
                  }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg-rgb),0.45)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {categoryLabel(sp.categoryKey)} · <MapPin size={11} strokeWidth={2} /> {sp.city}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--accent-text)' }}>
                      {formatNumber(sp.price)}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(var(--fg-rgb),0.3)' }}>{t('common.uzs')}{t('common.perSession')}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <StarRating rating={sp.rating} />
                  <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.35)' }}>{t('search.reviewsCount', { n: sp.reviews })}</span>
                  <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),0.35)' }}>{t('search.projectsCount', { n: sp.projects })}</span>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {sp.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: 'rgba(10,186,181,0.1)', color: 'var(--accent-text)',
                        border: '1px solid rgba(10,186,181,0.2)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}

        {results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <SearchX size={44} color="rgba(var(--fg-rgb),0.25)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
            <p style={{ color: 'rgba(var(--fg-rgb),0.5)', fontSize: 15 }}>{t('search.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
