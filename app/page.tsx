'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DATA, FX, svcById, planOf, CATEGORY_LABEL } from '../lib/plans';
import { loadFromGitHub, parsePackageJsonText, depsFromPackageJson, StackError } from '../lib/github';
import { detect, type Detection } from '../lib/detect';
import { simulate, type SimResult, type ServiceBill } from '../lib/sim';
import { adviseAll, stayUpBill, type Advice } from '../lib/options';
import { networkReport } from '../lib/network';
import { checkHealth, type Health } from '../lib/health';
import { SAMPLE_PKG, DEFAULT_INPUTS } from '../lib/sample';
import { encodeState, decodeState, store } from '../lib/store';
import type { Dep, Inputs, Selection, StackSource } from '../lib/types';
import SimView from '../components/SimView';

type Shared = { pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }; source: StackSource; sel: Selection[]; inp: Inputs };

const money = (u: number) => '$' + (u >= 1000 ? Math.round(u).toLocaleString('en-US') : u.toFixed(2));
const naira = (u: number) => '₦' + Math.round(u * FX).toLocaleString('en-US');

export default function Page() {
  const [tab, setTab] = useState<'repo' | 'paste' | 'upload'>('repo');
  const [repo, setRepo] = useState('');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pkg, setPkg] = useState<any>(null);
  const [deps, setDeps] = useState<Dep[]>([]);
  const [source, setSource] = useState<StackSource | null>(null);
  const [det, setDet] = useState<Detection | null>(null);
  const [sel, setSel] = useState<Selection[]>([]);
  const [inp, setInp] = useState<Inputs>(DEFAULT_INPUTS);
  const [res, setRes] = useState<SimResult | null>(null);
  const [simDone, setSimDone] = useState(false);
  const [health, setHealth] = useState<Health[] | null>(null);
  const [hProg, setHProg] = useState('');
  const [copied, setCopied] = useState('');
  const simRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  const accept = useCallback((p: any, d: Dep[], s: StackSource, keepSel?: Selection[]) => {
    setPkg(p); setDeps(d); setSource(s); setRes(null); setHealth(null); setSimDone(false);
    const dt = detect(d); setDet(dt);
    setSel(keepSel || dt.selections);
    if (!keepSel) setInp(i => ({ ...i, apiPerPage: dt.staticSite ? 0 : i.apiPerPage || DEFAULT_INPUTS.apiPerPage, paymentsPerDay: dt.selections.some(x => svcById(x.serviceId)?.category === 'payments') ? (i.paymentsPerDay || 25) : 0, aiCallsPerDay: dt.selections.some(x => svcById(x.serviceId)?.category === 'ai') ? (i.aiCallsPerDay || 200) : 0 }));
    setTimeout(() => stackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    // package health runs in the background
    setHProg('Checking packages on npm and OSV…');
    checkHealth(d, (n, t) => setHProg(`Checking packages: ${n} of ${t}`)).then(h => { setHealth(h); setDeps([...d]); setHProg(''); }).catch(() => setHProg('Package check failed. Try again later.'));
  }, []);

  const loadRepo = async () => {
    setErr(''); setBusy(true);
    try { const r = await loadFromGitHub(repo); accept(r.pkg, r.deps, r.source); }
    catch (e: any) { setErr(e instanceof StackError ? e.message : 'Could not reach GitHub. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  const loadPaste = (text: string, label = 'Pasted package.json') => {
    setErr('');
    try { const p = parsePackageJsonText(text); accept(p, depsFromPackageJson(p), { label: p.name ? `${p.name} (${label.toLowerCase()})` : label, notes: ['Pasted without a lockfile, so installed versions are resolved from your ranges as npm would today.'] }); }
    catch (e: any) { setErr(e.message); }
  };
  const loadSample = () => {
    setErr(''); setRepo(''); setInp({ ...DEFAULT_INPUTS, mix: { ...DEFAULT_INPUTS.mix } });
    const p = JSON.parse(JSON.stringify(SAMPLE_PKG));
    const d = depsFromPackageJson(p);
    const dt = detect(d);
    accept(p, d, { label: 'Sample: Naija freelancer stack', notes: ['Next.js on Vercel Hobby, Neon, Paystack, Resend, Cloudinary, NextAuth. Versions are exact or resolved from ranges.'] }, dt.selections);
  };

  // restore a shared report from the URL
  useEffect(() => {
    const h = location.hash.match(/#r=(.+)$/);
    if (!h) return;
    const s = decodeState<Shared>(h[1]);
    if (!s) return;
    const d = depsFromPackageJson(s.pkg);
    setInp(s.inp);
    accept(s.pkg, d, s.source, s.sel);
    setTimeout(() => { setRes(simulate(s.inp, s.sel)); setSimDone(true); }, 50);
  }, [accept]);

  const run = () => {
    const r = simulate(inp, sel); setRes(r); setSimDone(false);
    setTimeout(() => simRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    store.save({ id: (source?.label || 'stack') + ':' + inp.horizon, createdAt: new Date().toISOString(), title: source?.label || 'stack', hash: shareHash(), monthlyUSD: r.billsLast.reduce((a, b) => a + b.usd, 0) }).catch(() => {});
  };
  const shareHash = () => encodeState({ pkg: { dependencies: pkg?.dependencies, devDependencies: pkg?.devDependencies }, source, sel, inp } as Shared);
  const share = async () => {
    const url = location.origin + location.pathname + '#r=' + shareHash();
    try { await navigator.clipboard.writeText(url); setCopied('Link copied'); } catch { history.replaceState(null, '', url); setCopied('Link is in your address bar'); }
    setTimeout(() => setCopied(''), 2500);
  };

  const advice: Advice[] = useMemo(() => res ? adviseAll(inp, sel, res) : [], [res, inp, sel]);
  const net = useMemo(() => networkReport(inp), [inp]);
  const set = (k: keyof Inputs, v: any) => { setInp(i => ({ ...i, [k]: v })); };
  const hostSel = sel.find(s => svcById(s.serviceId)?.category === 'host');
  const addable = DATA.services.filter(s => !sel.some(x => x.serviceId === s.id));
  const healthBy = useMemo(() => Object.fromEntries((health || []).map(h => [h.name, h])), [health]);
  const vulnCount = (health || []).reduce((a, h) => a + h.vulns.length, 0);

  return (
    <main>
      <div className="wrap">
        <header className="top">
          <a className="brand" href="./"><svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#151b25" /><path d="M12 18l8 28 8-20 8 20 8-28" fill="none" stroke="#c6f432" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="52" cy="46" r="5" fill="#ff5a5f" /></svg>wahala<b>.</b></a>
          <span className="tag noprint">Production simulator for indie devs</span>
        </header>

        <div className="hero">
          <h1>Give your app wahala <em>before your users do.</em></h1>
          <p>Paste your repo. Wahala reads your exact packages, finds the services you depend on, lets you pick the plans you are really on, then floods your stack with simulated Nigerian traffic. See where it breaks, what it costs in naira and dollars, and what to switch to.</p>
          <div className="stat-row">
            <span className="pill"><strong>36%</strong> of Nigerian mobile subs are still on 2G (NCC, Aug 2026)</span>
            <span className="pill"><strong>₦{DATA.meta.fx.ngnPerUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> per $1, checked {DATA.meta.fx.checkedOn}</span>
          </div>
        </div>

        <section className="card noprint" aria-labelledby="s1">
          <div className="step"><span className="n">1</span><h2 id="s1">Your stack</h2><span className="sub">Public repo, pasted file, or upload</span></div>
          <div className="tabs" role="tablist">
            {(['repo', 'paste', 'upload'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'repo' ? 'GitHub repo' : t === 'paste' ? 'Paste package.json' : 'Upload file'}</button>)}
          </div>
          {tab === 'repo' && (
            <form className="row" onSubmit={e => { e.preventDefault(); loadRepo(); }}>
              <input className="grow" type="text" inputMode="url" placeholder="https://github.com/you/your-app" value={repo} onChange={e => setRepo(e.target.value)} aria-label="GitHub repo URL" id="repo-input" />
              <button className="btn" type="submit" disabled={busy || !repo.trim()} id="load-repo">{busy ? <><span className="spin" />Reading repo</> : 'Read my repo'}</button>
            </form>
          )}
          {tab === 'paste' && (
            <div>
              <textarea placeholder='{ "dependencies": { "next": "15.1.6", ... } }' value={paste} onChange={e => setPaste(e.target.value)} aria-label="package.json contents" id="paste-input" />
              <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={() => loadPaste(paste)} disabled={!paste.trim()} id="load-paste">Use this package.json</button></div>
            </div>
          )}
          {tab === 'upload' && (
            <div className="row"><input type="file" accept=".json,application/json" aria-label="Upload package.json" onChange={async e => { const f = e.target.files?.[0]; if (f) loadPaste(await f.text(), 'Uploaded package.json'); }} /></div>
          )}
          <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
            <button className="btn ghost" onClick={loadSample} id="sample">Try a sample stack</button>
            <span className="note" style={{ margin: 0 }}>Next.js + Neon + Vercel Hobby + Paystack + Resend + Cloudinary</span>
          </div>
          {err && <div className="err" role="alert" id="err">{err}</div>}
        </section>

        {source && det && (
          <div ref={stackRef}>
            <section className="card" aria-labelledby="s1b">
              <div className="step"><span className="n">✓</span><h2 id="s1b">{source.label}</h2><span className="sub">{det.framework}{source.branch ? ` · ${source.branch}` : ''}{source.lockfile ? ` · versions from ${source.lockfile}` : ''}</span></div>
              {source.notes.map((n, i) => <p key={i} className="note">{n}</p>)}
              {det.notes.map((n, i) => <p key={'d' + i} className="note">{n}</p>)}
              {det.ormNote && <p className="note">{det.ormNote}</p>}
              <div className="sub-h">Services we detected</div>
              <div className="chips" id="chips">
                {sel.map(s => { const svc = svcById(s.serviceId)!; return (
                  <span className="chip" key={s.serviceId} title={s.why}><span className="ic">{svc.icon}</span>{svc.name}<small>{CATEGORY_LABEL[svc.category]}</small>
                    <button aria-label={`Remove ${svc.name}`} onClick={() => setSel(x => x.filter(y => y.serviceId !== s.serviceId))}>×</button></span>); })}
                <select aria-label="Add a service" value="" onChange={e => { const svc = svcById(e.target.value); if (svc) setSel(x => [...x, { serviceId: svc.id, planId: svc.plans[0].id, why: 'added by you' }]); }} style={{ width: 'auto' }}>
                  <option value="">+ Add service</option>
                  {addable.map(s => <option key={s.id} value={s.id}>{s.name} ({CATEGORY_LABEL[s.category]})</option>)}
                </select>
              </div>
              <details open={deps.length <= 14}>
                <summary>{deps.length} packages {health ? `· ${vulnCount} known vulnerabilit${vulnCount === 1 ? 'y' : 'ies'}` : ''} {hProg && <span><span className="spin" style={{ marginLeft: 8 }} />{hProg}</span>}</summary>
                <div className="tbl"><table id="deps"><thead><tr><th>Package</th><th>Range</th><th>Installed</th><th>Latest</th><th>Status</th></tr></thead><tbody>
                  {deps.map(d => { const h = healthBy[d.name]; return (
                    <tr key={d.name + d.dev}><td className="mono">{d.name}{d.dev && <span className="badge" style={{ marginLeft: 6 }}>dev</span>}</td><td className="mono">{d.range}</td>
                      <td className="mono">{d.installed || '…'}{d.installed && <span className="badge" style={{ marginLeft: 6 }}>{d.via === 'lockfile' ? 'lockfile' : d.via === 'exact' ? 'pinned' : 'resolved'}</span>}</td>
                      <td className="mono">{h?.latest || (health ? '?' : '…')}</td><td><HealthBadge h={h} /></td></tr>); })}
                </tbody></table></div>
              </details>
            </section>

            <section className="card" aria-labelledby="s2">
              <div className="step"><span className="n">2</span><h2 id="s2">Your plans</h2><span className="sub">Prices checked {DATA.meta.checkedOn}</span></div>
              <div className="grid2">
                {sel.map(s => { const svc = svcById(s.serviceId)!; const plan = planOf(s.serviceId, s.planId)!; return (
                  <div className="svc" key={s.serviceId} data-svc={s.serviceId}>
                    <h3><span style={{ color: 'var(--acc)' }}>{svc.icon}</span>{svc.name}<span className="badge" style={{ marginLeft: 'auto' }}>{CATEGORY_LABEL[svc.category]}</span></h3>
                    <div className="why">{s.why}</div>
                    <select aria-label={`${svc.name} plan`} value={s.planId} onChange={e => setSel(x => x.map(y => y.serviceId === s.serviceId ? { ...y, planId: e.target.value } : y))}>
                      {svc.plans.map(p => <option key={p.id} value={p.id}>{p.name}{p.priceUSD ? ` ($${p.priceUSD}/mo)` : p.tokens ? ` ($${p.tokens.inPerM} in / $${p.tokens.outPerM} out per 1M tokens)` : p.fee ? '' : p.overage ? ' (pay per use)' : /free/i.test(p.name) ? '' : ' (free)'}</option>)}
                    </select>
                    {plan.notes && <ul>{plan.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
                    <div className="meta"><span>{plan.verified ? <span className="badge ok">verified {svc.checkedOn}</span> : <span className="badge warn">unverified</span>}</span><a href={plan.source} target="_blank" rel="noopener noreferrer">pricing source</a></div>
                  </div>); })}
              </div>
              {!sel.length && <p className="note">No services yet. Add one above.</p>}
            </section>

            <section className="card" aria-labelledby="s3">
              <div className="step"><span className="n">3</span><h2 id="s3">Your traffic</h2><span className="sub">Drag, then run</span></div>
              <div className="sliders">
                <Sl label="Daily active users" k="dau" v={inp.dau} min={10} max={50000} step={10} log set={set} />
                <Sl label="Pages per user per day" k="pagesPerUser" v={inp.pagesPerUser} min={1} max={40} step={1} set={set} />
                <Sl label="Avg page weight" unit=" KB" k="pageWeightKB" v={inp.pageWeightKB} min={100} max={8000} step={50} set={set} />
                <Sl label="Server calls per page" k="apiPerPage" v={inp.apiPerPage} min={0} max={10} step={0.5} set={set} />
                <Sl label="DB queries per server call" k="dbQueriesPerRequest" v={inp.dbQueriesPerRequest} min={0} max={20} step={1} set={set} />
                <Sl label="Growth per month" unit="%" k="growthPct" v={inp.growthPct} min={0} max={200} step={5} set={set} />
                <Sl label="Launch day spike" unit="×" k="spikeMultiplier" v={inp.spikeMultiplier} min={1} max={30} step={1} set={set} />
                <Sl label="File uploads per day" k="uploadsPerDay" v={inp.uploadsPerDay} min={0} max={5000} step={10} set={set} />
                <Sl label="Emails sent per day" k="emailsPerDay" v={inp.emailsPerDay} min={0} max={10000} step={10} set={set} />
                <Sl label="AI calls per day" k="aiCallsPerDay" v={inp.aiCallsPerDay} min={0} max={20000} step={50} set={set} />
                <Sl label="Payments per day" k="paymentsPerDay" v={inp.paymentsPerDay} min={0} max={2000} step={5} set={set} />
                <Sl label="Average payment" unit="" prefix="₦" k="avgPaymentNgn" v={inp.avgPaymentNgn} min={500} max={500000} step={500} log set={set} />
              </div>
              <details>
                <summary>More knobs: requests per page, upload size, AI tokens, users per month</summary>
                <div className="sliders" style={{ marginTop: 12 }}>
                  <Sl label="Files (requests) per page" k="requestsPerPage" v={inp.requestsPerPage} min={1} max={150} step={1} set={set} />
                  <Sl label="Avg upload size" unit=" MB" k="uploadMB" v={inp.uploadMB} min={0.1} max={50} step={0.1} set={set} />
                  <Sl label="AI tokens in per call" k="aiTokensIn" v={inp.aiTokensIn} min={50} max={20000} step={50} set={set} />
                  <Sl label="AI tokens out per call" k="aiTokensOut" v={inp.aiTokensOut} min={20} max={8000} step={20} set={set} />
                  <Sl label="Monthly users per daily user" unit="×" k="dauToMau" v={inp.dauToMau} min={1} max={10} step={0.5} set={set} />
                  <Sl label="Share of page weight that is images" unit="%" k="imageShare" v={Math.round(inp.imageShare * 100)} min={0} max={95} step={5} set={(k, v) => set('imageShare', v / 100)} />
                  <Sl label="Spike happens on day" k="spikeDay" v={inp.spikeDay} min={1} max={30} step={1} set={set} />
                </div>
              </details>
              <div className="sub-h">Your users' networks</div>
              <div className="sliders">
                {DATA.networks.map(n => (
                  <Sl key={n.id} label={n.name} unit="%" k={n.id as any} v={inp.mix[n.id] || 0} min={0} max={100} step={1} set={(k, v) => setInp(i => ({ ...i, mix: { ...i.mix, [n.id]: v } }))} />
                ))}
              </div>
              <p className="note">Defaults follow NCC's Aug 2026 split by generation (2G 36%, 3G 4%, 4G and 5G 60%). How 4G divides between MTN, Airtel and Glo is our assumption.</p>
              <div className="runbar">
                <div className="seg" role="group" aria-label="Simulation length">
                  <button aria-pressed={inp.horizon === 'days30'} onClick={() => set('horizon', 'days30')}>30 days</button>
                  <button aria-pressed={inp.horizon === 'months12'} onClick={() => set('horizon', 'months12')}>12 months</button>
                </div>
                <button className="btn big" onClick={run} disabled={!sel.length} id="run">Run simulation ▸</button>
              </div>
            </section>
          </div>
        )}

        {res && (
          <div ref={simRef}>
            <section className="card" aria-labelledby="s4" id="simcard">
              <div className="step"><span className="n">4</span><h2 id="s4">Simulation</h2><span className="sub">{inp.horizon === 'days30' ? '30 days, day by day' : '12 months'}</span></div>
              <SimView res={res} sel={sel} onDone={() => setSimDone(true)} />
              {!simDone && <p className="note noprint"><button className="btn ghost" onClick={() => setSimDone(true)} id="skip">Skip to results</button></p>}
            </section>
            {simDone && <Results res={res} inp={inp} sel={sel} advice={advice} net={net} health={health} hProg={hProg} source={source} onShare={share} copied={copied} />}
          </div>
        )}

        <footer>
          <p>Estimates based on public pricing as of the checked date ({DATA.meta.checkedOn}); verify before deciding. Usage models are simplified and every assumption is listed in the report. Network speeds: SpeedGeo Q1 2026 via ohayu.com for 4G carriers; 3G and 2G use standard lab profiles. Data cost: Cable.co.uk study (Nigeria $0.39/GB). Naira rate: open.er-api.com, {DATA.meta.fx.checkedOn}.</p>
          <p>Wahala v1. Built for Nigerian and African developers. No logos, no tracking; everything runs in your browser.</p>
        </footer>
      </div>
    </main>
  );
}

function HealthBadge({ h }: { h?: Health }) {
  if (!h) return <span className="badge">checking</span>;
  const tags: any[] = [];
  if (h.vulns.length) tags.push(<span key="v" className="badge bad" title={h.vulns.map(v => v.id + ': ' + v.summary).join('\n')}>{h.vulns.length} vuln{h.vulns.length > 1 ? 's' : ''}</span>);
  if (h.deprecated) tags.push(<span key="d" className="badge bad" title={h.deprecated}>deprecated</span>);
  if (h.behind === 'major') tags.push(<span key="m" className="badge warn">major behind</span>);
  else if (h.behind === 'minor') tags.push(<span key="m" className="badge blue">minor behind</span>);
  else if (h.behind === 'patch') tags.push(<span key="m" className="badge blue">patch behind</span>);
  else if (h.behind === 'current') tags.push(<span key="m" className="badge ok">up to date</span>);
  if (h.error && !tags.length) tags.push(<span key="e" className="badge">{h.error}</span>);
  return <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{tags}</span>;
}

function Sl({ label, k, v, min, max, step, set, unit = '', prefix = '', log }: { label: string; k: any; v: number; min: number; max: number; step: number; set: (k: any, v: number) => void; unit?: string; prefix?: string; log?: boolean }) {
  // log sliders map 0..1000 to min..max on a log scale so small numbers stay easy to pick on a phone
  const toPos = (x: number) => Math.round(1000 * Math.log(x / min) / Math.log(max / min));
  const fromPos = (p: number) => { const x = min * Math.pow(max / min, p / 1000); const s = x > 1000 ? 100 : x > 100 ? 10 : step; return Math.max(min, Math.round(x / s) * s); };
  const id = 'sl-' + String(k);
  return (
    <div className="sl">
      <label htmlFor={id}>{label}<output>{prefix}{v.toLocaleString('en-US')}{unit}</output></label>
      {log ? <input id={id} type="range" min={0} max={1000} step={1} value={toPos(Math.max(min, v))} onChange={e => set(k, fromPos(+e.target.value))} />
        : <input id={id} type="range" min={min} max={max} step={step} value={v} onChange={e => set(k, +e.target.value)} />}
    </div>
  );
}

function Results({ res, inp, sel, advice, net, health, hProg, source, onShare, copied }: { res: SimResult; inp: Inputs; sel: Selection[]; advice: Advice[]; net: ReturnType<typeof networkReport>; health: Health[] | null; hProg: string; source: StackSource | null; onShare: () => void; copied: string }) {
  const breaks = res.events.filter(e => e.kind !== 'warn');
  const warns = res.events.filter(e => e.kind === 'warn' && !res.events.some(b => b.kind !== 'warn' && b.serviceId === e.serviceId && b.metric === e.metric));
  const months = res.horizon === 'months12';
  const isFee = (b: ServiceBill) => svcById(b.serviceId)?.category === 'payments';
  const total = (b: ServiceBill[]) => b.filter(x => !isFee(x)).reduce((a, x) => a + x.usd, 0);
  const fees = (b: ServiceBill[]) => b.filter(isFee).reduce((a, x) => a + x.usd, 0);
  const risky = (health || []).filter(h => h.vulns.length || h.deprecated || h.behind === 'major');
  return (
    <div id="results">
      <section className="card" aria-labelledby="r1">
        <div className="step"><span className="n">!</span><h2 id="r1">Where it breaks</h2><span className="sub">{breaks.filter(b => b.kind === 'break').length} hard limits, {breaks.filter(b => b.kind === 'paying').length} start billing</span></div>
        <div className="breaks">
          {breaks.length === 0 && <div className="brk ok"><span className="when">Clear</span><span className="what">Nothing breaks in this run.</span><span className="ux">Push the launch spike or growth higher to find your ceiling.</span></div>}
          {breaks.map((e, i) => (
            <div key={i} className={'brk ' + e.kind}><span className="when">{e.when}</span><span className="what">{e.title} <span className="mono" style={{ color: 'var(--mut)', fontWeight: 400 }}>at ~{e.dau.toLocaleString('en-US')} daily users</span></span><span className="ux">{e.kind === 'break' ? 'What users feel: ' : ''}{e.impact}</span></div>
          ))}
          {warns.map((e, i) => (<div key={'w' + i} className="brk warn"><span className="when">{e.when}</span><span className="what">{e.title}</span><span className="ux">{e.impact}</span></div>))}
        </div>
      </section>

      <section className="card" aria-labelledby="r2">
        <div className="step"><span className="n">₦</span><h2 id="r2">Monthly bill</h2><span className="sub">$1 = ₦{FX.toLocaleString('en-US', { maximumFractionDigits: 2 })} (open.er-api.com, {DATA.meta.fx.checkedOn})</span></div>
        <div className="total">
          <div><span className="lbl">{months ? 'Infra, month 1' : 'Infra bill this month'}</span><span className="big-num">{money(total(res.billsFirst))}</span> <span className="mono">{naira(total(res.billsFirst))}</span></div>
          {months && <div><span className="lbl">Month 12</span><span className="big-num">{money(total(res.billsLast))}</span> <span className="mono">{naira(total(res.billsLast))}</span></div>}
          {(() => { const st = stayUpBill(inp, sel, res); const changed = st.rows.filter(r => r.planId !== sel.find(s => s.serviceId === r.serviceId)?.planId); return changed.length ? <div id="stayup"><span className="lbl">To stay up{months ? ' at month 12' : ''}</span><span className="big-num" style={{ color: 'var(--amb)' }}>{money(st.usd)}</span> <span className="mono">{naira(st.usd)}</span><span className="note" style={{ display: 'block', margin: 0 }}>{changed.map(r => `${svcById(r.serviceId)!.name} ${planOf(r.serviceId, r.planId)!.name}`).join(', ')}</span></div> : null; })()}
          {fees(res.billsLast) > 0 && <div><span className="lbl">Payment fees{months ? ' (month 12)' : ''}</span><span className="big-num" style={{ fontSize: 22 }}>{naira(fees(res.billsLast))}</span></div>}
        </div>
        <div className="tbl"><table id="bill"><thead><tr><th>Service</th><th>Plan</th><th>{months ? 'Month 1' : 'Month'}</th>{months && <th>Month 12</th>}<th>Why</th></tr></thead><tbody>
          {res.billsLast.map((b, i) => { const svc = svcById(b.serviceId)!; const plan = planOf(b.serviceId, b.planId)!; const f = res.billsFirst[i]; return (
            <tr key={b.serviceId}><td>{svc.name}</td><td>{plan.name}{!plan.verified && <span className="badge warn" style={{ marginLeft: 6 }}>unverified</span>}</td>
              <td className="mono">{money(f.usd)}<br /><span style={{ color: 'var(--mut)' }}>{naira(f.usd)}</span></td>
              {months && <td className="mono">{money(b.usd)}<br /><span style={{ color: 'var(--mut)' }}>{naira(b.usd)}</span></td>}
              <td style={{ color: 'var(--mut)', fontSize: 13 }}>{[...b.lines, ...(b.blocked.length ? [`$0, but over the limit: users get errors (${b.blocked.length} limit${b.blocked.length > 1 ? 's' : ''})`] : [])].join('; ') || 'within free plan'}</td></tr>); })}
        </tbody></table></div>
        <p className="note">Free plans show $0 even when a limit is hit: you do not pay, your users just get errors. Payment fees come out of each sale.</p>
      </section>

      <section className="card" aria-labelledby="r3">
        <div className="step"><span className="n">⇆</span><h2 id="r3">Better options</h2><span className="sub">Sized to your simulated load</span></div>
        <div className="grid2" id="advice">
          {advice.map((a, i) => (<div key={i} className={'adv ' + a.tone}><h3>{a.title}</h3><p>{a.body}</p>{a.source && <p className="note"><a href={a.source} target="_blank" rel="noopener noreferrer">source</a></p>}</div>))}
        </div>
      </section>

      <section className="card" aria-labelledby="r4">
        <div className="step"><span className="n">📶</span><h2 id="r4">Real-network check</h2><span className="sub">{inp.pageWeightKB.toLocaleString('en-US')} KB, {inp.requestsPerPage} files per page</span></div>
        <div className="total">
          <div><span className="lbl">Data cost per visit</span><span className="big-num">₦{net.ngn.toFixed(2)}</span></div>
          <div><span className="lbl">Users waiting over 10 s</span><span className={'big-num' + (net.painfulShare > 0.2 ? ' red' : '')}>{Math.round(net.painfulShare * 100)}%</span></div>
          <div><span className="lbl">Page budget for 5 s on 3G</span><span className="big-num">{net.budgetKB} KB</span></div>
        </div>
        <div className="tbl"><table id="net"><thead><tr><th>Network</th><th>Speed</th><th>Load time</th><th></th><th>Your users</th></tr></thead><tbody>
          {net.rows.map(r => (<tr key={r.profile.id}><td>{r.profile.name}{!r.profile.verified && <span className="badge" style={{ marginLeft: 6 }} title={r.profile.note}>lab profile</span>}</td><td className="mono">{r.profile.mbps} Mbps, {r.profile.rttMs} ms</td>
            <td className="mono">{r.seconds < 10 ? r.seconds.toFixed(1) : Math.round(r.seconds)} s</td>
            <td><div className="bar" style={{ width: 120 }}><i style={{ width: Math.min(100, r.seconds / 30 * 100) + '%', background: r.verdict === 'good' ? 'var(--acc)' : r.verdict === 'slow' ? 'var(--amb)' : 'var(--red)' }} /></div></td>
            <td className="mono">{r.share}%</td></tr>))}
        </tbody></table></div>
        <p className="note">Data cost uses Nigeria's average of $0.39 per GB (Cable.co.uk study; the page is undated, so it may be a year or two old), which is about ₦{DATA.meta.dataCostNgnPerGB.value} per GB. Load times are estimates: round trips plus transfer at 75% of the line speed, before your server even answers.</p>
      </section>

      <section className="card" aria-labelledby="r5">
        <div className="step"><span className="n">⬢</span><h2 id="r5">Package health</h2><span className="sub">npm registry + OSV.dev, live</span></div>
        {!health && <p className="note"><span className="spin" />{hProg || 'Checking…'}</p>}
        {health && risky.length === 0 && <p>All {health.length} packages look healthy: no known vulnerabilities, nothing deprecated, nothing a major version behind.</p>}
        {health && risky.length > 0 && (
          <div className="tbl"><table id="health"><thead><tr><th>Package</th><th>Installed</th><th>Latest</th><th>Issue</th></tr></thead><tbody>
            {risky.map(h => (<tr key={h.name}><td className="mono">{h.name}</td><td className="mono">{h.installed}</td><td className="mono">{h.latest}</td>
              <td>{h.vulns.length > 0 && <div><span className="badge bad">{h.vulns.length} known vuln{h.vulns.length > 1 ? 's' : ''}</span> <span style={{ fontSize: 13, color: 'var(--mut)' }}>{h.vulns.slice(0, 3).map(v => `${v.id}${v.severity ? ` (${v.severity.toLowerCase()})` : ''}${v.summary ? ': ' + v.summary : ''}`).join(' · ')}{h.vulns.length > 3 ? ` · and ${h.vulns.length - 3} more` : ''}</span></div>}
                {h.deprecated && <div><span className="badge bad">deprecated</span> <span style={{ fontSize: 13, color: 'var(--mut)' }}>{h.deprecated}</span></div>}
                {h.behind === 'major' && <div><span className="badge warn">major version behind</span></div>}</td></tr>))}
          </tbody></table></div>
        )}
        {health && <p className="note">Checked {health.length} packages. {health.filter(h => h.behind === 'minor' || h.behind === 'patch').length} are a minor or patch release behind (usually safe to update).</p>}
      </section>

      <section className="card" aria-labelledby="r6">
        <div className="step"><span className="n">⤓</span><h2 id="r6">Share this report</h2><span className="sub">{source?.label}</span></div>
        <div className="row noprint"><button className="btn" onClick={() => window.print()} id="print">Save as PDF</button><button className="btn ghost" onClick={onShare} id="share">Copy share link</button>{copied && <span className="note" style={{ alignSelf: 'center', margin: 0 }}>{copied}</span>}</div>
        <details><summary>Assumptions behind these numbers</summary>
          <ul className="note">
            <li>Traffic happens mostly in 16 waking hours; the busiest minute is 3× the average.</li>
            <li>Each server call uses about 15 ms of CPU and 0.5 s of wall time with 2 GB memory, shared 2 ways (fluid compute).</li>
            <li>Neon wakes for any 5 minute window with a query, at 0.25 compute units plus load.</li>
            <li>Each query returns about 1.5 KB; 15% of queries are writes; each daily user adds about 2 KB of data a day.</li>
            <li>Monthly users = daily users × {inp.dauToMau}. Launch spike visitors are 70% new.</li>
            <li>With Cloudinary, {Math.round(inp.imageShare * 100)}% of page weight (images) is served by Cloudinary instead of your host.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
