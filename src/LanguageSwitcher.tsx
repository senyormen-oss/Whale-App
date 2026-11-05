import { LANGS, useI18n } from './i18n'

/** Segmented EN / RU / UZ control with a sliding highlight. */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n()
  const index = LANGS.findIndex(l => l.code === lang)

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="glass"
      style={{ position: 'relative', display: 'inline-flex', borderRadius: 12, padding: 3, width: compact ? 138 : '100%', maxWidth: compact ? undefined : 320 }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 3, bottom: 3, left: 3, width: `calc((100% - 6px) / ${LANGS.length})`,
          borderRadius: 9, background: '#0ABAB5', transform: `translateX(${index * 100}%)`,
          transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
        }}
      />
      {LANGS.map(l => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={lang === l.code}
          onClick={() => setLang(l.code)}
          title={l.name}
          style={{
            position: 'relative', flex: 1, padding: compact ? '6px 0' : '9px 0', border: 'none', background: 'transparent',
            fontSize: compact ? 12 : 13, fontWeight: 800, letterSpacing: '0.03em',
            color: lang === l.code ? '#080808' : 'rgba(255,255,255,0.55)', transition: 'color 0.25s ease',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
