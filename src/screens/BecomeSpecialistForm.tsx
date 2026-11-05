import { useState } from 'react'
import { CATEGORIES, categoryLabel } from '../data'
import { useI18n } from '../i18n'
import { useAuth } from '../auth'
import { createSpecialistListing } from '../lib/queries'
import type { Specialist, CategoryKey } from '../types'
import { Briefcase, AlertCircle } from '../icons'

interface Props {
  onCreated: (specialist: Specialist) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 14, fontFamily: 'Outfit, sans-serif',
  outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }

export default function BecomeSpecialistForm({ onCreated }: Props) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [categoryKey, setCategoryKey] = useState<CategoryKey>(CATEGORIES[0].key)
  const [city, setCity] = useState('')
  const [age, setAge] = useState('')
  const [price, setPrice] = useState('')
  const [bio, setBio] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    const ageNum = Number(age)
    const priceNum = Number(price)
    if (!city.trim() || !bio.trim() || !ageNum || !priceNum) {
      setError(t('auth.fillAll'))
      return
    }
    if (ageNum < 16 || ageNum > 99) {
      setError(t('form.ageRange'))
      return
    }
    if (priceNum < 1000 || priceNum > 100_000_000) {
      setError(t('form.priceRange'))
      return
    }

    const category = CATEGORIES.find(c => c.key === categoryKey)!
    const fullName = (user.user_metadata?.full_name as string) || user.email || t('dash.specialist')
    const avatar = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=0ABAB5`

    setBusy(true)
    try {
      const specialist = await createSpecialistListing(user.id, {
        name: fullName,
        category: category.label,
        categoryKey: category.key,
        city: city.trim(),
        age: ageNum,
        price: priceNum,
        bio: bio.trim(),
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        avatar,
      })
      onCreated(specialist)
    } catch (err) {
      setError(t('form.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass fade-in" style={{ borderRadius: 20, padding: 20, border: '1px solid rgba(10,186,181,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Briefcase size={18} color="#0ABAB5" strokeWidth={2} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{t('form.title')}</h3>
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
        {t('form.intro')}
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>{t('form.category')}</label>
          <select value={categoryKey} onChange={e => setCategoryKey(e.target.value as CategoryKey)} style={{ ...inputStyle, appearance: 'auto' }}>
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key} style={{ background: '#111' }}>{categoryLabel(c.key)}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('form.city')}</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder={t('form.cityPlaceholder')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('spec.stat.age')}</label>
            <input value={age} onChange={e => setAge(e.target.value)} type="number" min={16} max={99} placeholder="25" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t('form.price')}</label>
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" min={0} step={1000} placeholder="250000" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>{t('form.bio')}</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder={t('form.bioPlaceholder')} maxLength={1000} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Outfit, sans-serif' }} />
        </div>

        <div>
          <label style={labelStyle}>{t('form.tags')}</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder={t('form.tagsPlaceholder')} style={inputStyle} />
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff4d6d', fontSize: 12.5 }}>
            <AlertCircle size={14} strokeWidth={2} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className={busy ? '' : 'tiffany-glow'}
          style={{
            marginTop: 4, padding: '14px 0', borderRadius: 14, border: 'none',
            background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
            opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? t('form.creating') : t('form.create')}
        </button>
      </form>
    </div>
  )
}
