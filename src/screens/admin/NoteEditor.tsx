import { useEffect, useState } from 'react'
import { fetchNote, saveNote } from '../../lib/admin'
import { useToast } from '../../toast'
import { useI18n } from '../../i18n'
import { Loader2 } from '../../icons'

/** Internal note (visible to the team only) attached to a client, order or specialist. */
export default function NoteEditor({ kind, keyId }: { kind: 'client' | 'order' | 'specialist'; keyId: string }) {
  const { t } = useI18n()
  const { notify } = useToast()
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchNote(kind, keyId)
      .then(n => { if (!cancelled) { setNote(n); setSaved(n) } })
      .catch(err => console.error('Failed to load note', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [kind, keyId])

  async function save() {
    setBusy(true)
    try {
      await saveNote(kind, keyId, note.trim())
      setSaved(note.trim())
      notify(t('admin.noteSaved'), 'success')
    } catch (err) {
      console.error('Failed to save note', err)
      notify(t('err.updateSession'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader2 className="spin" size={18} color="var(--accent-text)" strokeWidth={2} />

  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'rgba(var(--fg-rgb),calc(0.5 * var(--tb)))' }}>{t('admin.notes')}</p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={t('admin.notesPlaceholder')}
        style={{ width: '100%', background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 12, padding: '10px 12px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', resize: 'vertical' }}
      />
      <button
        onClick={save}
        disabled={busy || note.trim() === saved}
        style={{ marginTop: 8, padding: '8px 16px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, background: '#0ABAB5', color: '#080808', opacity: busy || note.trim() === saved ? 0.5 : 1 }}
      >
        {t('admin.saveNote')}
      </button>
    </div>
  )
}
