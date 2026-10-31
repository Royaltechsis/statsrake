import { DATA, FX, svcById, planOf, METRIC_LABEL } from './plans';
import type { Inputs, Selection, Plan, Service } from './types';

// Every modelling assumption lives here so it is easy to see and change.
export const ASSUME = {
  cpuMsPerCall: 15,        // active CPU per server function call
  fnSeconds: 0.5,          // wall time per function call (waiting on DB and APIs)
  fnMemGB: 2,              // Vercel default function memory
  fluidShare: 2,           // concurrent requests sharing one instance (fluid compute)
  dbKBPerQuery: 1.5,       // data returned per query
  writeRatio: 0.15,        // share of queries that write
  storageKBPerUserDay: 2,  // new DB data per active user per day
  baseDbGB: 0.05,          // starting DB size
  busyHours: 16,           // traffic is mostly in 16 waking hours (WAT)
  peakFactor: 3,           // busiest minute vs the busy-hours average
  redisPerCall: 2,
  rtMsgsPerUser: 40,
  rtConcurrentShare: 0.08,
  errorsPer1kCalls: 2,
  transformsPerUpload: 4,
  spikeNewUserShare: 0.7,
  repeatWeightShare: 0.35, // later pages in a visit download ~35% of the first page (HTML, data, new images)
  repeatRequestShare: 0.25,
  neonMaxCU: { free: 2, launch: 16, scale: 56 } as Record<string, number>,
};

export type Usage = Record<string, number>;
export const DAY_METRICS = new Set(['fsReadsDay', 'fsWritesDay', 'emailsDay', 'rtMessagesDay', 'aiCallsDay']);
export const LEVEL_METRICS = new Set(['dbStorageGB', 'fileStorageGB', 'mau', 'peakQps', 'rtConcurrent']);

export interface MetricState { key: string; used: number; limit: number; pct: number }
export interface NodeState { serviceId: string; planId: string; pct: number; status: 'ok' | 'warn' | 'over' | 'paying'; worst?: MetricState; metrics: MetricState[]; costUSD: number }
export interface SimEvent { step: number; when: string; dau: number; serviceId: string; planId: string; metric: string; kind: 'warn' | 'break' | 'paying' | 'note'; title: string; impact: string }
export interface Frame { step: number; label: string; dau: number; nodes: Record<string, NodeState>; monthUSD: number; feesUSD: number; events: SimEvent[]; flow: Record<string, number> }
export interface ServiceBill { serviceId: string; planId: string; usd: number; blocked: string[]; lines: string[] }
export interface SimResult { frames: Frame[]; events: SimEvent[]; billsFirst: ServiceBill[]; billsLast: ServiceBill[]; lastUsage: Usage; firstUsage: Usage; horizon: Inputs['horizon']; finalDau: number }

const has = (sel: Selection[], id: string) => sel.some(s => s.serviceId === id);

/** One day of traffic at a given DAU. Additive metrics are per day. */
export function dayTraffic(inp: Inputs, dau: number, sel: Selection[]): Usage {
  const f = inp.dau > 0 ? dau / inp.dau : 0;
  const pv = dau * inp.pagesPerUser;
  // First page of a visit downloads everything; later pages reuse cached JS/CSS (about a third of the weight and a quarter of the files).
  const repeat = Math.max(0, pv - dau);
  const pageGB = (dau * inp.pageWeightKB + repeat * inp.pageWeightKB * ASSUME.repeatWeightShare) / 1048576;
  const imgOff = has(sel, 'cloudinary') ? inp.imageShare : 0;
  const calls = pv * inp.apiPerPage;
  const authReads = has(sel, 'authjs') ? 1 : 0;
  const dbq = calls * (inp.dbQueriesPerRequest + authReads);
  const uploads = inp.uploadsPerDay * f;
  const u: Usage = {
    pageViews: pv,
    bandwidthGB: pageGB * (1 - imgOff),
    imageGB: pageGB * imgOff,
    edgeRequests: dau * inp.requestsPerPage + repeat * inp.requestsPerPage * ASSUME.repeatRequestShare,
    fnInvocations: calls,
    cpuHours: calls * ASSUME.cpuMsPerCall / 3.6e6,
    memGBHours: calls * ASSUME.fnSeconds * ASSUME.fnMemGB / 3600 / ASSUME.fluidShare,
    imageTransforms: has(sel, 'cloudinary') ? 0 : uploads * ASSUME.transformsPerUpload + 10,
    dbQueries: dbq,
    dbEgressGB: dbq * ASSUME.dbKBPerQuery / 1048576,
    fsReadsDay: dbq * (1 - ASSUME.writeRatio),
    fsWritesDay: dbq * ASSUME.writeRatio,
    peakQps: dbq * 0.9 / (ASSUME.busyHours * 3600) * ASSUME.peakFactor,
    uploadsGB: uploads * inp.uploadMB / 1024,
    uploads,
    emailsDay: inp.emailsPerDay * f,
    aiCallsDay: inp.aiCallsPerDay * f,
    payments: inp.paymentsPerDay * f,
    redisCommands: has(sel, 'upstash') ? calls * ASSUME.redisPerCall : 0,
    rtMessagesDay: (has(sel, 'pusher') || has(sel, 'socketio')) ? dau * ASSUME.rtMsgsPerUser : 0,
    rtConcurrent: (has(sel, 'pusher') || has(sel, 'socketio')) ? dau * ASSUME.rtConcurrentShare : 0,
    errors: calls * ASSUME.errorsPer1kCalls / 1000 + pv * 0.0005,
  };
  // Neon compute: the DB is awake in any 5 minute window that sees a query.
  const lb = dbq * 0.9 / ASSUME.busyHours, lq = dbq * 0.1 / (24 - ASSUME.busyHours);
  const awake = ASSUME.busyHours * (1 - Math.exp(-lb / 12)) + (24 - ASSUME.busyHours) * (1 - Math.exp(-lq / 12));
  u.dbAwakeHours = awake;
  u.avgCU = Math.max(0.25, 0.25 + u.peakQps / 3 / 150);
  return u;
}

/** Turn a day's traffic into the numbers a plan is measured on, for a period. */
function periodMetrics(sum: Usage, levels: Usage, dayPeak: Usage, svc: Service | undefined, plan?: Plan): Usage {
  void plan;
  const m: Usage = { ...sum, ...levels };
  for (const k of DAY_METRICS) m[k] = dayPeak[k] || 0;
  m.peakQps = dayPeak.peakQps || 0; m.rtConcurrent = dayPeak.rtConcurrent || 0;
  m.emails = sum.emailsDay || 0;
  m.mediaCredits = (levels.fileStorageGB || 0) + (sum.imageGB || 0) + (sum.uploads || 0) * ASSUME.transformsPerUpload / 1000;
  m.dbComputeHours = sum.cuHours || 0;
  return forService(m, svc);
}

/** Add service-specific derived metrics (Netlify credits) to a usage record. */
export function forService(m: Usage, svc?: Service): Usage {
  if (!svc?.creditFormula) return m;
  return { ...m, credits: Object.entries(svc.creditFormula).reduce((a, [k, w]) => a + (m[k] || 0) * w, 0) };
}

export function feeNgn(fee: NonNullable<Plan['fee']>, amountNgn: number): number {
  let f = amountNgn * fee.pct / 100;
  if (fee.flatNgn && !(fee.flatWaivedBelowNgn && amountNgn < fee.flatWaivedBelowNgn)) f += fee.flatNgn;
  if (fee.flatUsd) f += fee.flatUsd * FX;
  if (fee.capNgn) f = Math.min(f, fee.capNgn);
  if (fee.vatPct) f *= 1 + fee.vatPct / 100;
  return f;
}

export function planCost(svc: Service, plan: Plan, m: Usage, inp: Inputs, days = 30): ServiceBill {
  const lines: string[] = []; const blocked: string[] = [];
  let usd = plan.priceUSD;
  if (plan.priceUSD) lines.push(`Base plan $${plan.priceUSD}`);
  if (plan.fee) {
    const perPay = feeNgn(plan.fee, inp.avgPaymentNgn);
    const count = (m.paymentsSum || 0);
    usd += perPay * count / FX;
    lines.push(`${Math.round(count).toLocaleString('en-US')} payments × ₦${Math.round(perPay).toLocaleString('en-US')} fee`);
  }
  if (plan.tokens) {
    const calls = m.aiCallsSum || 0;
    const c = calls * (inp.aiTokensIn * plan.tokens.inPerM + inp.aiTokensOut * plan.tokens.outPerM) / 1e6;
    usd += c; if (calls) lines.push(`${Math.round(calls).toLocaleString('en-US')} AI calls`);
  }
  let over = 0;
  for (const [k, lim] of Object.entries(plan.limits || {})) {
    const used = m[k] || 0;
    if (used <= lim) continue;
    const price = plan.overage?.[k];
    if (price != null) {
      const extra = (used - lim) * price * (DAY_METRICS.has(k) ? days : 1);
      over += extra; if (extra >= 0.01) lines.push(`${METRIC_LABEL[k] || k}: $${extra.toFixed(2)} usage`);
    } else blocked.push(k);
  }
  if (plan.creditUSD) { const c = Math.min(plan.creditUSD, over); if (c > 0) lines.push(`minus $${c.toFixed(2)} included credit`); over -= c; }
  usd += over;
  if (svc.id === 'atlas' && plan.id === 'flex') usd = Math.min(plan.capUSD || 30, plan.priceUSD + (m.peakQps || 0) / 500 * 22);
  if (plan.capUSD) usd = Math.min(usd, plan.capUSD);
  return { serviceId: svc.id, planId: plan.id, usd, blocked, lines };
}

function nodeState(svc: Service, plan: Plan, m: Usage, inp: Inputs, days: number): NodeState {
  const metrics: MetricState[] = [];
  for (const [k, lim] of Object.entries(plan.limits || {})) {
    if (lim <= 0) continue;
    const used = m[k] || 0;
    metrics.push({ key: k, used, limit: lim, pct: used / lim });
  }
  metrics.sort((a, b) => b.pct - a.pct);
  const bill = planCost(svc, plan, m, inp, days);
  const worst = metrics[0];
  let pct = worst ? worst.pct : 0;
  let status: NodeState['status'] = 'ok';
  if (worst && worst.pct >= 1 && plan.overage?.[worst.key] == null) status = 'over';
  else if (worst && worst.pct >= 1) status = 'paying';
  else if (worst && worst.pct >= 0.75) status = 'warn';
  else if (!worst && bill.usd > 0) { status = 'paying'; pct = Math.min(0.95, 0.15 + Math.log10(1 + bill.usd) / 3); }
  return { serviceId: svc.id, planId: plan.id, pct, status, worst, metrics, costUSD: bill.usd };
}

export function impactText(svc: Service, plan: Plan, metric: string): string {
  if (plan.onExceed) return plan.onExceed;
  return `${svc.name} starts charging for ${METRIC_LABEL[metric] || metric}`;
}

export function simulate(inp: Inputs, sel: Selection[]): SimResult {
  const months = inp.horizon === 'months12';
  const steps = months ? 12 : 30;
  const g = inp.growthPct / 100;
  const frames: Frame[] = []; const events: SimEvent[] = [];
  const fired = new Set<string>();
  let dbGB = ASSUME.baseDbGB, fileGB = 0;
  let sum: Usage = {}; let spikeExtraUsers = 0; let peak: Usage = {};
  let firstUsage: Usage = {}, lastUsage: Usage = {};
  let billsFirst: ServiceBill[] = [];
  const peakAll: Usage = {};
  let finalDau = inp.dau;
  const add = (a: Usage, b: Usage, k = 1) => { for (const [x, v] of Object.entries(b)) a[x] = (a[x] || 0) + v * k; };
  const maxIn = (a: Usage, b: Usage) => { for (const [x, v] of Object.entries(b)) a[x] = Math.max(a[x] || 0, v); };

  for (let s = 1; s <= steps; s++) {
    const dauN = months ? inp.dau * Math.pow(1 + g, s - 1) : inp.dau * Math.pow(1 + g, (s - 1) / 30);
    const isSpike = months ? s === 1 : s === inp.spikeDay;
    const spikeDau = dauN * inp.spikeMultiplier;
    const normal = dayTraffic(inp, dauN, sel);
    const spiky = isSpike && inp.spikeMultiplier > 1 ? dayTraffic(inp, spikeDau, sel) : null;
    finalDau = dauN;
    const withCU = (u: Usage) => ({ ...u, cuHours: u.dbAwakeHours * u.avgCU, paymentsSum: u.payments, aiCallsSum: u.aiCallsDay });
    if (months) {
      sum = {}; peak = {}; spikeExtraUsers = 0;
      add(sum, withCU(normal), 30);
      maxIn(peak, normal);
      if (spiky) { add(sum, withCU(spiky)); add(sum, withCU(normal), -1); maxIn(peak, spiky); spikeExtraUsers = spikeDau - dauN; }
      dbGB += dauN * 30 * ASSUME.storageKBPerUserDay / 1048576; fileGB += normal.uploadsGB * 30;
    } else {
      const today = spiky || normal;
      add(sum, withCU(today)); peak = {}; maxIn(peak, today);
      if (spiky) spikeExtraUsers += spikeDau - dauN;
      dbGB += (spiky ? spikeDau : dauN) * ASSUME.storageKBPerUserDay / 1048576; fileGB += today.uploadsGB;
    }
    maxIn(peakAll, peak);
    const levels: Usage = { dbStorageGB: dbGB, fileStorageGB: fileGB, mau: dauN * inp.dauToMau + spikeExtraUsers * ASSUME.spikeNewUserShare };
    const nodes: Record<string, NodeState> = {};
    let monthUSD = 0, feesUSD = 0;
    const label = months ? `Month ${s}` : `Day ${s}`;
    const stepEvents: SimEvent[] = [];
    const bills: ServiceBill[] = [];
    for (const se of sel) {
      const svc = svcById(se.serviceId); const plan = planOf(se.serviceId, se.planId);
      if (!svc || !plan) continue;
      const days = months ? 30 : s;
      const m = periodMetrics(sum, levels, peak, svc, plan);
      const ns = nodeState(svc, plan, m, inp, days);
      nodes[svc.id] = ns; if (svc.category === 'payments') feesUSD += ns.costUSD; else monthUSD += ns.costUSD;
      const mb = { ...(months ? m : forService(scaleToMonth(m, s), svc)) };
      if (!months || s === 1) for (const k of [...DAY_METRICS, 'peakQps', 'rtConcurrent']) mb[k] = Math.max(mb[k] || 0, peakAll[k] || 0);
      bills.push(planCost(svc, plan, mb, inp, 30));
      for (const ms of ns.metrics) {
        const keyW = `${svc.id}:${ms.key}:warn`, keyB = `${svc.id}:${ms.key}:break`;
        const paid = plan.overage?.[ms.key] != null;
        const when = months ? `${label}${!DAY_METRICS.has(ms.key) && !LEVEL_METRICS.has(ms.key) ? `, around day ${Math.max(1, Math.min(30, Math.ceil(30 * ms.limit / Math.max(ms.used, 1e-9))))}` : isSpike && spiky ? ' (launch spike day)' : ''}` : label + (isSpike && spiky ? ' (launch spike)' : '');
        const dauAt = isSpike && spiky && (DAY_METRICS.has(ms.key) || ms.key === 'peakQps' || ms.key === 'rtConcurrent') ? spikeDau : dauN;
        if (ms.pct >= 1 && !fired.has(keyB)) {
          fired.add(keyB); fired.add(keyW);
          const ev: SimEvent = { step: s, when, dau: Math.round(dauAt), serviceId: svc.id, planId: plan.id, metric: ms.key, kind: paid ? 'paying' : 'break',
            title: paid ? `${svc.name} ${plan.name}: included ${METRIC_LABEL[ms.key] || ms.key} used up, you start paying per use`
              : `${svc.name} ${plan.name}: ${METRIC_LABEL[ms.key] || ms.key} limit hit (${fmtN(ms.used)} of ${fmtN(ms.limit)})`,
            impact: paid ? 'Nothing breaks, but the bill grows with traffic.' : impactText(svc, plan, ms.key) };
          stepEvents.push(ev);
        } else if (ms.pct >= 0.75 && !fired.has(keyW)) {
          fired.add(keyW);
          stepEvents.push({ step: s, when, dau: Math.round(dauAt), serviceId: svc.id, planId: plan.id, metric: ms.key, kind: 'warn',
            title: `${svc.name} ${plan.name}: ${Math.round(ms.pct * 100)}% of ${METRIC_LABEL[ms.key] || ms.key} used`, impact: 'Getting close. Plan the upgrade now, not on the day.' });
        }
      }
    }
    events.push(...stepEvents);
    const lastM = periodMetrics(sum, levels, peak, undefined);
    if (s === 1 || (!months && s === steps)) firstUsage = months ? lastM : scaleToMonth(lastM, s);
    if (s === 1 && months) billsFirst = bills;
    if (s === steps) {
      lastUsage = months ? lastM : scaleToMonth(lastM, s);
      for (const k of [...DAY_METRICS, 'peakQps', 'rtConcurrent']) lastUsage[k] = Math.max(lastUsage[k] || 0, months ? (peak[k] || 0) : (peakAll[k] || 0));
      if (!months) billsFirst = bills;
    }
    const today = spiky || normal;
    frames.push({ step: s, label, dau: Math.round(isSpike && spiky ? spikeDau : dauN), nodes, monthUSD, feesUSD, events: stepEvents,
      flow: { users: today.pageViews, host: today.edgeRequests, api: today.fnInvocations, db: today.dbQueries } });
    if (s === steps) {
      const billsLast = bills;
      return { frames, events, billsFirst, billsLast, lastUsage, firstUsage, horizon: inp.horizon, finalDau };
    }
  }
  throw new Error('unreachable');
}

function scaleToMonth(m: Usage, days: number): Usage {
  if (days >= 30) return m;
  const out: Usage = { ...m }; const k = 30 / days;
  for (const key of Object.keys(out)) if (!DAY_METRICS.has(key) && !LEVEL_METRICS.has(key)) out[key] = out[key] * k;
  return out;
}

export function fmtN(x: number) {
  if (x >= 1e6) return (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e4) return Math.round(x / 1e3) + 'k';
  if (x >= 100) return Math.round(x).toLocaleString('en-US');
  if (x >= 1) return x.toFixed(1);
  return x.toFixed(2);
}
