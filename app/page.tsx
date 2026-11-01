import Link from 'next/link';
import { DATA } from '../lib/plans';
import { Mascot, RakeMark, RakeIcon } from '../components/Rake';

const FX = DATA.meta.fx.ngnPerUsd;
const STAY_UP = 158.4036; // from the simulator's sample run (lib/sample.ts), Oct 31 2026 prices
const ngn = (u: number) => '₦' + Math.round(u * FX).toLocaleString('en-US');

const SAMPLE = [
  { day: 1, name: 'Resend free', what: 'Emails per day: 300 needed, 100 allowed', feel: 'Password resets and receipts stop sending on launch day.' },
  { day: 10, name: 'Cloudinary free', what: 'Monthly credits: 26.3 of 25 used', feel: 'Images stop loading until the next billing cycle.' },
  { day: 14, name: 'Vercel Hobby', what: 'Edge requests: 1M of 1M used', feel: 'Hobby features pause until the 30 days are up.' },
  { day: 17, name: 'Neon free', what: 'Compute hours: 104 of 100 used', feel: 'The database is suspended. Every page that needs data errors.' },
];
const FIX = [
  ['Vercel', 'Pro', 20], ['Neon', 'Launch', 19.4], ['Resend', 'Pro', 20], ['Cloudinary', 'Plus', 99],
] as const;

export default function Landing() {
  return (
    <main className="lp">
      <div className="wrap">
        <header className="top">
          <a className="brand" href="/"><RakeMark size={30} />StatsRake</a>
          <nav className="lp-nav" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#example">Example</a>
            <a href="#faq">FAQ</a>
            <Link className="btn" href="/simulate/">Find my rakes</Link>
          </nav>
        </header>

        <section className="lp-hero" aria-labelledby="h">
          <div className="lp-copy">
            <p className="eyebrow">Free-tier forecasts for indie and African devs</p>
            <h1 id="h">See the rake <em>before it sees your face.</em></h1>
            <p className="lede">StatsRake walks your stack through launch day and the weeks after, day by day, and shows the exact day each free tier gives out. Plus what it costs to stay up in dollars and naira, how the app feels on 2G and 3G, and which of your packages have known holes.</p>
            <div className="row cta-row">
              <Link className="btn big" href="/simulate/">Find my rakes</Link>
              <Link className="btn big ghost" href="/simulate/?sample=1">Run the sample stack</Link>
            </div>
            <p className="note">Free. No sign up. Runs in your browser.</p>
          </div>
          <div className="lp-art"><Mascot className="mascot" /></div>
        </section>

        <section className="teaser" aria-label="Animated example: a 30 day timeline with four rakes">
          <div className="teaser-head"><span>Sample stack, 30 days</span><span className="mono">800 daily users · 5x launch spike · +25% a month</span></div>
          <div className="teaser-field">
            <div className="walker" aria-hidden="true">your app</div>
            {SAMPLE.map((r, i) => (
              <div key={r.day} className="t-rake" style={{ left: `${((r.day - 1) / 29) * 100}%`, ['--p' as any]: (r.day - 1) / 29, ['--r' as any]: i }}>
                <span className="t-stem" />
                <span className="t-lbl"><b>D{r.day}</b> {r.name}</span>
                <span className="t-ic"><RakeIcon size={52} /><span className="pow">SMACK!</span></span>
              </div>
            ))}
            <div className="rt-grass" />
          </div>
          <div className="rt-axis" aria-hidden="true">{[1, 7, 14, 21, 30].map(t => <span key={t} style={{ left: `${((t - 1) / 29) * 100}%` }}><i className="dw">Day </i>{t}</span>)}</div>
        </section>

        <section className="lp-sec gag">
          <p>You know the cartoon. Somebody walks across the lawn, steps on a rake hiding in the grass, and the handle comes up and smacks them in the face. They never saw it coming.</p>
          <p><strong>Free tiers work exactly like that.</strong> Two quiet weeks, everything green, then day 14 arrives and your host pauses the site while you are asleep. StatsRake is the statistics that show you every rake in the grass before you step on one.</p>
        </section>

        <section className="lp-sec" id="how" aria-labelledby="how-h">
          <h2 id="how-h">How it works</h2>
          <ol className="steps3">
            <li><span className="num">1</span><h3>Show it your stack</h3><p>Paste a public GitHub repo, drop in a package.json, or pick services by hand. StatsRake reads your exact versions and spots Vercel, Neon, Resend, Paystack and friends from your dependencies.</p></li>
            <li><span className="num">2</span><h3>Set your traffic</h3><p>Daily users, how big the launch spike is, how fast you grow. Pick the plans you are really on, free or paid.</p></li>
            <li><span className="num">3</span><h3>Walk the timeline</h3><p>Watch the days tick by. Each limit you hit is a rake on the timeline, with what your users feel, the bill to stay up, and cheaper ways out.</p></li>
          </ol>
        </section>

        <section className="lp-sec" id="example" aria-labelledby="ex-h">
          <h2 id="ex-h">A real result</h2>
          <p className="sub">The sample stack every new visitor can run: Next.js on Vercel Hobby, Neon, Resend, Cloudinary, Paystack, NextAuth. <span className="mono">800 daily users, a 5x launch spike on day 1, growing 25% a month.</span></p>
          <div className="ex">
            <ul className="ex-list">
              {SAMPLE.map(r => (
                <li key={r.day}><span className="d">Day {r.day}</span><div><b>{r.name}</b><span>{r.what}</span><em>{r.feel}</em></div></li>
              ))}
            </ul>
            <div className="ex-bill">
              <span className="lbl">To stay up all month</span>
              <span className="big-num">${STAY_UP.toFixed(2)}<small>/mo</small></span>
              <span className="mono ngn">≈ {ngn(STAY_UP)}</span>
              <ul>{FIX.map(([s, p, u]) => <li key={s}><span>{s} {p}</span><span className="mono">${u.toFixed(2)}</span></li>)}</ul>
              <p className="note">At ₦{FX.toLocaleString('en-US', { maximumFractionDigits: 2 })} per $1 ({DATA.meta.fx.checkedOn}). Paystack fees come out of each sale and are shown separately in the app.</p>
              <Link className="btn" href="/simulate/?sample=1">Run it yourself</Link>
            </div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="catch-h">
          <h2 id="catch-h">What it catches</h2>
          <div className="catch">
            <div><h3><span className="dot red" />Free-tier cliffs</h3><p>Emails per day, edge requests, compute hours, credits, storage. The day each one runs out, and what breaks for users when it does.</p></div>
            <div><h3><span className="dot amb" />Cost surprises</h3><p>The monthly bill to stay up, in dollars and naira at the live rate, and which upgrade or swap is cheapest for your load.</p></div>
            <div><h3><span className="dot blue" />Slow on 2G and 3G</h3><p>About 36% of Nigerian mobile subscriptions were still on 2G in August 2026 (NCC). See load times on 2G, 3G and 4G, and the data cost of each visit.</p></div>
            <div><h3><span className="dot lime" />Vulnerable packages</h3><p>Every dependency checked live against npm and the OSV database. On its first run it flagged a critical remote code execution bug in next 14.2.35.</p></div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="who-h">
          <h2 id="who-h">Who it is for</h2>
          <ul className="who">
            <li><b>Indie devs about to launch.</b> Know whether the free stack survives your first post going viral.</li>
            <li><b>Freelancers building for clients.</b> Hand over a stack with the monthly cost already worked out, in naira.</li>
            <li><b>Students and bootcamp grads.</b> Learn what Hobby, free and pay as you go actually mean before a demo day.</li>
            <li><b>Small teams in Lagos, Nairobi, Accra and beyond.</b> Plan for real networks and real exchange rates, not Silicon Valley defaults.</li>
          </ul>
        </section>

        <section className="lp-sec" id="faq" aria-labelledby="faq-h">
          <h2 id="faq-h">FAQ</h2>
          <details><summary>Is this real traffic?</summary><p>No. StatsRake is a model, not a load test. It estimates usage from your inputs with assumptions you can read in every report. Treat each rake as a strong hint about where to look, not a promise of the exact day.</p></details>
          <details><summary>Are the prices current?</summary><p>Plan limits and prices were checked against each provider's public pricing on {DATA.meta.checkedOn}. Providers change them, so check before you buy. Anything we could not confirm from an official page is labelled unverified in the app.</p></details>
          <details><summary>Does it see my code?</summary><p>Only your package.json and lockfile, fetched from the public GitHub API by your own browser. Nothing is sent to a StatsRake server and reports are saved only on your device. Private repo? Paste the package.json instead.</p></details>
          <details><summary>Why naira?</summary><p>Because that is the money most of our users pay with. Every cost is shown in dollars and in naira at the exchange rate checked on {DATA.meta.fx.checkedOn}.</p></details>
          <details><summary>Does it cost anything?</summary><p>No. It is free and needs no account.</p></details>
        </section>

        <section className="lp-final">
          <h2>Your app has rakes. Go find them.</h2>
          <Link className="btn big" href="/simulate/">Find my rakes</Link>
        </section>

        <footer className="lp-foot">
          <p>Built by <a href="https://github.com/Royaltechsis" target="_blank" rel="noopener noreferrer">Oluwabunmi Oseni</a> in Nigeria. Code on <a href="https://github.com/Royaltechsis/statsrake" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
          <p className="note">Service names are used only to describe compatibility. StatsRake is not affiliated with any provider listed.</p>
        </footer>
      </div>
    </main>
  );
}
