import type { CompanionId } from '../../types'
import { COMPANIONS } from '../../data/seed'

/** Original glossy "bubble" avatars for the five companions (SVG, no external assets). */
const STYLE: Record<CompanionId, { hair: string; skin: string; outfit: string; accent: string; hairShape: 'bob' | 'short' | 'bun' | 'wave' | 'spiky' }> = {
  j: { hair: '#2f2640', skin: '#f6d9c3', outfit: '#8f7fbf', accent: '#e9d8b4', hairShape: 'bob' },
  atlas: { hair: '#3b3350', skin: '#e9c5a8', outfit: '#4f476a', accent: '#a99acb', hairShape: 'short' },
  muse: { hair: '#7a4a6e', skin: '#f8dccb', outfit: '#d9a6c4', accent: '#fff0f6', hairShape: 'wave' },
  bloom: { hair: '#4a3a2e', skin: '#f3d2b8', outfit: '#9cc5b0', accent: '#eaf6ee', hairShape: 'bun' },
  spark: { hair: '#c98a2e', skin: '#f6d6bc', outfit: '#e9c27a', accent: '#fff6e0', hairShape: 'spiky' },
}

export function Avatar({ id, size = 56, ring = true }: { id: CompanionId; size?: number; ring?: boolean }) {
  const s = STYLE[id]
  const c = COMPANIONS[id]
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${c.name} — ${c.roleTh}`}>
      <defs>
        <radialGradient id={`bub-${id}`} cx="35%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="55%" stopColor={c.color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c.color} stopOpacity="0.75" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#bub-${id})`} stroke={ring ? 'rgba(255,255,255,0.9)' : 'none'} strokeWidth="2" />
      {/* body */}
      <path d="M24 92 C26 72 38 66 50 66 C62 66 74 72 76 92 Z" fill={s.outfit} />
      {/* hair back */}
      {s.hairShape === 'bob' && <path d="M26 48 C24 24 40 16 50 16 C62 16 77 24 74 50 L74 62 L26 62 Z" fill={s.hair} />}
      {s.hairShape === 'wave' && <path d="M24 50 C20 22 40 14 52 15 C68 16 80 28 76 56 C78 66 72 70 70 64 L30 64 C26 70 20 64 24 50 Z" fill={s.hair} />}
      {s.hairShape === 'bun' && (
        <>
          <circle cx="50" cy="14" r="9" fill={s.hair} />
          <path d="M28 46 C26 26 40 19 50 19 C62 19 74 26 72 46 Z" fill={s.hair} />
        </>
      )}
      {/* face */}
      <ellipse cx="50" cy="46" rx="19" ry="20" fill={s.skin} />
      {/* fringe */}
      {s.hairShape === 'bob' && <path d="M31 40 C34 26 46 22 56 24 C64 26 69 32 69 40 C60 34 48 36 40 32 C38 36 34 39 31 40 Z" fill={s.hair} />}
      {s.hairShape === 'short' && <path d="M30 42 C28 24 42 18 52 19 C64 20 72 28 70 42 C66 34 58 30 50 31 C42 31 34 35 30 42 Z" fill={s.hair} />}
      {s.hairShape === 'wave' && <path d="M31 42 C33 28 44 22 54 24 C62 26 68 33 69 40 C60 32 46 30 31 42 Z" fill={s.hair} />}
      {s.hairShape === 'bun' && <path d="M31 40 C34 28 44 24 52 25 C60 26 67 31 69 40 C58 33 44 33 31 40 Z" fill={s.hair} />}
      {s.hairShape === 'spiky' && <path d="M29 42 L33 22 L40 30 L45 17 L51 28 L57 16 L61 29 L68 21 L71 42 C64 34 56 31 50 31 C43 31 35 35 29 42 Z" fill={s.hair} />}
      {/* eyes */}
      <ellipse cx="42.5" cy="48" rx="3.2" ry="3.8" fill="#2c2540" />
      <ellipse cx="57.5" cy="48" rx="3.2" ry="3.8" fill="#2c2540" />
      <circle cx="43.6" cy="46.6" r="1.1" fill="#fff" />
      <circle cx="58.6" cy="46.6" r="1.1" fill="#fff" />
      {/* cheeks + smile */}
      <ellipse cx="37" cy="55" rx="3.4" ry="2" fill="#f2a7b5" opacity="0.6" />
      <ellipse cx="63" cy="55" rx="3.4" ry="2" fill="#f2a7b5" opacity="0.6" />
      <path d="M45.5 56 Q50 60 54.5 56" stroke="#7a4b5a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* accent orb held */}
      <circle cx="50" cy="80" r="6" fill={s.accent} stroke="#fff" strokeWidth="1" opacity="0.95" />
      {/* gloss */}
      <ellipse cx="32" cy="20" rx="12" ry="6" fill="#fff" opacity="0.45" transform="rotate(-30 32 20)" />
    </svg>
  )
}
