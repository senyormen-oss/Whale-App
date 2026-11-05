import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from './icons'

/** Themed dropdown replacing the browser's native <select> popup. */
export function Select<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [openUp, setOpenUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  function openList() {
    // The fixed bottom navigation covers ~110px; open upwards when the list would be hidden behind it.
    const rect = rootRef.current?.getBoundingClientRect()
    if (rect) setOpenUp(window.innerHeight - rect.bottom - 110 < 270 && rect.top > 280)
    setActive(Math.max(0, options.findIndex(o => o.value === value)))
    setOpen(true)
  }

  function choose(v: T) {
    onChange(v)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active].value) }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'rgba(var(--fg-rgb),0.05)', border: `1px solid ${open ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.1)'}`,
          borderRadius: 12, padding: '12px 14px', color: 'var(--ink)', fontSize: 14, fontFamily: 'Outfit, sans-serif',
          textAlign: 'left', transition: 'border-color 0.2s ease',
        }}
      >
        <span>{current?.label}</span>
        <ChevronDown size={16} strokeWidth={2} style={{ transition: 'transform 0.25s ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="select-list"
          style={{
            position: 'absolute', zIndex: 60, left: 0, right: 0, margin: 0, padding: 6,
            ...(openUp ? { bottom: 'calc(100% + 6px)', transformOrigin: 'bottom center' } : { top: 'calc(100% + 6px)' }),
            listStyle: 'none', maxHeight: 260, overflowY: 'auto', borderRadius: 14,
            background: 'var(--sheet)', border: '1px solid rgba(var(--fg-rgb),0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
          }}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              className="select-option"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px',
                borderRadius: 10, fontSize: 14, cursor: 'pointer',
                color: o.value === value ? 'var(--accent-text)' : 'var(--ink)', fontWeight: o.value === value ? 700 : 500,
              }}
            >
              {o.label}
              {o.value === value && <Check size={15} strokeWidth={2.4} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Animated checkbox (replaces the native control). Clicking the label toggles it too. */
export function Checkbox({ checked, onChange, children }: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: 'rgba(var(--fg-rgb),calc(0.6 * var(--tb)))', lineHeight: 1.5 }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 0, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: checked ? '#0ABAB5' : 'transparent',
          border: `1.5px solid ${checked ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.3)'}`,
          color: '#080808', transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
        }}
      >
        <Check
          size={14}
          strokeWidth={3}
          style={{ opacity: checked ? 1 : 0, transform: checked ? 'scale(1)' : 'scale(0.4)', transition: 'opacity 0.18s ease, transform 0.22s cubic-bezier(.22,.68,0,1.4)' }}
        />
      </button>
      <span>{children}</span>
    </div>
  )
}
