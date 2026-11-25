import { unlockedSanctuary } from '../../engine/rewards'

/** A glass-dome miniature home that gains objects as progress grows (SVG only). */
export function Sanctuary({ xp }: { xp: number }) {
  const u = Object.fromEntries(unlockedSanctuary(xp).map((i) => [i.id, i.unlocked])) as Record<string, boolean>
  return (
    <svg viewBox="0 0 320 200" className="mt-3 w-full" role="img" aria-label="My Sanctuary">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf5ec" />
          <stop offset="1" stopColor="#e7dcef" />
        </linearGradient>
        <linearGradient id="floor" x1="0" x2="1">
          <stop offset="0" stopColor="#efe4d2" />
          <stop offset="1" stopColor="#e2d3bc" />
        </linearGradient>
      </defs>
      {/* dome */}
      <path d="M30 170 C30 60 290 60 290 170 Z" fill="url(#sky)" stroke="rgba(255,255,255,.9)" strokeWidth="2" />
      <ellipse cx="160" cy="172" rx="134" ry="14" fill="url(#floor)" />
      <ellipse cx="160" cy="180" rx="140" ry="10" fill="#f7f3ed" stroke="rgba(255,255,255,.9)" />
      {/* base home: a soft room */}
      <rect x="120" y="112" width="80" height="56" rx="10" fill="#f7efe3" stroke="#e1d2bb" />
      <path d="M112 116 L160 84 L208 116" fill="none" stroke="#d8c6aa" strokeWidth="3" strokeLinecap="round" />
      <rect x="150" y="138" width="20" height="30" rx="4" fill="#e3d1b6" />
      {u.office && (
        <g>
          <rect x="62" y="140" width="44" height="4" rx="2" fill="#c9b18e" />
          <rect x="66" y="144" width="3" height="22" fill="#c9b18e" />
          <rect x="99" y="144" width="3" height="22" fill="#c9b18e" />
          <rect x="74" y="124" width="24" height="16" rx="2" fill="#645b7c" />
          <circle cx="86" cy="132" r="2" fill="#e9d8b4" />
        </g>
      )}
      {u.books && (
        <g>
          <rect x="214" y="110" width="34" height="56" rx="3" fill="#ead9bf" stroke="#d8c6aa" />
          {[118, 134, 150].map((y, i) => (
            <g key={y}>
              <rect x="218" y={y} width="5" height="12" fill={['#a99acb', '#d9a6c4', '#9cc5b0'][i]} />
              <rect x="225" y={y} width="4" height="12" fill="#e9c27a" />
              <rect x="231" y={y + 2} width="6" height="10" fill="#8e85b0" />
            </g>
          ))}
        </g>
      )}
      {u.garden && (
        <g>
          <ellipse cx="60" cy="166" rx="18" ry="4" fill="#9cc5b0" />
          <path d="M56 166 C52 150 58 140 60 132 C62 140 68 150 64 166 Z" fill="#8bbca3" />
          <circle cx="262" cy="160" r="6" fill="#9cc5b0" />
          <circle cx="270" cy="156" r="5" fill="#b4d6c3" />
          <circle cx="263" cy="152" r="2" fill="#f2a7b5" />
        </g>
      )}
      {u.family && (
        <g>
          <rect x="128" y="150" width="20" height="10" rx="5" fill="#f2c9a0" />
          <circle cx="182" cy="152" r="5" fill="#f0b8c8" />
          <circle cx="190" cy="155" r="3.5" fill="#f6d9c3" />
        </g>
      )}
      {u.studio && (
        <g>
          <path d="M98 100 L108 128 M108 100 L98 128" stroke="#c9b18e" strokeWidth="2" />
          <rect x="94" y="92" width="18" height="14" rx="1" fill="#fff" stroke="#d9a6c4" />
          <circle cx="103" cy="99" r="3" fill="#d9a6c4" />
        </g>
      )}
      {u.business && (
        <g>
          <circle cx="160" cy="70" r="9" fill="#e9d8b4" />
          <path d="M160 62 C161 68 163 69 168 70 C163 71 161 72 160 78 C159 72 157 71 152 70 C157 69 159 68 160 62 Z" fill="#fff" />
        </g>
      )}
      <path d="M60 120 C70 90 100 72 130 66" stroke="#fff" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
