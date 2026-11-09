import { useState } from 'react'
import { CATEGORIES, categoryLabel } from '../data'
import { useI18n } from '../i18n'
import { Select } from '../Controls'
import { useAuth } from '../auth'
import { createSpecialistListing, updateSpecialistListing } from '../lib/queries'
import type { Specialist, CategoryKey } from '../types'
import { Briefcase, AlertCircle } from '../icons'

interface Props {
  /** Called after a new listing is created. */
  onCreated?: (specialist: Specialist) => void
  /** When set, the form edits this listing instead of creating a new one. */
  existing?: Specialist
  onSaved?: (specialist: Specialist) => void
  onCancel?: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)',
  borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif',
  outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', marginBottom: 6, fontWeight: 600 }

export default function BecomeSpecialistForm({ onCreated, existing, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const { user } = useAuth()
  const editing = !!existing
  const [categoryKey, setCategoryKey] = useState<CategoryKey>(existing?.categoryKey ?? CATEGORIES[0].key)
  const [city, setCity] = useState(existing?.city ?? '')
  const [age, setAge] = useState(existing ? String(existing.age) : '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [experience, setExperience] = useState(existing ? String(existing.experience) : '')
  const [qualification, setQualification] = useState(existing?.qualification ?? '')
  const [tags, setTags] = useState(existing ? existing.tags.join(', ') : '')
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
    const expNum = experience === '' ? 0 : Number(experience)
    if (!Number.isFinite(expNum) || expNum < 0 || expNum > 60) {
      setError(t('form.expRange'))
      return
    }
    if (priceNum < 1000 || priceNum > 100_000_000) {
      setError(t('form.priceRange'))
      return
    }

    const category = CATEGORIES.find(c => c.key === categoryKey)!
    const fields = {
      category: category.label,
      categoryKey: category.key,
      city: city.trim(),
      age: ageNum,
      price: priceNum,
      bio: bio.trim(),
      experience: Math.round(expNum),
      qualification: qualification.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12),
    }

    setBusy(true)
    try {
      if (existing) {
        const saved = await updateSpecialistListing(existing.id, fields)
        onSaved?.(saved)
      } else {
        const fullName = (user.user_metadata?.full_name as string) || user.email || t('dash.specialist')
        const avatar = (user.user_metadata?.avatar_url as string | undefined)
          || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=0ABAB5`
        const specialist = await createSpecialistListing(user.id, { name: fullName, avatar, ...fields })
        onCreated?.(specialist)
      }
    } catch (err) {
      console.error('Failed to save listing', err)
      setError(t('form.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass fade-in" style={{ borderRadius: 20, padding: 20, border: '1px solid rgba(10,186,181,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Briefcase size={18} color="var(--accent-text)" strokeWidth={2} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{editing ? t('form.editTitle') : t('form.title')}</h3>
      </div>
      {!editing && (
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))', lineHeight: 1.5 }}>
          {t('form.intro')}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: editing ? 14 : 0 }}>
        <div>
          <label style={labelStyle}>{t('form.category')}</label>
          <Select<CategoryKey>
            value={categoryKey}
            onChange={setCategoryKey}
            ariaLabel={t('form.category')}
            options={CATEGORIES.map(c => ({ value: c.key as CategoryKey, label: categoryLabel(c.key) }))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('form.city')}</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder={t('form.cityPlaceholder')} maxLength={60} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('spec.stat.age')}</label>
            <input value={age} onChange={e => setAge(e.target.value)} type="number" inputMode="numeric" min={16} max={99} placeholder="25" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t('form.price')}</label>
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" inputMode="numeric" min={0} step={1000} placeholder="250000" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>{t('spec.stat.experience')} ({t('form.years')})</label>
          <input value={experience} onChange={e => setExperience(e.target.value)} type="number" inputMode="numeric" min={0} max={60} placeholder="3" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>{t('form.bio')}</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder={t('form.bioPlaceholder')} maxLength={1000} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Outfit, sans-serif' }} />
        </div>

        <div>
          <label style={labelStyle}>{t('form.qualification')}</label>
          <textarea value={qualification} onChange={e => setQualification(e.target.value)} rows={2} maxLength={600} placeholder={t('form.qualificationPlaceholder')} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Outfit, sans-serif' }} />
        </div>

        <div>
          <label style={labelStyle}>{t('form.tags')}</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder={t('form.tagsPlaceholder')} maxLength={200} style={inputStyle} />
        </div>

        {error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff4d6d', fontSize: 12.5 }}>
            <AlertCircle size={14} strokeWidth={2} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {editing && onCancel && (
            <button type="button" onClick={onCancel} disabled={busy} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: 'rgba(var(--fg-rgb),0.08)', color: 'var(--ink)', fontSize: 15, fontWeight: 700 }}>
              {t('common.cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className={busy ? '' : 'tiffany-glow'}
            style={{
              flex: 2, padding: '14px 0', borderRadius: 14, border: 'none',
              background: '#0ABAB5', color: '#080808', fontSize: 15, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
              opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? t('form.creating') : editing ? t('form.save') : t('form.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
