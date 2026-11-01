'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export type BpMark = { step: number; tag: string; name: string; kind: 'break' | 'paying' | 'warn'; label?: string };

type Props = {
  n: number;
  marks: BpMark[];
  ticks: number[];
  unit?: 'day' | 'month';
  dimTo?: number | null;
  dimText?: string;
  headLabel?: string;
  sel?: number;
  onSelect?: (i: number) => void;
  ariaLabel?: string;
  idPrefix?: string;
  minW?: number;
};

const LINE = '#bfe3ff';
const AMB = '#ffb347';
const CY = '#6fe0ff';

// estimated text widths for the monospace labels (IBM Plex Mono)
const wTag = (s: string) => s.length * 8.2;
const wName = (s: string) => s.length * 6.85;

export default function BlueprintRake({ n, marks, ticks, unit = 'day', dimTo = null, dimText, headLabel, sel = -1, onSelect, ariaLabel, idPrefix = 'bp', minW = 300 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setW(Math.max(minW, Math.round(el.clientWidth || 560)));
    f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [minW]);

  const interactive = !!onSelect;
  const pad = W < 420 ? 14 : 22;
  const x0 = pad + 8, x1 = W - pad - 8;
  const X = (s: number) => (n > 1 ? x0 + ((s - 1) / (n - 1)) * (x1 - x0) : x0);
  const sp = n > 1 ? (x1 - x0) / (n - 1) : 20;
  const tw = Math.max(2.5, Math.min(6, sp * 0.42));
  const cx = W / 2;
  const bw = Math.min((x1 - x0) / 2 - 12, 160);
  const handleTop = 4, headY = 122, headH = 10;
  const tineTop = headY + headH, tineLen = 56, tipY = tineTop + tineLen + 7;
  const axisY = tipY + 26;
  const row0 = axisY + 50;

  // place callouts in rows so labels and leader lines never collide
  const stacked = W < 520;
  const rowGap = stacked ? 40 : 30;
  type P = BpMark & { i: number; x: number; row: number; side: 'r' | 'l'; a: number; b: number };
  const widthOf = (m: BpMark) => 22 + (stacked ? Math.max(wTag(m.tag), wName(m.name)) : wTag(m.tag) + 8 + wName(m.name));
  const span = (x: number, w: number, side: 'r' | 'l') => (side === 'r' ? [x - 4, x + w] : [x - w, x + 4]);
  const clashes = (placed: P[], x: number, a: number, b: number, row: number) => placed.some(p =>
    (p.row === row && !(b + 10 < p.a || a - 10 > p.b)) ||
    (p.row < row && x > p.a - 6 && x < p.b + 6) ||
    (p.row > row && p.x > a - 6 && p.x < b + 6));
  const fitSides = (x: number, w: number): ('r' | 'l')[] => {
    const r = x + w <= W - 8, l = x - w >= 8;
    return r && l ? ['r', 'l'] : r ? ['r'] : l ? ['l'] : [x < W / 2 ? 'r' : 'l'];
  };
  const tryPlace = (order: number[], sides: ('r' | 'l')[]): P[] | null => {
    const out: P[] = [];
    for (const i of order) {
      const m = marks[i]; const x = X(m.step); const w = widthOf(m); const side = sides[i];
      const [a, b] = span(x, w, side);
      let row = 0; while (row < 10 && clashes(out, x, a, b, row)) row++;
      if (row >= 10) return null;
      out.push({ ...m, i, x, row, side, a, b });
    }
    return out;
  };
  let placed: P[] = [];
  {
    const idx = marks.map((_, i) => i);
    const asc = [...idx].sort((p, q) => marks[p].step - marks[q].step);
    const orders = [asc, [...asc].reverse()];
    const opts = idx.map(i => fitSides(X(marks[i].step), widthOf(marks[i])));
    let best: P[] | null = null, bestScore = Infinity;
    const combos = marks.length <= 7 ? 1 << marks.length : 1;
    for (let mask = 0; mask < combos; mask++) {
      const sides = idx.map(i => (marks.length <= 7 ? (opts[i][((mask >> i) & 1) % opts[i].length]) : opts[i][0]));
      for (const o of orders) {
        const r = tryPlace(o, sides);
        if (!r) continue;
        const rows = Math.max(0, ...r.map(p => p.row + 1));
        const score = rows * 10 + r.filter(p => p.side === 'l').length * 0.1;
        if (score < bestScore) { best = r; bestScore = score; }
      }
    }
    placed = best || asc.map((i, k) => { const m = marks[i]; const x = X(m.step); const w = widthOf(m); const s = fitSides(x, w)[0]; const [a, b] = span(x, w, s); return { ...m, i, x, row: k, side: s, a, b }; });
  }
  const rows = Math.max(0, ...placed.map(p => p.row + 1));
  const lastRowY = row0 + (rows - 1) * rowGap;
  const dimY = (rows ? lastRowY + (stacked ? 14 : 0) : axisY) + 46;
  const showDim = dimTo != null && dimText;
  const H = (showDim ? dimY + 12 : (rows ? lastRowY + (stacked ? 30 : 18) : axisY + 26));
  const dimX1 = dimTo != null ? X(dimTo) : x0;
  const dimTxtW = (dimText || '').length * 6.3;
  const dimInside = dimX1 - x0 > dimTxtW + 12;

  const tines = Array.from({ length: n }, (_, k) => k + 1);
  const markAt = new Map<number, P>();
  for (const p of placed) if (!markAt.has(p.step) || p.kind === 'break') markAt.set(p.step, p);
  const colorOf = (k: string) => (k === 'paying' ? CY : AMB);

  const key = (i: number) => (e: KeyboardEvent<SVGGElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(i); } };
  const ticksSet = new Set(ticks);
  const pre = unit === 'month' ? 'M' : 'D';

  return (
    <div className="bp-rake" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role={interactive ? 'group' : 'img'} aria-label={ariaLabel} className={interactive ? 'bp-svg live' : 'bp-svg'}>
        <defs>
          <marker id={idPrefix + '-ar'} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill={LINE} /></marker>
        </defs>
        {/* handle with break marks (not to scale) */}
        <g className="bp-handle" stroke={LINE} fill="none" strokeWidth="1.5">
          <rect x={cx - 7} y={handleTop} width="14" height={headY - 34 - handleTop} />
          <line x1={cx - 12} y1={handleTop + 22} x2={cx + 12} y2={handleTop + 14} strokeWidth="1.1" />
          <line x1={cx - 12} y1={handleTop + 29} x2={cx + 12} y2={handleTop + 21} strokeWidth="1.1" />
          <rect x={cx - 9} y={headY - 34} width="18" height="14" />
          <line x1={cx - 9} y1={headY - 29} x2={cx + 9} y2={headY - 29} strokeWidth="0.8" strokeOpacity="0.6" />
          <line x1={cx} y1={headY - 20} x2={cx} y2={headY} />
          <path d={`M${cx - 4},${headY - 20} C${cx - bw * 0.35},${headY - 20} ${cx - bw * 0.9},${headY - 14} ${cx - bw},${headY}`} />
          <path d={`M${cx + 4},${headY - 20} C${cx + bw * 0.35},${headY - 20} ${cx + bw * 0.9},${headY - 14} ${cx + bw},${headY}`} />
        </g>
        <text x={cx + 18} y={handleTop + 46} className="bp-note">HANDLE</text>
        <text x={cx + 18} y={handleTop + 58} className="bp-note">(NOT TO SCALE)</text>
        {headLabel && <g>
          <text x={x0 - 8} y={handleTop + 46} className="bp-note">{headLabel.split(' / ').map((t, k) => <tspan key={k} x={x0 - 8} dy={k ? 12 : 0}>{t}</tspan>)}</text>
          <polyline points={`${x0 - 4},${handleTop + 64} ${x0 - 4},${headY - 4}`} fill="none" stroke={LINE} strokeOpacity="0.6" markerEnd={`url(#${idPrefix}-ar)`} />
        </g>}
        {/* head */}
        <rect x={x0 - 10} y={headY} width={x1 - x0 + 20} height={headH} fill="none" stroke={LINE} strokeWidth="1.6" />
        {/* tines, one per {unit} */}
        {tines.map(k => {
          const x = X(k); const m = markAt.get(k);
          const c = m ? colorOf(m.kind) : LINE;
          const on = m && m.i === sel;
          return <path key={k} className={'bp-tine' + (m ? ' hit ' + m.kind : '') + (on ? ' on' : '')} style={m ? { animationDelay: `${0.25 + placed.indexOf(m) * 0.18}s` } : undefined}
            d={`M${x - tw / 2},${tineTop} L${x - tw / 2},${tineTop + tineLen} L${x},${tipY} L${x + tw / 2},${tineTop + tineLen} L${x + tw / 2},${tineTop}`}
            fill={m ? c : 'none'} fillOpacity={m ? 0.92 : 0} stroke={c} strokeWidth="1.1" />;
        })}
        {/* axis */}
        <line x1={x0} y1={axisY} x2={x1} y2={axisY} stroke={LINE} strokeOpacity="0.8" />
        {tines.map(k => (n <= 31 || ticksSet.has(k)) ? <line key={k} x1={X(k)} y1={axisY - (ticksSet.has(k) ? 5 : 3)} x2={X(k)} y2={axisY + (ticksSet.has(k) ? 5 : 3)} stroke={LINE} strokeOpacity={ticksSet.has(k) ? 0.9 : 0.45} /> : null)}
        {ticks.map(t => <text key={t} x={X(t)} y={axisY + 19} textAnchor="middle" className="bp-tick">{pre}{t}</text>)}
        {/* callouts */}
        {placed.map(p => {
          const y = row0 + p.row * rowGap; const c = colorOf(p.kind); const on = p.i === sel;
          const tx = p.side === 'r' ? p.x + 22 : p.x - 22;
          const anchor = p.side === 'r' ? 'start' : 'end';
          const nameX = stacked ? tx : p.side === 'r' ? tx + wTag(p.tag) + 8 : tx - wTag(p.tag) - 8;
          const nameY = stacked ? y + 18 : y + 4;
          const g = (
            <>
              <path d={`M${p.x},${tipY + 4} V${axisY + 6} M${p.x},${axisY + 25} V${y}`} fill="none" stroke={on ? c : LINE} strokeOpacity={on ? 1 : 0.75} strokeDasharray={on ? undefined : '3 3'} />
              <circle cx={p.x} cy={tipY - 4} r={on ? 10 : 7} fill={on ? c : 'none'} fillOpacity={on ? 0.18 : 0} stroke={c} strokeWidth="1.2" className="bp-ring" />
              <circle cx={p.x} cy={y} r="2.6" fill={c} />
              <line x1={p.x} y1={y} x2={p.side === 'r' ? p.x + 16 : p.x - 16} y2={y} stroke={LINE} />
              {on && <rect x={p.side === 'r' ? p.x + 18 : p.a - 4} y={y - 12} width={p.b - p.a - 14} height={stacked ? 36 : 22} fill={c} fillOpacity="0.14" stroke={c} strokeOpacity="0.6" />}
              <text x={tx} y={y + 4.5} textAnchor={anchor} className="bp-tag" fill={on || !interactive ? '#f2f9ff' : LINE}>{p.tag}</text>
              <text x={nameX} y={nameY} textAnchor={anchor} className="bp-name" fill={on ? c : LINE}>{p.name.toUpperCase()}</text>
            </>
          );
          if (!interactive) return <g key={p.i}>{g}</g>;
          return (
            <g key={p.i} className={'bp-mark' + (on ? ' on' : '')} role="button" tabIndex={0} aria-pressed={on}
              aria-label={p.label || `${p.tag} ${p.name}`} onClick={() => onSelect!(p.i)} onKeyDown={key(p.i)}>
              <rect x={p.x - Math.max(12, sp / 2)} y={headY - 2} width={Math.max(24, sp)} height={y - headY + 2} fill="transparent" />
              <rect x={p.a - 4} y={y - 15} width={p.b - p.a + 8} height={stacked ? 40 : 30} fill="transparent" />
              {g}
            </g>
          );
        })}
        {/* dimension line */}
        {showDim && (dimTo! > 1 ? (
          <g className="bp-dim">
            <line x1={x0} y1={dimY - 9} x2={x0} y2={dimY + 7} stroke={LINE} strokeOpacity="0.6" />
            <line x1={dimX1} y1={dimY - 9} x2={dimX1} y2={dimY + 7} stroke={LINE} strokeOpacity="0.6" />
            <line x1={x0 + 1} y1={dimY} x2={dimX1 - 1} y2={dimY} stroke={LINE} markerStart={`url(#${idPrefix}-ar)`} markerEnd={`url(#${idPrefix}-ar)`} />
            <text x={dimInside ? (x0 + dimX1) / 2 : dimX1 + 8} y={dimInside ? dimY - 6 : dimY + 4} textAnchor={dimInside ? 'middle' : 'start'} className="bp-dimt">{dimText}</text>
          </g>
        ) : (
          <g className="bp-dim">
            <line x1={x0} y1={dimY - 9} x2={x0} y2={dimY + 7} stroke={LINE} strokeOpacity="0.6" />
            <text x={x0 + 8} y={dimY + 4} className="bp-dimt">{dimText}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
