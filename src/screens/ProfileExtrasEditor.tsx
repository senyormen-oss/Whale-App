import { useEffect, useRef, useState } from 'react'
import type { Socials, SocialKey, Specialist } from '../types'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import { useToast } from '../toast'
import { updateSpecialistListing, uploadChatImage, removeUploadedFiles } from '../lib/queries'
import { resizeImage } from '../lib/image'
import {
  MAX_CERTIFICATES, MAX_VIDEOS, SOCIAL_KEYS, fetchPrivateContacts, normalizeSocial, normalizeTelegram, normalizeWhatsapp,
  parseVideo, savePrivateContacts, isUploadedVideo, removePortfolioVideo,
} from '../lib/profile'
import { Award, Globe, Loader2, Lock, Video, X } from '../icons'

const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 12, padding: '10px 12px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, Onest, sans-serif', outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', marginBottom: 5, fontWeight: 600 }
const sectionTitle: React.CSSProperties = { margin: '0 0 6px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }
const hint: React.CSSProperties = { margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }
const SOCIAL_LABELS: Record<SocialKey, string> = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', behance: 'Behance', website: '' }

/** Videos, public links, private messenger contacts and certificates of one listing (owner side). */
export default function ProfileExtrasEditor({ listing, onChange }: { listing: Specialist; onChange: (s: Specialist) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { notify } = useToast()
  const certRef = useRef<HTMLInputElement>(null)

  const [videoInput, setVideoInput] = useState('')
  const [videoBusy, setVideoBusy] = useState(false)

  const [socials, setSocials] = useState<Record<SocialKey, string>>(() =>
    Object.fromEntries(SOCIAL_KEYS.map(k => [k, listing.socials[k] ?? ''])) as Record<SocialKey, string>)
  const [telegram, setTelegram] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [linksBusy, setLinksBusy] = useState(false)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [certBusy, setCertBusy] = useState(false)

  useEffect(() => {
    fetchPrivateContacts(listing.id)
      .then(c => { setTelegram(c.telegram); setWhatsapp(c.whatsapp) })
      .catch(err => console.error('Failed to load private contacts', err))
  }, [listing.id])

  const socialName = (k: SocialKey) => (k === 'website' ? t('profile.social.website') : SOCIAL_LABELS[k])

  async function addVideo(e: React.FormEvent) {
    e.preventDefault()
    const v = parseVideo(videoInput)
    if (!v) return notify(t('profile.badVideo'))
    if (listing.videos.length >= MAX_VIDEOS) return notify(t('profile.maxVideos', { n: MAX_VIDEOS }))
    if (listing.videos.includes(v.url)) { setVideoInput(''); return }
    setVideoBusy(true)
    try {
      onChange(await updateSpecialistListing(listing.id, { videos: [...listing.videos, v.url] }))
      setVideoInput('')
      notify(t('profile.saved'), 'success')
    } catch (err) {
      console.error(err)
      notify(t('profile.failed'))
    } finally {
      setVideoBusy(false)
    }
  }

  async function removeVideo(url: string) {
    setVideoBusy(true)
    try {
      onChange(await updateSpecialistListing(listing.id, { videos: listing.videos.filter(v => v !== url) }))
      await removePortfolioVideo(url)
    } catch (err) {
      console.error(err)
      notify(t('profile.failed'))
    } finally {
      setVideoBusy(false)
    }
  }

  async function saveLinks(e: React.FormEvent) {
    e.preventDefault()
    setLinksError(null)
    const next: Socials = {}
    for (const k of SOCIAL_KEYS) {
      const v = normalizeSocial(k, socials[k])
      if (v === null) return setLinksError(t('profile.badLink', { name: socialName(k) }))
      if (v) next[k] = v
    }
    const tg = normalizeTelegram(telegram)
    if (tg === null) return setLinksError(t('profile.badTelegram'))
    const wa = normalizeWhatsapp(whatsapp)
    if (wa === null) return setLinksError(t('profile.badWhatsapp'))
    setLinksBusy(true)
    try {
      const saved = await updateSpecialistListing(listing.id, { socials: next })
      await savePrivateContacts(listing.id, { telegram: tg, whatsapp: wa })
      onChange(saved)
      setSocials(Object.fromEntries(SOCIAL_KEYS.map(k => [k, next[k] ?? ''])) as Record<SocialKey, string>)
      setTelegram(tg)
      setWhatsapp(wa)
      notify(t('profile.saved'), 'success')
    } catch (err) {
      console.error(err)
      const code = (err as { code?: string }).code
      setLinksError(`${t('profile.failed')}${code ? ` (${code})` : ''}`)
    } finally {
      setLinksBusy(false)
    }
  }

  async function addCertificates(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !user) return
    const room = MAX_CERTIFICATES - listing.certificates.length
    if (room <= 0) return notify(t('profile.maxCertificates', { n: MAX_CERTIFICATES }))
    setCertBusy(true)
    try {
      const urls: string[] = []
      for (const file of files.slice(0, room)) urls.push(await uploadChatImage(await resizeImage(file, 1600), user.id))
      onChange(await updateSpecialistListing(listing.id, { certificates: [...listing.certificates, ...urls] }))
      notify(t('profile.saved'), 'success')
    } catch (err) {
      console.error('Failed to add certificates', err)
      notify(t('profile.failed'))
    } finally {
      setCertBusy(false)
    }
  }

  async function removeCertificate(url: string) {
    setCertBusy(true)
    try {
      onChange(await updateSpecialistListing(listing.id, { certificates: listing.certificates.filter(u => u !== url) }))
      await removeUploadedFiles([url])
    } catch (err) {
      console.error(err)
      notify(t('profile.failed'))
    } finally {
      setCertBusy(false)
    }
  }

  return (
    <>
      {/* Videos */}
      <div>
        <h2 style={sectionTitle}>
          <Video size={16} color="var(--accent-text)" strokeWidth={2} /> {t('profile.videos')}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{listing.videos.length}/{MAX_VIDEOS}</span>
        </h2>
        <p style={hint}>{t('profile.videosHint')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: listing.videos.length ? 10 : 0 }}>
          {listing.videos.map(url => (
            <div key={url} className="glass" style={{ borderRadius: 12, padding: '8px 8px 8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isUploadedVideo(url) ? t('profile.videoFile') : url.replace(/^https:\/\//, '')}</span>
              <button type="button" disabled={videoBusy} onClick={() => removeVideo(url)} aria-label={t('profile.removeVideo')} style={{ width: 28, height: 28, borderRadius: 9, border: 'none', background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
        {listing.videos.length < MAX_VIDEOS && (
          <form onSubmit={addVideo} style={{ display: 'flex', gap: 8 }}>
            <input value={videoInput} onChange={e => setVideoInput(e.target.value)} placeholder="https://youtube.com/watch?v=…" inputMode="url" style={inputStyle} />
            <button type="submit" disabled={videoBusy || !videoInput.trim()} style={{ padding: '0 16px', borderRadius: 12, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 13, fontWeight: 800, opacity: videoBusy || !videoInput.trim() ? 0.5 : 1, flexShrink: 0 }}>
              {videoBusy ? <Loader2 className="spin" size={15} /> : t('profile.addVideo')}
            </button>
          </form>
        )}
      </div>

      {/* Links + private contacts */}
      <form onSubmit={saveLinks}>
        <h2 style={sectionTitle}><Globe size={16} color="var(--accent-text)" strokeWidth={2} /> {t('profile.links')}</h2>
        <p style={hint}>{t('profile.linksHint')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SOCIAL_KEYS.map(k => (
            <div key={k}>
              <label style={labelStyle}>{socialName(k)}</label>
              <input value={socials[k]} onChange={e => setSocials({ ...socials, [k]: e.target.value })} maxLength={200} inputMode="url" placeholder={k === 'website' ? 'https://…' : '@username'} style={inputStyle} />
            </div>
          ))}
        </div>

        <div className="glass" style={{ borderRadius: 14, padding: 12, marginTop: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} strokeWidth={2.2} /> {t('profile.private')}</p>
          <p style={{ ...hint, marginBottom: 10 }}>{t('profile.privateHint')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={labelStyle}>Telegram</label><input value={telegram} onChange={e => setTelegram(e.target.value)} maxLength={40} placeholder="@username" style={inputStyle} /></div>
            <div><label style={labelStyle}>WhatsApp</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} maxLength={20} inputMode="tel" placeholder="+998…" style={inputStyle} /></div>
          </div>
        </div>

        {linksError && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#ff4d6d' }}>{linksError}</p>}
        <button type="submit" disabled={linksBusy} style={{ width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 12, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800, opacity: linksBusy ? 0.6 : 1 }}>
          {linksBusy ? '…' : t('profile.save')}
        </button>
      </form>

      {/* Certificates */}
      <div>
        <h2 style={sectionTitle}>
          <Award size={16} color="var(--accent-text)" strokeWidth={2} /> {t('profile.certificates')}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{listing.certificates.length}/{MAX_CERTIFICATES}</span>
        </h2>
        <p style={hint}>{t('profile.certificatesHint')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {listing.certificates.map(url => (
            <div key={url} style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={() => removeCertificate(url)} disabled={certBusy} aria-label={t('profile.removeCertificate')} style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          {listing.certificates.length < MAX_CERTIFICATES && (
            <button type="button" onClick={() => certRef.current?.click()} disabled={certBusy} style={{ aspectRatio: '3/4', borderRadius: 10, border: '1.5px dashed rgba(10,186,181,0.55)', background: 'rgba(10,186,181,0.07)', color: 'var(--accent-text)', fontSize: 24 }}>
              {certBusy ? <Loader2 className="spin" size={18} /> : '+'}
            </button>
          )}
        </div>
        <input ref={certRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addCertificates} style={{ display: 'none' }} />
      </div>
    </>
  )
}
