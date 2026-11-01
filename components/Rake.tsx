// Hand-built SVG art for StatsRake. No external assets.

/** Small logo mark: a rake on a dark tile with the red "smack" dot. */
export function RakeMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#151b25" />
      <path d="M20 46 L48 14" stroke="#d9a066" strokeWidth="5" strokeLinecap="round" />
      <path d="M9 37 L27 53" stroke="#c6f432" strokeWidth="5" strokeLinecap="round" />
      <path d="M12 40 l-5 5 M17.5 44.5 l-5 5 M23 49 l-5 5" stroke="#c6f432" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="51" cy="11" r="5" fill="#ff5a5f" />
    </svg>
  );
}

/** Side view of a rake lying tines-up in grass. The handle group swings up on .smack. */
export function RakeIcon({ size = 44 }: { size?: number }) {
  return (
    <svg className="rk-svg" width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
      <g className="rk-handle">
        <path d="M14 48 L56 33" stroke="#0c0f14" strokeWidth="7" strokeLinecap="round" />
        <path d="M14 48 L56 33" stroke="#d9a066" strokeWidth="4" strokeLinecap="round" />
        <path d="M5 49 L22 47" stroke="#0c0f14" strokeWidth="8" strokeLinecap="round" />
        <path d="M5 49 L22 47" stroke="#e9edf2" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M6 48 v-9 M11.3 47.4 v-9 M16.6 46.8 v-9 M21.6 46.2 v-9" stroke="#e9edf2" strokeWidth="2.8" strokeLinecap="round" />
      </g>
      <path d="M0 56 q3 -6 5 0 q3 -8 5 0 q2 -5 5 0 q3 -7 5 0 q2 -5 5 0 q3 -8 5 0 q2 -5 5 0 q3 -7 6 0 q3 -5 6 0 q3 -7 7 0 q2 -5 6 0 v4 h-60z" fill="#6aa323" />
    </svg>
  );
}

/** The mascot: a rake in round glasses, holding a clipboard of stats. */
export function Mascot({ className = '' }: { className?: string }) {
  const ink = '#0c0f14';
  return (
    <svg className={className} viewBox="0 0 240 300" role="img" aria-label="StatsRake mascot: a rake in round glasses holding a clipboard">
      <ellipse cx="118" cy="284" rx="66" ry="9" fill="#000" opacity=".35" />
      <g transform="rotate(-5 118 170)">
        {/* handle */}
        <rect x="108" y="92" width="16" height="188" rx="8" fill="#d9a066" stroke={ink} strokeWidth="4" />
        <path d="M113 110 v150" stroke="#b97f45" strokeWidth="3" strokeLinecap="round" />
        {/* tines */}
        {[62, 80, 98, 134, 152, 170].map(x => (
          <path key={x} d={`M${x} 88 q1 14 -2 24`} stroke={ink} strokeWidth="10" strokeLinecap="round" fill="none" />
        ))}
        {[62, 80, 98, 134, 152, 170].map(x => (
          <path key={'i' + x} d={`M${x} 88 q1 14 -2 24`} stroke="#cfd6df" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        ))}
        {/* head */}
        <rect x="46" y="40" width="140" height="52" rx="16" fill="#e9edf2" stroke={ink} strokeWidth="4" />
        <path d="M56 52 q30 -8 120 -2" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".8" fill="none" />
        {/* glasses */}
        <circle cx="96" cy="66" r="13" fill="#fff" stroke={ink} strokeWidth="3.5" />
        <circle cx="138" cy="66" r="13" fill="#fff" stroke={ink} strokeWidth="3.5" />
        <path d="M109 64 q8 -5 16 0" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="99" cy="68" r="4.5" fill={ink} />
        <circle cx="141" cy="68" r="4.5" fill={ink} />
        {/* one raised brow, unimpressed */}
        <path d="M83 48 q12 -3 24 1" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M127 45 q12 -8 24 -1" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M108 84 q8 4 18 -2" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {/* arms */}
        <path d="M112 162 q16 26 39 27" stroke={ink} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M120 142 q18 -2 33 4" stroke={ink} strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* clipboard */}
        <g transform="rotate(9 182 176)">
          <rect x="146" y="128" width="74" height="96" rx="8" fill="#9a6633" stroke={ink} strokeWidth="4" />
          <rect x="154" y="140" width="58" height="76" rx="3" fill="#f6f2e6" />
          <rect x="168" y="122" width="30" height="13" rx="4" fill="#93a1b3" stroke={ink} strokeWidth="3" />
          <path d="M160 206 h46" stroke="#93a1b3" strokeWidth="2" />
          <rect x="162" y="186" width="9" height="20" fill="#8fd400" />
          <rect x="175" y="174" width="9" height="32" fill="#ffb547" />
          <rect x="188" y="158" width="9" height="48" fill="#ff5a5f" />
          <path d="M160 152 h22 M160 160 h14" stroke="#93a1b3" strokeWidth="2.5" strokeLinecap="round" />
          <text x="202" y="155" fontSize="14" fontWeight="900" fill="#ff5a5f" fontFamily="system-ui,sans-serif">!</text>
        </g>
        <ellipse cx="151" cy="189" rx="7" ry="6" fill="#d9a066" stroke={ink} strokeWidth="3.5" />
        <ellipse cx="153" cy="146" rx="7" ry="6" fill="#d9a066" stroke={ink} strokeWidth="3.5" />
      </g>
      {/* grass */}
      <path d="M40 286 q6 -22 10 0 q4 -30 10 0 q5 -18 8 0 M160 286 q5 -24 9 0 q4 -16 8 0 q5 -28 10 0" stroke="#8fd400" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
