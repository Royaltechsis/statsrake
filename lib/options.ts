import { DATA, svcById, planOf, FX } from './plans';
import { planCost, forService, feeNgn, type SimResult, type Usage } from './sim';
import { networkReport, loadSeconds, ngnPerVisit } from './network';
import type { Inputs, Selection } from './types';

export interface Advice { title: string; body: string; saveUSD?: number; source?: string; tone: 'swap' | 'fix' | 'keep' | 'warn' }

const COMPARABLE = ['host', 'db', 'auth', 'email', 'media', 'cache', 'realtime', 'monitoring'];

function fits(sid: string, pid: string, m: Usage, inp: Inputs) {
  const svc = svcById(sid)!; const plan = planOf(sid, pid)!;
  const bill = planCost(svc, plan, forService(m, svc), inp);
  return { svc, plan, bill, ok: bill.blocked.length === 0 };
}

export function adviseAll(inp: Inputs, sel: Selection[], res: SimResult): Advice[] {
  const out: Advice[] = [];
  const m = res.lastUsage; const at = Math.round(res.finalDau).toLocaleString('en-US');
  const scale = res.horizon === 'months12' ? `at month 12 (~${at} daily users)` : `at your end-of-month load (~${at} daily users)`;

  for (const cat of COMPARABLE) {
    const mine = sel.filter(s => svcById(s.serviceId)?.category === cat);
    for (const cur of mine) {
      const now = fits(cur.serviceId, cur.planId, m, inp);
      const candidates: ReturnType<typeof fits>[] = [];
      const sameCat = DATA.services.filter(s => s.category === cat && (s.id === cur.serviceId || alternativeOk(cat, s.id, cur.serviceId)));
      for (const s of sameCat) for (const p of s.plans) {
        if (cat === 'host' && p.id === 'hobby' && inp.paymentsPerDay > 0) continue; // commercial use
        candidates.push(fits(s.id, p.id, m, inp));
      }
      const ok = candidates.filter(c => c.ok).sort((a, b) => (a.plan.verified === b.plan.verified ? 0 : a.plan.verified ? -1 : 1) || a.bill.usd - b.bill.usd);
      const best = ok[0];
      const sameSvcBest = ok.find(c => c.svc.id === cur.serviceId);
      if (!now.ok) {
        if (best) {
          let body = `${now.svc.name} ${now.plan.name} runs out of ${now.bill.blocked.map(b => labelOf(b)).join(', ')} ${scale}. Cheapest option that fits: ${best.svc.name} ${best.plan.name}${best.plan.verified ? '' : ' (unverified)'} at about $${best.bill.usd.toFixed(2)}/mo (${ngnStr(best.bill.usd)}).`;
          if (sameSvcBest && sameSvcBest !== best) body += ` Staying on ${sameSvcBest.svc.name} means ${sameSvcBest.plan.name} at about $${sameSvcBest.bill.usd.toFixed(2)}/mo.`;
          const pricier = ok.filter(c => c.svc.id !== best.svc.id && c.svc.id !== cur.serviceId).slice(0, 1)[0];
          if (pricier && pricier.bill.usd > best.bill.usd + 1) body += ` For comparison, ${pricier.svc.name} ${pricier.plan.name} would be about $${pricier.bill.usd.toFixed(2)}/mo.`;
          out.push({ title: `${now.svc.name}: upgrade before it breaks`, body, source: best.plan.source, tone: 'swap' });
        }
      } else if (best && best.bill.usd + 3 < now.bill.usd) {
        out.push({ title: `${now.svc.name}: you can pay less`, body: `${now.svc.name} ${now.plan.name} costs about $${now.bill.usd.toFixed(2)}/mo ${scale}. ${best.svc.name} ${best.plan.name} also fits at about $${best.bill.usd.toFixed(2)}/mo, saving $${(now.bill.usd - best.bill.usd).toFixed(2)} (${ngnStr(now.bill.usd - best.bill.usd)}) a month.`, saveUSD: now.bill.usd - best.bill.usd, source: best.plan.source, tone: 'swap' });
      }
    }
  }

  // Vercel Hobby is non-commercial.
  const v = sel.find(s => s.serviceId === 'vercel' && s.planId === 'hobby');
  if (v && (inp.paymentsPerDay > 0 || sel.some(s => ['paystack', 'flutterwave', 'stripe'].includes(s.serviceId)))) {
    const pro = fits('vercel', 'pro', m, inp); const np = fits('netlify', 'personal', m, inp);
    out.push({ title: 'Vercel Hobby is for non-commercial use only', body: `You take payments, so this is a commercial app. Vercel's fair use rules put that on Pro (about $${pro.bill.usd.toFixed(2)}/mo ${scale}). Netlify Personal${np.ok ? ` fits at about $${np.bill.usd.toFixed(2)}/mo` : ' is the cheaper paid host, but your traffic outgrows its credits'}.`, source: 'https://vercel.com/docs/plans/hobby', tone: 'warn' });
  }

  // Payments: compare at the average ticket.
  const payNow = sel.find(s => svcById(s.serviceId)?.category === 'payments');
  if (payNow && inp.paymentsPerDay > 0) {
    const opts = ['paystack', 'flutterwave'].map(id => { const p = planOf(id, 'standard')!; return { id, name: svcById(id)!.name, fee: feeNgn(p.fee!, inp.avgPaymentNgn), verified: p.verified, source: p.source }; });
    opts.sort((a, b) => a.fee - b.fee);
    const monthly = res.lastUsage.paymentsSum || inp.paymentsPerDay * 30;
    const diff = (opts[1].fee - opts[0].fee) * monthly;
    out.push({ title: `Payments: ${opts[0].name} is cheaper at a ₦${inp.avgPaymentNgn.toLocaleString('en-US')} ticket`, body: `Fee per payment: ${opts.map(o => `${o.name} ₦${Math.round(o.fee).toLocaleString('en-US')}${o.verified ? '' : ' (unverified)'}`).join(', ')}. Over ~${Math.round(monthly).toLocaleString('en-US')} payments a month that is ₦${Math.round(diff).toLocaleString('en-US')} difference. Paystack caps local fees at ₦2,000, so it wins on big tickets; Flutterwave's flat 2% has no ₦100 add-on.`, source: opts[0].source, tone: payNow.serviceId === opts[0].id ? 'keep' : 'swap' });
  }

  // AI: cheaper model at the same token volume.
  for (const s of sel.filter(x => svcById(x.serviceId)?.category === 'ai')) {
    const svc = svcById(s.serviceId)!; const cur = planCost(svc, planOf(s.serviceId, s.planId)!, m, inp);
    const all = DATA.services.filter(x => x.category === 'ai').flatMap(x => x.plans.filter(p => p.tokens && p.verified && p.tokens.inPerM > 0).map(p => ({ x, p, c: planCost(x, p, m, inp).usd })));
    all.sort((a, b) => a.c - b.c);
    const cheap = all[0];
    if (cheap && cur.usd - cheap.c > 2) out.push({ title: `AI: test a smaller model first`, body: `${svc.name} ${planOf(s.serviceId, s.planId)!.name} costs about $${cur.usd.toFixed(2)}/mo ${scale}. ${cheap.x.name} ${cheap.p.name} would be about $${cheap.c.toFixed(2)}. Route simple calls (summaries, tags, short replies) to the small model and keep the big one for hard ones.`, saveUSD: cur.usd - cheap.c, source: cheap.p.source, tone: 'swap' });
  }

  // Realtime on serverless.
  if (sel.some(s => s.serviceId === 'socketio') && sel.some(s => s.serviceId === 'vercel' || s.serviceId === 'netlify')) {
    out.push({ title: 'Socket.IO will not stay connected on serverless', body: 'Vercel and Netlify functions shut down after each request, so WebSockets drop. Use Pusher Sandbox (free up to 100 concurrent connections) or run the socket server on Railway Hobby ($5 minimum usage).', source: 'https://pusher.com/channels/pricing', tone: 'warn' });
  }
  if (sel.some(s => s.serviceId === 'smtp')) out.push({ title: 'Gmail SMTP is a trap for transactional mail', body: 'Personal Gmail caps you at roughly 500 emails a day and mail often lands in spam. Resend Free gives 3,000 a month with proper domain authentication.', source: 'https://resend.com/pricing', tone: 'swap' });

  // Page weight and images.
  const net = networkReport(inp);
  if (inp.pageWeightKB > net.budgetKB * 1.3) {
    const target = Math.max(net.budgetKB, 300);
    const p2g = DATA.networks.find(n => n.id === '2g')!, p3g = DATA.networks.find(n => n.id === '3g')!;
    const savedGB = (inp.pageWeightKB - target) / 1048576 * (res.lastUsage.pageViews || 0);
    out.push({ title: `Cut page weight from ${inp.pageWeightKB} KB to about ${target} KB`, body: `Compress images to WebP or AVIF, lazy-load below the fold, and drop unused JS. On 3G load time goes from ${loadSeconds(p3g, inp.pageWeightKB, inp.requestsPerPage).toFixed(1)} s to ${loadSeconds(p3g, target, inp.requestsPerPage).toFixed(1)} s, on 2G from ${Math.round(loadSeconds(p2g, inp.pageWeightKB, inp.requestsPerPage))} s to ${Math.round(loadSeconds(p2g, target, inp.requestsPerPage))} s. Each visit costs your user ₦${ngnPerVisit(inp.pageWeightKB).toFixed(2)} in data instead of ₦${ngnPerVisit(target).toFixed(2)}, and you save about ${Math.round(savedGB).toLocaleString('en-US')} GB of bandwidth a month.`, source: 'https://ncc.gov.ng/market-data-reports/industry-statistics', tone: 'fix' });
  }
  if (!sel.some(s => s.serviceId === 'cloudinary') && inp.imageShare > 0.3 && (res.lastUsage.bandwidthGB || 0) > 20) {
    const imgGB = (res.lastUsage.bandwidthGB || 0) * inp.imageShare;
    out.push({ title: 'Serve images from Cloudinary', body: `About ${Math.round(imgGB)} GB a month of your bandwidth is images. Cloudinary Free covers 25 credits (1 credit = 1 GB of image bandwidth) and auto-converts to WebP/AVIF, which also cuts what your users pay in data.${imgGB > 25 ? ' At your volume you would outgrow the free credits, so compress first.' : ''}`, source: 'https://cloudinary.com/pricing', tone: 'fix' });
  }
  if (!out.length) out.push({ title: 'Your current plans hold up', body: `Nothing in your stack breaks ${scale}. Run it again with a bigger launch spike or more growth to find the ceiling.`, tone: 'keep' });
  return out;
}

function alternativeOk(cat: string, a: string, b: string) {
  if (cat === 'db') {
    const sql = ['neon', 'supabase', 'planetscale'];
    return sql.includes(a) && sql.includes(b); // do not suggest swapping SQL for Mongo or Firestore
  }
  if (cat === 'auth') return a !== 'authjs';
  if (cat === 'email') return a === 'resend';
  if (cat === 'media' || cat === 'cache' || cat === 'monitoring') return false; // not like-for-like
  if (cat === 'realtime') return a === 'pusher';
  return true;
}
const labelOf = (k: string) => ({ dbComputeHours: 'compute hours', dbStorageGB: 'storage', dbEgressGB: 'egress', mau: 'monthly users', emails: 'monthly emails', emailsDay: 'daily emails', credits: 'credits', mediaCredits: 'credits', peakQps: 'query capacity', fsReadsDay: 'daily reads', fsWritesDay: 'daily writes', bandwidthGB: 'bandwidth', fnInvocations: 'function calls', cpuHours: 'CPU hours', memGBHours: 'function memory', edgeRequests: 'edge requests', imageTransforms: 'image optimisations', redisCommands: 'commands', rtConcurrent: 'connections', rtMessagesDay: 'messages', errors: 'error quota', fileStorageGB: 'file storage', aiCallsDay: 'daily AI calls' } as Record<string, string>)[k] || k;
const ngnStr = (u: number) => '₦' + Math.round(u * FX).toLocaleString('en-US');

/** Cheapest plan of the same service that fits the simulated load (what you would pay to stay up). */
export function stayUpBill(inp: Inputs, sel: Selection[], res: SimResult): { usd: number; rows: { serviceId: string; planId: string; usd: number; fits: boolean }[] } {
  const rows = sel.filter(s => svcById(s.serviceId)?.category !== 'payments').map(s => {
    const svc = svcById(s.serviceId)!;
    const cur = fits(s.serviceId, s.planId, res.lastUsage, inp);
    if (cur.ok) return { serviceId: s.serviceId, planId: s.planId, usd: cur.bill.usd, fits: true };
    const ok = svc.plans.map(p => fits(s.serviceId, p.id, res.lastUsage, inp)).filter(c => c.ok && !(svc.id === 'vercel' && c.plan.id === 'hobby' && inp.paymentsPerDay > 0)).sort((a, b) => a.bill.usd - b.bill.usd)[0];
    return ok ? { serviceId: s.serviceId, planId: ok.plan.id, usd: ok.bill.usd, fits: true } : { serviceId: s.serviceId, planId: s.planId, usd: cur.bill.usd, fits: false };
  });
  return { usd: rows.reduce((a, r) => a + r.usd, 0), rows };
}
