import { useRef, useState } from 'react'
import type { Specialist, CategoryKey } from '../../types'
import { CATEGORIES, categoryLabel } from '../../data'
import { useAuth } from '../../auth'
import { useToast } from '../../toast'
import { useI18n, formatNumber } from '../../i18n'
import { Select, Switch } from '../../Controls'
import Sheet from '../../Sheet'
import NoteEditor from './NoteEditor'
import { smallBtn } from './AdminRequests'
import { adminUpsertSpecialist, adminModerateListing, fetchUserContact, type UserContact } from '../../lib/admin'
import { uploadChatImage, removeUploadedFiles } from '../../lib/queries'
import { toSquareAvatar, resizeImage } from '../../lib/image'
import { Loader2, Star, X, BadgeCheck, Phone, Mail } from '../../icons'
import { useEffect } from 'react'

const LEVELS = ['bronze', 'silver', 'gold', 'platinum'] as const
const input = {
  width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 12, padding: '11px 13px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none',
} as const
const label = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' } as const

function Editor({ existing, onClose, onSaved }: { existing?: Specialist; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { notify } = useToast()
  const avatarRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(existing?.name ?? '')
  const [categoryKey, setCategoryKey] = useState<CategoryKey>(existing?.categoryKey ?? 'photo')
  const [city, setCity] = useState(existing?.city ?? '')
  const [age, setAge] = useState(existing ? String(existing.age) : '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [experience, setExperience] = useState(existing ? String(existing.experience) : '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [qualification, setQualification] = useState(existing?.qualification ?? '')
  const [tags, setTags] = useState(existing ? existing.tags.join(', ') : '')
  const [level, setLevel] = useState<(typeof LEVELS)[number]>((existing?.level as (typeof LEVELS)[number]) ?? 'bronze')
  const [avatar, setAvatar] = useState(existing?.avatar ?? '')
  const [portfolio, setPortfolio] = useState<string[]>(existing?.portfolio ?? [])
  const [cover, setCover] = useState(existing?.cover ?? '')
  const [available, setAvailable] = useState(existing?.available ?? true)
  const [verified, setVerified] = useState(existing?.verified ?? false)
  const [approved, setApproved] = useState(existing?.approved ?? true)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setUploading(true)
    try {
      setAvatar(await uploadChatImage(await toSquareAvatar(file), user.id))
    } catch (err) {
      console.error(err)
      notify(t('err.avatar'))
    } finally {
      setUploading(false)
    }
  }

  async function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !user) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of files.slice(0, Math.max(0, 24 - portfolio.length))) urls.push(await uploadChatImage(await resizeImage(f, 1600), user.id))
      setPortfolio(prev => [...prev, ...urls])
    } catch (err) {
      console.error(err)
      notify(t('err.portfolio'))
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(url: string) {
    setPortfolio(prev => prev.filter(u => u !== url))
    if (cover === url) setCover('')
    removeUploadedFiles([url])
  }

  async function save() {
    setError(null)
    const ageNum = Number(age), priceNum = Number(price), expNum = experience === '' ? 0 : Number(experience)
    if (name.trim().length < 2 || !city.trim() || !ageNum || !priceNum) return setError(t('auth.fillAll'))
    if (ageNum < 16 || ageNum > 99) return setError(t('form.ageRange'))
    if (priceNum < 1000 || priceNum > 100_000_000) return setError(t('form.priceRange'))
    if (!Number.isFinite(expNum) || expNum < 0 || expNum > 60) return setError(t('form.expRange'))

    const category = CATEGORIES.find(c => c.key === categoryKey)!
    setBusy(true)
    try {
      await adminUpsertSpecialist({
        id: existing?.id,
        name: name.trim(),
        category: category.label,
        category_key: category.key,
        city: city.trim(),
        age: ageNum,
        price: priceNum,
        experience: Math.round(expNum),
        bio: bio.trim(),
        qualification: qualification.trim(),
        tags: tags.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12),
        avatar: avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=0ABAB5`,
        cover: cover && portfolio.includes(cover) ? cover : (portfolio[0] ?? ''),
        portfolio,
        level,
        available,
        verified,
        approved,
      })
      notify(t('admin.saved'), 'success')
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save specialist', err)
      setError(t('form.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={existing ? t('admin.editSpecialist') : t('admin.newSpecialist')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            aria-label={t('dash.changePhoto')}
            style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid #0ABAB5', background: 'rgba(10,186,181,0.12)', overflow: 'hidden', padding: 0, position: 'relative', flexShrink: 0 }}
          >
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 26, color: 'var(--accent-text)' }}>+</span>}
            {uploading && <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spin" size={20} color="#fff" /></span>}
          </button>
          <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickAvatar} style={{ display: 'none' }} />
          <div style={{ flex: 1 }}>
            <label style={label}>{t('admin.name')}</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} style={input} />
          </div>
        </div>

        <div>
          <label style={label}>{t('form.category')}</label>
          <Select<CategoryKey> value={categoryKey} onChange={setCategoryKey} ariaLabel={t('form.category')} options={CATEGORIES.map(c => ({ value: c.key as CategoryKey, label: categoryLabel(c.key) }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={label}>{t('form.city')}</label><input value={city} onChange={e => setCity(e.target.value)} maxLength={60} style={input} /></div>
          <div><label style={label}>{t('spec.stat.age')}</label><input value={age} onChange={e => setAge(e.target.value)} type="number" inputMode="numeric" style={input} /></div>
          <div><label style={label}>{t('form.price')}</label><input value={price} onChange={e => setPrice(e.target.value)} type="number" inputMode="numeric" step={1000} style={input} /></div>
          <div><label style={label}>{t('spec.stat.experience')} ({t('form.years')})</label><input value={experience} onChange={e => setExperience(e.target.value)} type="number" inputMode="numeric" style={input} /></div>
        </div>

        <div><label style={label}>{t('form.bio')}</label><textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={1000} style={{ ...input, resize: 'vertical' }} /></div>
        <div><label style={label}>{t('form.qualification')}</label><textarea value={qualification} onChange={e => setQualification(e.target.value)} rows={2} maxLength={600} style={{ ...input, resize: 'vertical' }} /></div>
        <div><label style={label}>{t('form.tags')}</label><input value={tags} onChange={e => setTags(e.target.value)} maxLength={200} style={input} /></div>

        <div>
          <label style={label}>{t('admin.level')}</label>
          <Select<(typeof LEVELS)[number]> value={level} onChange={setLevel} ariaLabel={t('admin.level')} options={LEVELS.map(l => ({ value: l, label: t(`level.${l}` as 'level.bronze') }))} />
        </div>

        <div>
          <label style={label}>{t('admin.portfolio')} · {portfolio.length}/24</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {portfolio.map(url => (
              <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => removePhoto(url)} aria-label={t('portfolio.remove')} style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12} strokeWidth={2.4} />
                </button>
              </div>
            ))}
            {portfolio.length < 24 && (
              <button type="button" onClick={() => photosRef.current?.click()} disabled={uploading} style={{ aspectRatio: '1', borderRadius: 10, border: '1.5px dashed rgba(10,186,181,0.55)', background: 'rgba(10,186,181,0.07)', color: 'var(--accent-text)', fontSize: 22 }}>
                {uploading ? <Loader2 className="spin" size={18} /> : '+'}
              </button>
            )}
          </div>
          <input ref={photosRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addPhotos} style={{ display: 'none' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Switch checked={available} onChange={setAvailable}>{t('admin.available')}</Switch>
          <Switch checked={verified} onChange={setVerified}>{t('admin.verified')}</Switch>
          <Switch checked={approved} onChange={setApproved}>{t('admin.visible')}</Switch>
        </div>

        {existing && <NoteEditor kind="specialist" keyId={existing.id} />}

        {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: '#ff4d6d' }}>{error}</p>}

        <button onClick={save} disabled={busy || uploading} className={busy ? '' : 'tiffany-glow'} style={{ padding: '14px 0', borderRadius: 14, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800, opacity: busy || uploading ? 0.7 : 1 }}>
          {busy ? t('auth.saving') : t('form.save')}
        </button>
      </div>
    </Sheet>
  )
}

const MOD_COLORS: Record<Specialist['moderationStatus'], string> = {
  pending: '#F5A623', approved: 'var(--ok)', rejected: '#ff4d6d', needs_changes: '#4DB5E6',
}

/** Full information about a listing plus the four moderation decisions. */
function ModerationSheet({ listing, onClose, onDone }: { listing: Specialist; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [comment, setComment] = useState(listing.moderationComment)
  const [busy, setBusy] = useState(false)
  const [contact, setContact] = useState<UserContact | null>(null)

  useEffect(() => {
    if (!listing.ownerId) return
    fetchUserContact(listing.ownerId).then(setContact).catch(err => console.error(err))
  }, [listing.ownerId])

  async function decide(status: 'approved' | 'rejected' | 'needs_changes' | 'pending') {
    if ((status === 'rejected' || status === 'needs_changes') && comment.trim().length < 3) {
      return notify(t('admin.commentRequired'))
    }
    setBusy(true)
    try {
      await adminModerateListing(listing.id, status, comment.trim())
      notify(t('admin.updated'), 'success')
      onDone()
      onClose()
    } catch (err) {
      console.error(err)
      notify(t('err.updateSession'))
    } finally {
      setBusy(false)
    }
  }

  const row = { margin: '0 0 6px', fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' } as const
  const heading = { margin: '12px 0 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' } as const

  return (
    <Sheet title={listing.name} onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
        <img src={listing.avatar} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)' }} />
        <div>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.65 * var(--tb)))' }}>{categoryLabel(listing.categoryKey)} · {listing.city}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: MOD_COLORS[listing.moderationStatus] }}>{t(`mod.${listing.moderationStatus}` as 'mod.pending')}</p>
        </div>
      </div>

      <p style={heading}>{t('admin.owner')}</p>
      {contact ? (
        <div>
          <p style={row}>{contact.fullName || '—'}</p>
          {contact.phone && <a href={`tel:+${contact.phone}`} style={{ ...row, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 700 }}><Phone size={13} strokeWidth={2.2} /> +{contact.phone}</a>}
          {contact.email && <p style={{ ...row, display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} strokeWidth={2} /> {contact.email}</p>}
        </div>
      ) : <p style={row}>{listing.ownerId ? '…' : '—'}</p>}

      <p style={heading}>{t('form.bio')}</p>
      <p style={row}>{listing.bio || '—'}</p>
      {listing.qualification && (<><p style={heading}>{t('spec.qualification')}</p><p style={row}>{listing.qualification}</p></>)}
      <p style={heading}>{t('spec.pricing')}</p>
      <p style={row}>{formatNumber(listing.price)} {t('common.uzs')} · {t('spec.stat.experience')}: {listing.experience} · {t('spec.stat.age')}: {listing.age}</p>
      {listing.tags.length > 0 && (<><p style={heading}>{t('spec.skills')}</p><p style={row}>{listing.tags.join(', ')}</p></>)}

      <p style={heading}>{t('admin.portfolio')} · {listing.portfolio.length}</p>
      {listing.portfolio.length === 0 ? <p style={row}>—</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {listing.portfolio.map(url => (
            <a key={url} href={url} target="_blank" rel="noreferrer" style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)', display: 'block' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </a>
          ))}
        </div>
      )}

      <p style={heading}>{t('mod.reason')}</p>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t('admin.commentPlaceholder')}
        style={{ width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 12, padding: '10px 12px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', resize: 'vertical' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        <button disabled={busy} onClick={() => decide('approved')} className="tiffany-glow" style={{ padding: '13px 0', borderRadius: 14, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800, opacity: busy ? 0.6 : 1 }}>{t('admin.approveAction')}</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={busy} onClick={() => decide('needs_changes')} style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'rgba(77,181,230,0.18)', color: '#4DB5E6', fontSize: 13, fontWeight: 800 }}>{t('admin.requestChanges')}</button>
          <button disabled={busy} onClick={() => decide('rejected')} style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'rgba(255,77,109,0.14)', color: '#ff4d6d', fontSize: 13, fontWeight: 800 }}>{t('admin.rejectAction')}</button>
        </div>
        {listing.moderationStatus !== 'pending' && (
          <button disabled={busy} onClick={() => decide('pending')} style={{ padding: '10px 0', borderRadius: 14, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', fontSize: 13, fontWeight: 700 }}>{t('admin.backToReview')}</button>
        )}
      </div>
    </Sheet>
  )
}

export default function AdminSpecialists({ specialists, onChanged }: { specialists: Specialist[] | null; onChanged: () => void }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [editing, setEditing] = useState<Specialist | 'new' | null>(null)
  const [moderating, setModerating] = useState<Specialist | null>(null)
  const [onlyReview, setOnlyReview] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  void busyId; void setBusyId; void notify

  return (
    <>
      <button onClick={() => setEditing('new')} className="tiffany-glow" style={{ padding: '13px 0', borderRadius: 14, border: 'none', background: '#0ABAB5', color: '#080808', fontSize: 14, fontWeight: 800 }}>
        + {t('admin.addSpecialist')}
      </button>

      {specialists === null && <Loader2 className="spin" size={20} color="var(--accent-text)" strokeWidth={2} />}
      {specialists !== null && specialists.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))' }}>{t('admin.noListings')}</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {[true, false].map(flag => (
          <button
            key={String(flag)}
            onClick={() => setOnlyReview(flag)}
            style={{ ...smallBtn, background: onlyReview === flag ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)', color: onlyReview === flag ? '#080808' : 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))', transition: 'all 0.2s ease' }}
          >
            {flag ? `${t('admin.onReview')} ${(specialists ?? []).filter(x => x.moderationStatus === 'pending').length}` : t('admin.allListings')}
          </button>
        ))}
      </div>

      {(specialists ?? []).filter(s => !onlyReview || s.moderationStatus === 'pending' || s.moderationStatus === 'needs_changes').map(s => (
        <div key={s.id} className="glass pop-in" style={{ borderRadius: 18, padding: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={s.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                {s.verified && <BadgeCheck size={14} color="var(--accent-text)" strokeWidth={2.2} />}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.55 * var(--tb)))' }}>
                {categoryLabel(s.categoryKey)} · {s.city} · {formatNumber(s.price)} {t('common.uzs')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: MOD_COLORS[s.moderationStatus] }}>{t(`mod.${s.moderationStatus}` as 'mod.pending')}</span>{!s.published && s.approved ? ` · ${t('admin.hide')}` : ''}
                {s.reviews > 0 && <span style={{ color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Star size={10} fill="#FFD700" color="#FFD700" strokeWidth={0} /> {s.rating}</span>}
                {s.ownerId ? <span style={{ fontWeight: 500, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>· {t('admin.selfRegistered')}</span> : null}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditing(s)} style={{ ...smallBtn, background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)' }}>{t('admin.edit')}</button>
            <button onClick={() => setModerating(s)} style={{ ...smallBtn, background: s.moderationStatus === 'pending' ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)', color: s.moderationStatus === 'pending' ? '#080808' : 'var(--ink)' }}>
              {t('admin.moderate')}
            </button>
          </div>
        </div>
      ))}

      {moderating && <ModerationSheet listing={moderating} onClose={() => setModerating(null)} onDone={onChanged} />}

      {editing && (
        <Editor
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </>
  )
}
