import { useState } from 'react'
import type { SocialKey, Specialist } from '../types'
import { useI18n } from '../i18n'
import { SOCIAL_KEYS, parseVideo, type VideoLink } from '../lib/profile'
import { ExternalLink, Play } from '../icons'

const PLATFORM: Record<'youtube' | 'instagram' | 'tiktok' | 'file', { name: string; color: string }> = {
  file: { name: '', color: '#0ABAB5' },
  youtube: { name: 'YouTube', color: '#FF3B30' },
  instagram: { name: 'Instagram', color: '#E1306C' },
  tiktok: { name: 'TikTok', color: '#25F4EE' },
}
const SOCIAL_LABELS: Record<SocialKey, string> = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', behance: 'Behance', website: '' }

const cardTitle = { margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', textTransform: 'uppercase', letterSpacing: '0.05em' } as const

/** One video: YouTube plays inline after a tap (privacy-enhanced embed); Instagram and TikTok open in a new tab. */
function VideoCard({ v }: { v: VideoLink }) {
  const { t } = useI18n()
  const [playing, setPlaying] = useState(false)
  const platform = PLATFORM[v.kind]

  if (v.kind === 'file') {
    return (
      <video
        src={v.url}
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', maxHeight: 520, borderRadius: 14, background: '#000', display: 'block' }}
      />
    )
  }

  if (v.kind === 'youtube') {
    return (
      <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
            title="YouTube"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <button onClick={() => setPlaying(true)} aria-label={t('profile.play')} style={{ position: 'absolute', inset: 0, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}>
            <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={24} color="#fff" fill="#fff" strokeWidth={0} />
            </span>
          </button>
        )}
      </div>
    )
  }

  return (
    <a href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="glass" style={{ borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)', textDecoration: 'none' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: `${platform.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Play size={18} color={platform.color} fill={platform.color} strokeWidth={0} />
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{t('profile.openOn', { name: platform.name })}</span>
      <ExternalLink size={16} strokeWidth={2} color="rgba(var(--fg-rgb),calc(0.5 * var(--tb)))" />
    </a>
  )
}

export function VideosBlock({ sp }: { sp: Specialist }) {
  const videos = sp.videos.map(parseVideo).filter((v): v is VideoLink => v !== null)
  if (videos.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      {videos.map(v => <VideoCard key={v.url} v={v} />)}
    </div>
  )
}

export function CertificatesBlock({ sp }: { sp: Specialist }) {
  const { t } = useI18n()
  if (sp.certificates.length === 0) return null
  return (
    <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
      <h3 style={cardTitle}>{t('profile.certificates')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {sp.certificates.map(url => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', display: 'block' }}>
            <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </a>
        ))}
      </div>
    </div>
  )
}

export function LinksBlock({ sp }: { sp: Specialist }) {
  const { t } = useI18n()
  const links = SOCIAL_KEYS.filter(k => sp.socials[k])
  if (links.length === 0) return null
  return (
    <div className="glass" style={{ borderRadius: 16, padding: 16 }}>
      <h3 style={cardTitle}>{t('profile.links')}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {links.map(k => (
          <a
            key={k}
            href={sp.socials[k]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: 'rgba(10,186,181,0.1)', color: 'var(--accent-text)', border: '1px solid rgba(10,186,181,0.25)', textDecoration: 'none' }}
          >
            {k === 'website' ? t('profile.social.website') : SOCIAL_LABELS[k]} <ExternalLink size={12} strokeWidth={2.2} />
          </a>
        ))}
      </div>
    </div>
  )
}
