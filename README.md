# StatsRake

**See the rake before it sees your face.**

You know the cartoon: step on a rake hidden in the grass and the handle smacks you in the face. Free tiers work the same way. Two quiet weeks, then day 14 and your host pauses the site. StatsRake is the statistics that show you every rake in the grass before you step on one.

Live preview: https://statsrake.sites.tab.bot

## What it does

Paste a public GitHub repo (or a package.json), set your traffic (daily users, launch spike, growth), and StatsRake:

- reads your exact package versions (from the lockfile when there is one) and detects the services you depend on (Vercel, Neon, Resend, Cloudinary, Paystack, Clerk, Supabase, Firebase and more)
- lets you pick the plan you are really on for each service
- simulates 30 days (or 12 months) of traffic and puts a rake on the timeline at the day each limit is hit, with what your users feel
- shows the monthly bill to stay up, in dollars and naira at a checked exchange rate
- estimates load time and data cost per visit on 2G, 3G and 4G Nigerian networks
- checks every dependency live against npm and OSV.dev for known vulnerabilities, deprecations and major versions behind

Example (the built-in sample stack, 800 daily users, 5x launch spike, 25% monthly growth): Resend free breaks on day 1, Cloudinary free on day 10, Vercel Hobby on day 14, Neon free on day 17. Staying up costs about $158 a month (about ₦213k).

## Honest limits

- It is a model, not a load test. Every assumption is listed in the report and lives in `lib/sim.ts`.
- Prices and limits were checked against public pricing pages on the date in `data/plans.json`. Anything not confirmed from an official page is labelled unverified in the app.
- Unauthenticated GitHub API calls are limited to 60 an hour per IP. Paste the package.json for private repos.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export to ./out
npm test        # checks the built pages
```

No environment variables are needed. Reports are saved in the browser (localStorage) only.

## Deploy on Vercel

Import the repo on vercel.com/new and press Deploy. No settings to change.

## Structure

- `app/page.tsx` landing page
- `app/simulate/page.tsx` the simulator
- `components/RakeTimeline.tsx` the rake timeline in the results
- `components/Rake.tsx` the small schematic rake mark (logo, favicon, timeline markers)
- `components/BlueprintRake.tsx` the blueprint rake drawing used as hero art (hand-built, responsive SVG)
- `public/fonts/` Space Grotesk and IBM Plex Mono (SIL Open Font License), self-hosted
- `components/SimView.tsx` the animated stack diagram
- `lib/` detection, simulation, pricing advice, network model, package health
- `data/plans.json` plans, limits, prices, sources

Built by Oluwabunmi Oseni ([@Royaltechsis](https://github.com/Royaltechsis)) in Nigeria.
