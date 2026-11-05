import { useRef, useState } from 'react'
import { useAuth } from './auth'
import { useToast } from './toast'
import { useI18n } from './i18n'
import { uploadChatImage, updateSpecialistAvatarIfAny } from './lib/queries'
import { toSquareAvatar } from './lib/image'
import { User, Camera, Loader2 } from './icons'

/** The signed-in user's photo. With `editable`, tapping it lets them pick a new one. */
export default function UserAvatar({ size, editable = false, onChanged }: { size: number; editable?: boolean; onChanged?: () => void }) {
  const { user, updateAvatar } = useAuth()
  const { notify } = useToast()
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const url = (user?.user_metadata?.avatar_url as string | undefined) || ''

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setBusy(true)
    try {
      const square = await toSquareAvatar(file)
      const newUrl = await uploadChatImage(square, user.id)
      const { error } = await updateAvatar(newUrl)
      if (error) throw new Error(error)
      await updateSpecialistAvatarIfAny(user.id, newUrl).catch(() => {})
      notify(t('toast.avatarUpdated'), 'success')
      onChanged?.()
    } catch (err) {
      notify(err instanceof Error && err.message && !/decode|canvas|encode/.test(err.message) ? err.message : t('err.avatar'))
    } finally {
      setBusy(false)
    }
  }

  const circle = (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', border: '2px solid #0ABAB5', background: 'rgba(10,186,181,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
      }}
    >
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <User size={Math.round(size * 0.44)} color="var(--accent-text)" strokeWidth={1.8} />}
      {busy && (
        <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="spin" size={Math.round(size * 0.35)} color="#fff" strokeWidth={2} />
        </span>
      )}
    </div>
  )

  if (!editable) return circle

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={t('dash.changePhoto')}
        title={t('dash.changePhoto')}
        style={{ position: 'relative', background: 'none', border: 'none', padding: 0, display: 'block', borderRadius: '50%' }}
      >
        {circle}
        <span
          style={{
            position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: '50%', background: '#0ABAB5', color: '#080808',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)',
          }}
        >
          <Camera size={12} strokeWidth={2.4} />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} style={{ display: 'none' }} />
    </>
  )
}
