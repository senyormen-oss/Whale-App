import type { CSSProperties } from 'react'

/** Pill-style tab switcher whose highlight slides smoothly between options. */
export default function Segmented<T extends string>({ options, value, onChange, style, radius = 14, fontSize = 13 }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  style?: CSSProperties
  radius?: number
  fontSize?: number
}) {
  const index = Math.max(0, options.findIndex(o => o.value === value))
  const gap = 4
  return (
    <div className="glass" style={{ position: 'relative', display: 'flex', borderRadius: radius, padding: gap, ...style }}>
      <span
        aria-hidden
        style={{
          position: 'absolute', top: gap, bottom: gap, left: gap,
          width: `calc((100% - ${gap * 2}px) / ${options.length})`,
          borderRadius: radius - 4, background: '#0ABAB5',
          transform: `translateX(${index * 100}%)`,
          transition: 'transform 0.32s cubic-bezier(.4,0,.2,1)',
          boxShadow: '0 4px 14px rgba(10,186,181,0.35)',
        }}
      />
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          style={{
            position: 'relative', flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
            fontSize, fontWeight: 700, color: o.value === value ? '#080808' : 'rgba(255,255,255,0.5)',
            transition: 'color 0.25s ease',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
