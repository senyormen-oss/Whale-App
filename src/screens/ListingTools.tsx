import { useRef, useState } from 'react'
import type { Specialist } from '../types'
import Sheet from '../Sheet'
import BecomeSpecialistForm from './BecomeSpecialistForm'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { useI18n } from '../i18n'
import { useConfirm } from '../confirm'
import { uploadChatImage, updateSpecialistListing, removeUploadedFiles } from '../lib/queries'
import { resizeImage } from '../lib/image'
import { Folder, Loader2, X, PenSquare } from '../icons'

const MAX_PORTFOLIO = 12

/** Edit-listing button plus the portfolio manager (upload / remove photos) for a specialist's own listing. */
export default function ListingTools({ listing, onChange }: { listing: Specialist; onChange: (s: Specialist) => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { notify } = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function save(portfolio: string[], extra: { cover?: string } = {}) {
    const saved = await updateSpecialistListing(listing.id, { portfolio, ...extra })
    onChange(saved)
  }

  async function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length || !user) return
    const room = MAX_PORTFOLIO - listing.portfolio.length
    if (room <= 0) return notify(t('portfolio.max', { n: MAX_PORTFOLIO }))
    setBusy(true)
    try {
      const urls: string[] = []
      for (const file of files.slice(0, room)) {
        const resized = await resizeImage(file, 1600)
        urls.push(await uploadChatImage(resized, user.id))
      }
      const next = [...listing.portfolio, ...urls]
      // The first portfolio photo doubles as the listing cover until the specialist has one.
      await save(next, listing.cover ? {} : { cover: next[0] })
      notify(t('portfolio.added'), 'success')
    } catch (err) {
      console.error('Failed to add portfolio photos', err)
      notify(err instanceof Error && err.message && !/decode|canvas|encode/.test(err.message) ? err.message : t('err.portfolio'))
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto(url: string) {
    const ok = await confirm({ title: t('portfolio.removeTitle'), confirmLabel: t('portfolio.remove'), danger: true })
    if (!ok) return
    setBusy(true)
    try {
      const next = listing.portfolio.filter(u => u !== url)
      await save(next, listing.cover === url ? { cover: next[0] ?? '' } : {})
      await removeUploadedFiles([url])
      notify(t('portfolio.removed'), 'success')
    } catch (err) {
      console.error('Failed to remove portfolio photo', err)
      notify(t('err.portfolio'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setEditing(true)}
        className="glass"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, textAlign: 'left', color: 'var(--ink)' }}
      >
        <PenSquare size={18} color="var(--accent-text)" strokeWidth={1.8} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{t('dash.editListing')}</span>
      </button>

      <div>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Folder size={16} color="var(--accent-text)" strokeWidth={2} /> {t('spec.tab.portfolio')}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>{listing.portfolio.length}/{MAX_PORTFOLIO}</span>
        </h2>

        {listing.portfolio.length === 0 && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', lineHeight: 1.5 }}>{t('portfolio.empty')}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {listing.portfolio.map(url => (
            <div key={url} className="pop-in" style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <button
                onClick={() => removePhoto(url)}
                disabled={busy}
                aria-label={t('portfolio.remove')}
                style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          {listing.portfolio.length < MAX_PORTFOLIO && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              style={{
                aspectRatio: '1', borderRadius: 12, border: '1.5px dashed rgba(10,186,181,0.55)', background: 'rgba(10,186,181,0.07)',
                color: 'var(--accent-text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 700,
              }}
            >
              {busy ? <Loader2 className="spin" size={20} strokeWidth={2} /> : <span style={{ fontSize: 26, lineHeight: 1, fontWeight: 400 }}>+</span>}
              {t('portfolio.add')}
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addPhotos} style={{ display: 'none' }} />
      </div>

      {editing && (
        <Sheet title={t('dash.editListing')} onClose={() => setEditing(false)}>
          <BecomeSpecialistForm
            existing={listing}
            onCancel={() => setEditing(false)}
            onSaved={saved => {
              onChange(saved)
              setEditing(false)
              notify(t('form.saved'), 'success')
            }}
          />
        </Sheet>
      )}
    </>
  )
}
