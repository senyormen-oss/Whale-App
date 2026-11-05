import { useTheme, type ThemeMode } from './theme'
import { useI18n } from './i18n'
import { Sun, Moon, Monitor, type IconType } from './icons'

const OPTIONS: { mode: ThemeMode; icon: IconType; key: 'theme.light' | 'theme.dark' | 'theme.system' }[] = [
  { mode: 'light', icon: Sun, key: 'theme.light' },
  { mode: 'dark', icon: Moon, key: 'theme.dark' },
  { mode: 'system', icon: Monitor, key: 'theme.system' },
]

/** Light / Dark / System switch with a sliding highlight. `compact` shows icons only. */
export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme()
  const { t } = useI18n()
  const index = OPTIONS.findIndex(o => o.mode === mode)

  return (
    <div
      role="radiogroup"
      aria-label={t('dash.theme')}
      className="glass"
      style={{ position: 'relative', display: 'inline-flex', borderRadius: 12, padding: 3, width: compact ? 120 : '100%', maxWidth: compact ? undefined : 320 }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 3, bottom: 3, left: 3, width: `calc((100% - 6px) / ${OPTIONS.length})`,
          borderRadius: 9, background: '#0ABAB5', transform: `translateX(${index * 100}%)`,
          transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
        }}
      />
      {OPTIONS.map(o => {
        const Icon = o.icon
        const active = o.mode === mode
        return (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(o.key)}
            title={t(o.key)}
            onClick={() => setMode(o.mode)}
            style={{
              position: 'relative', flex: 1, padding: compact ? '6px 0' : '9px 0', border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: active ? '#080808' : 'rgba(var(--fg-rgb),0.55)', transition: 'color 0.25s ease',
            }}
          >
            <Icon size={15} strokeWidth={2} />
            {!compact && t(o.key)}
          </button>
        )
      })}
    </div>
  )
}
