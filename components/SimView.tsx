'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimResult, NodeState, SimEvent } from '../lib/sim';
import type { Selection } from '../lib/types';
import { svcById, planOf, FX } from '../lib/plans';

type N = { id: string; label: string; sub: string; x: number; y: number; state?: NodeState; filter?: (k: string) => boolean; from: string };
const W = 130, H = 58;
const HOST_KEYS = new Set(['bandwidthGB', 'edgeRequests', 'imageTransforms', 'credits']);
const FN_KEYS = new Set(['fnInvocations', 'cpuHours', 'memGBHours', 'credits']);
const COLORS = { ok: '#0f8a5f', warn: '#b7791f', over: '#c2410c', paying: '#0a7ea8' } as const;

function subset(st: NodeState | undefined, keys: Set<string>): NodeState | undefined {
  if (!st) return st;
  const metrics = st.metrics.filter(m => keys.has(m.key));
  if (!metrics.length) return { ...st, metrics: [], pct: st.status === 'paying' ? st.pct : 0, status: st.status === 'paying' ? 'paying' : 'ok' };
  const worst = metrics[0];
  const plan = planOf(st.serviceId, st.planId);
  const status = worst.pct >= 1 ? (plan?.overage?.[worst.key] != null ? 'paying' : 'over') : worst.pct >= 0.75 ? 'warn' : 'ok';
  return { ...st, metrics, worst, pct: worst.pct, status };
}

export default function SimView({ res, sel, onDone }: { res: SimResult; sel: Selection[]; onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const f = () => setNarrow(window.innerWidth < 640); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const VW = narrow ? 440 : 825;
  const [playing, setPlaying] = useState(true);
  const steps = res.frames.length;
  const frame = res.frames[Math.min(step, steps - 1)];
  const months = res.horizon === 'months12';

  useEffect(() => { setStep(0); setPlaying(true); }, [res]);
  useEffect(() => {
    if (!playing) return;
    if (step >= steps - 1) { setPlaying(false); onDone?.(); return; }
    const t = setTimeout(() => setStep(s => s + 1), months ? 700 : 280);
    return () => clearTimeout(t);
  }, [playing, step, steps, months, onDone]);

  const nodes: N[] = useMemo(() => {
    const L = narrow
      ? { users: [220, 55], host: [220, 165], api: [220, 285], db: [220, 405], slots: [[80, 285], [360, 285], [80, 405], [360, 405], [80, 525], [360, 525], [220, 525]] }
      : { users: [70, 220], host: [225, 220], api: [395, 220], db: [590, 220], slots: [[470, 72], [620, 72], [755, 72], [470, 368], [620, 368], [755, 368], [755, 220]] };
    const out: N[] = [{ id: 'users', label: 'Your users', sub: '', x: L.users[0], y: L.users[1], from: '' }];
    const host = sel.find(s => svcById(s.serviceId)?.category === 'host');
    const hsvc = host && svcById(host.serviceId);
    out.push({ id: 'host', label: hsvc ? hsvc.name : 'Host', sub: host ? planOf(host.serviceId, host.planId)?.name || '' : 'not set', x: L.host[0], y: L.host[1], filter: k => HOST_KEYS.has(k), from: 'users' });
    out.push({ id: 'api', label: 'Server functions', sub: hsvc ? hsvc.name : 'API', x: L.api[0], y: L.api[1], filter: k => FN_KEYS.has(k), from: 'host' });
    const db = sel.find(s => svcById(s.serviceId)?.category === 'db');
    const rest = sel.filter(s => !['host'].includes(svcById(s.serviceId)?.category || '') && s !== db);
    if (db) out.push({ id: db.serviceId, label: svcById(db.serviceId)!.name, sub: planOf(db.serviceId, db.planId)?.name || '', x: L.db[0], y: L.db[1], from: 'api' });
    const slots = L.slots;
    rest.slice(0, slots.length).forEach((s, i) => {
      const svc = svcById(s.serviceId)!;
      out.push({ id: s.serviceId, label: svc.name.replace(/ \(.*\)$/, '').replace(' Channels', '').replace(' API', ''), sub: planOf(s.serviceId, s.planId)?.name || '', x: slots[i][0], y: slots[i][1], from: 'api' });
    });
    return out;
  }, [sel, narrow]);

  const VH = narrow ? Math.max(...nodes.map(n => n.y)) + 62 : 440;
  const states: Record<string, NodeState | undefined> = {};
  for (const n of nodes) {
    if (n.id === 'users') continue;
    if (n.id === 'host' || n.id === 'api') {
      const host = sel.find(s => svcById(s.serviceId)?.category === 'host');
      states[n.id] = host ? subset(frame.nodes[host.serviceId], n.id === 'host' ? HOST_KEYS : FN_KEYS) : undefined;
    } else states[n.id] = frame.nodes[n.id];
  }

  // particles, drawn imperatively so React does not re-render every frame
  const gRef = useRef<SVGGElement>(null);
  const live = useRef({ nodes, states, frame });
  live.current = { nodes, states, frame };
  useEffect(() => {
    const g = gRef.current; if (!g) return;
    const NS = 'http://www.w3.org/2000/svg';
    const dots: { el: SVGCircleElement; e: number; t: number; v: number }[] = [];
    for (let i = 0; i < 46; i++) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '2.6'); c.setAttribute('opacity', '0'); g.appendChild(c); dots.push({ el: c, e: -1, t: 0, v: 0 }); }
    let raf = 0, last = performance.now(); let acc = 0;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { nodes, states, frame } = live.current;
      const edges = nodes.filter(n => n.from).map(n => ({ a: nodes.find(x => x.id === n.from)!, b: n, st: states[n.id] }));
      const rate = reduce ? 0 : Math.min(40, 6 + Math.log10(1 + frame.dau) * 7);
      acc += rate * dt;
      while (acc > 1) {
        acc -= 1;
        const free = dots.find(d => d.e < 0); if (!free) break;
        const r = Math.random();
        const idx = r < 0.3 ? 0 : r < 0.55 ? 1 : 2 + Math.floor(Math.random() * Math.max(1, edges.length - 2));
        free.e = Math.min(idx, edges.length - 1); free.t = 0; free.v = 0.55 + Math.random() * 0.5;
      }
      for (const d of dots) {
        if (d.e < 0) continue;
        const ed = edges[d.e]; if (!ed) { d.e = -1; d.el.setAttribute('opacity', '0'); continue; }
        d.t += d.v * dt;
        const blocked = ed.st?.status === 'over';
        if (d.t >= 1 || (blocked && d.t > 0.82)) { d.e = -1; d.el.setAttribute('opacity', '0'); continue; }
        const { x: x1, y: y1 } = ed.a, { x: x2, y: y2 } = ed.b;
        const straight = y1 === y2 || x1 === x2;
        const cx = straight ? (x1 + x2) / 2 : x1, cy = straight ? (y1 + y2) / 2 : y2;
        const qx = (1 - d.t) * (1 - d.t) * x1 + 2 * (1 - d.t) * d.t * cx + d.t * d.t * x2;
        const qy = (1 - d.t) * (1 - d.t) * y1 + 2 * (1 - d.t) * d.t * cy + d.t * d.t * y2;
        d.el.setAttribute('cx', qx.toFixed(1)); d.el.setAttribute('cy', qy.toFixed(1));
        d.el.setAttribute('fill', blocked ? '#c2410c' : ed.st?.status === 'warn' ? '#b7791f' : '#0f8a5f');
        d.el.setAttribute('opacity', blocked && d.t > 0.6 ? String(1 - (d.t - 0.6) * 4) : '0.95');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); dots.forEach(d => d.el.remove()); };
  }, []);

  const eventsSoFar: SimEvent[] = res.events.filter(e => e.step <= frame.step).slice().reverse();
  const anyRed = Object.values(states).some(s => s?.status === 'over');
  const path = (a: N, b: N) => a.y === b.y || a.x === b.x ? `M${a.x},${a.y} L${b.x},${b.y}` : `M${a.x},${a.y} Q${a.x},${b.y} ${b.x},${b.y}`;

  return (
    <div className="sim" data-step={frame.step} data-red={anyRed ? '1' : '0'}>
      <div className="simhead">
        <div><span className="lbl">{months ? 'Month' : 'Day'}</span><span className="big-num" id="sim-step">{frame.step}<small style={{ fontSize: 14, color: 'var(--mut)' }}>/{steps}</small></span></div>
        <div><span className="lbl">Daily users</span><span className="big-num">{frame.dau.toLocaleString('en-US')}</span></div>
        <div><span className="lbl">{months ? 'Infra bill this month' : 'Infra bill so far'}</span><span className={'big-num' + (anyRed ? ' red' : '')}>${frame.monthUSD.toFixed(2)}</span> <span className="mono" style={{ color: 'var(--mut)' }}>₦{Math.round(frame.monthUSD * FX).toLocaleString('en-US')}</span></div>
        {frame.feesUSD > 0 && <div><span className="lbl">Payment fees</span><span className="big-num" style={{ fontSize: 18 }}>₦{Math.round(frame.feesUSD * FX).toLocaleString('en-US')}</span></div>}
      </div>
      <svg className="diagram" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={`Stack simulation, ${frame.label}`}>
        <defs><pattern id="gr" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#e8eef5" strokeWidth="1" /></pattern></defs>
        <rect x="0" y="0" width={VW} height={VH} fill="url(#gr)" />
        {nodes.filter(n => n.from).map(n => { const a = nodes.find(x => x.id === n.from)!; return <path key={'e' + n.id} className={'edge' + (states[n.id]?.status === 'over' ? ' hot' : '')} d={path(a, n)} />; })}
        <g ref={gRef} />
        {nodes.map(n => {
          if (n.id === 'users') return (
            <g key={n.id} className="node" transform={`translate(${n.x},${n.y})`}>
              <circle r="40" fill="#ffffff" stroke="#0f8a5f" strokeWidth="1.5" />
              <text className="t1" textAnchor="middle" y="-2">{frame.dau >= 1000 ? (frame.dau / 1000).toFixed(1) + 'k' : frame.dau}</text>
              <text className="t2" textAnchor="middle" y="14">users today</text>
            </g>);
          const st = states[n.id];
          const pct = st ? Math.min(1, st.pct) : 0;
          const col = st ? COLORS[st.status] : '#9fb3c8';
          return (
            <g key={n.id} className={'node ' + (st?.status || '')} data-node={n.id} data-status={st?.status || 'none'} transform={`translate(${n.x - W / 2},${n.y - H / 2})`}>
              <rect className="box" width={W} height={H} rx="12" />
              <text className="t1" x="10" y="20">{n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}</text>
              <text className="t2" x="10" y="34">{n.sub.length > 20 ? n.sub.slice(0, 19) + '…' : n.sub}</text>
              <rect x="10" y="43" width={W - 54} height="6" rx="3" fill="#e3eaf2" />
              <rect x="10" y="43" width={(W - 54) * pct} height="6" rx="3" fill={col} style={{ transition: 'width .25s' }} />
              <text className="pct" x={W - 10} y="50" textAnchor="end" fill={col}>{st ? (st.status === 'paying' && !st.metrics.length ? '$' + st.costUSD.toFixed(0) : Math.round(st.pct * 100) + '%') : ''}</text>
            </g>);
        })}
      </svg>
      <div className="legend"><span><i style={{ background: '#0f8a5f' }} />within plan</span><span><i style={{ background: '#b7791f' }} />75% used</span><span><i style={{ background: '#c2410c' }} />limit hit, users feel it</span><span><i style={{ background: '#0a7ea8' }} />paying per use</span></div>
      <div className="controls noprint">
        <button className="btn ghost" onClick={() => { if (step >= steps - 1) setStep(0); setPlaying(p => !p); }} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Pause' : step >= steps - 1 ? 'Replay' : 'Play'}</button>
        <input type="range" min={0} max={steps - 1} value={step} onChange={e => { setPlaying(false); setStep(+e.target.value); }} aria-label="Timeline" />
        <span className="mono" style={{ minWidth: 70, textAlign: 'right' }}>{frame.label}</span>
      </div>
      <div className="feed" aria-live="polite">
        {eventsSoFar.length === 0 && <div className="ev"><span>All quiet so far. Traffic is flowing.</span></div>}
        {eventsSoFar.slice(0, 12).map((e, i) => (
          <div key={i} className={'ev ' + e.kind}><b>{e.when}: {e.title}</b><span>{e.impact}</span></div>
        ))}
      </div>
    </div>
  );
}
