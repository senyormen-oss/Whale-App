import { getLegalSections } from '../legal'
import { useI18n, formatDate } from '../i18n'
import { LEGAL } from '../legal'
import { ArrowLeft } from '../icons'

export default function LegalScreen({ doc, onBack }: { doc: 'terms' | 'privacy'; onBack: () => void }) {
  const { t, lang } = useI18n()
  const sections = getLegalSections(doc, lang)
  const title = doc === 'terms' ? t('legal.terms') : t('legal.privacy')

  return (
    <div className="fade-in" style={{ background: '#080808', minHeight: '100vh', paddingBottom: 48 }}>
      <div style={{ padding: '52px 20px 16px', display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(180deg, #0f1410 0%, #080808 100%)' }}>
        <button
          onClick={onBack}
          aria-label={t('common.back')}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t('legal.updated', { date: formatDate(LEGAL.updatedIso) })}</p>
        </div>
      </div>

      <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sections.map(section => (
          <section key={section.heading}>
            <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#0ABAB5' }}>{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} style={{ margin: '0 0 8px', fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)' }}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
