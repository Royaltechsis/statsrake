'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimResult, SimEvent } from '../lib/sim';
import { svcById, planOf } from '../lib/plans';
import { RakeIcon } from './Rake';

export const rakeName = (serviceId: string, planId: string) => {
  const s = (svcById(serviceId)?.name || serviceId).replace(/ \(.*\)$/, '').replace(/ (Postgres|Channels|API|Redis)$/, '');
  const p = planOf(serviceId, planId)?.name || planId;
  return `${s} ${/^free/i.test(p) ? 'free' : p.replace(/ \(.*\)$/, '')}`;
};

export default function RakeTimeline({ res }: { res: SimResult }) {
  const months = res.horizon === 'months12';
  const N = res.frames.length;
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fw, setFw] = useState(800);
  useEffect(() => {
    const el = fieldRef.current; if (!el) return;
    const f = () => setFw(el.clientWidth || 800); f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const small = fw < 520;
  const rakes = useMemo(() => {
    const seen = new Set<string>();
    const out: (SimEvent & { pct: number; row: number; name: string; align: string })[] = [];
    const rowsEnd: number[] = [];
    for (const e of res.events) {
      if (e.kind !== 'break' && e.kind !== 'paying') continue;
      if (seen.has(e.serviceId)) continue;
      seen.add(e.serviceId);
      const pct = N > 1 ? (e.step - 1) / (N - 1) : 0;
      const name = rakeName(e.serviceId, e.planId);
      // estimate the label's pixel extent so labels never overlap, then stack into rows
      const w = (String(e.step).length + 2 + name.length) * (small ? 6.6 : 7.2) + 18;
      const x = pct * fw;
      const align = x - w / 2 < -6 ? 'al' : x + w / 2 > fw + 6 ? 'ar' : '';
      const left = align === 'al' ? x - 16 : align === 'ar' ? x - w + 16 : x - w / 2;
      let row = rowsEnd.findIndex(end => left > end + 6);
      if (row < 0) { row = rowsEnd.length; }
      rowsEnd[row] = left + w;
      out.push({ ...e, pct, row, name, align });
    }
    return out;
  }, [res, N, fw, small]);
  const [sel, setSel] = useState(0);
  const [hit, setHit] = useState(0);
  const rows = Math.max(1, ...rakes.map(r => r.row + 1));
  const ticks = months ? [1, 3, 6, 9, 12].filter(t => t <= N) : [1, 7, 14, 21, N];
  const cur = rakes[Math.min(sel, rakes.length - 1)];
  const tag = (e: SimEvent) => (months ? 'M' : 'D') + e.step;

  if (!rakes.length) return <div className="rt-empty">No rakes in this run. The grass is clear for {N} {months ? 'months' : 'days'}. Push the launch spike or growth higher to find your first one.</div>;

  return (
    <div className="rt" id="raketimeline">
      <div className="rt-field" ref={fieldRef} style={{ height: 80 + rows * 28 }}>
        {rakes.map((r, i) => (
          <button key={r.serviceId} type="button"
            className={'rk ' + r.kind + (i === sel ? ' on' : '') + (i === sel && hit ? ' smack' : '') + (r.align ? ' ' + r.align : '')}
            style={{ left: `calc(${(r.pct * 100).toFixed(2)}% )` }}
            onClick={() => { setSel(i); setHit(h => h + 1); }}
            aria-pressed={i === sel}
            aria-label={`${tag(r)}: ${r.name}. ${r.title}`}>
            <span className="rk-lbl" style={{ bottom: 60 + r.row * 28 }}><b>{tag(r)}</b> {r.name}</span>
            <span className="rk-stem" style={{ height: 16 + r.row * 28 }} />
            <span className="rk-ic" key={i === sel ? hit : 0}><RakeIcon size={52} /><span className="pow" aria-hidden="true">SMACK!</span></span>
          </button>
        ))}
        <div className="rt-grass" />
      </div>
      <div className="rt-axis" aria-hidden="true">
        {ticks.map(t => <span key={t} style={{ left: `${N > 1 ? ((t - 1) / (N - 1)) * 100 : 0}%` }}>{months ? 'M' : small ? 'D' : 'Day '}{t}</span>)}
      </div>
      {cur && (
        <div className={'rt-detail ' + cur.kind} aria-live="polite">
          <div className="rt-when">{cur.when}<span>~{cur.dau.toLocaleString('en-US')} daily users</span></div>
          <div className="rt-title">{cur.title}</div>
          <div className="rt-imp">{cur.kind === 'break' ? 'What users feel: ' : ''}{cur.impact}</div>
        </div>
      )}
      <p className="note">Tap a rake to step on it. {rakes.length} rake{rakes.length > 1 ? 's' : ''} in {N} {months ? 'months' : 'days'}; red ones break your app, blue ones start billing.</p>
    </div>
  );
}
