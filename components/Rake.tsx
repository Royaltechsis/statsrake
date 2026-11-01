// Minimal schematic rake mark: handle, bow, head and tines, the centre tine marked.
export function RakeMark({ size = 28, title, color = '#0d2b4e', accent = '#ffb347' }: { size?: number; title?: string; color?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} className="rake-mark">
      <g fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="square">
        <path d="M16 2.5 V15" />
        <path d="M16 15 C10 15 7 16 5.5 18.5 M16 15 C22 15 25 16 26.5 18.5" strokeWidth="1.5" />
        <rect x="4" y="18.5" width="24" height="3" />
        <path d="M6.5 21.5 V28.5 M11.5 21.5 V28.5 M20.5 21.5 V28.5 M25.5 21.5 V28.5" />
      </g>
      <path d="M16 21.5 V29.5" stroke={accent} strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}
