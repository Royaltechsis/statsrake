# Wahala

**Give your app wahala before your users do.**

Live: https://wahala.sites.tab.bot

Wahala is an interactive production simulator for indie and African developers. Paste a public GitHub repo (or a package.json), and it:

1. Reads your dependencies with their **exact installed versions** (from `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock` when present, otherwise resolved from your ranges the way npm would today).
2. **Detects the services** your stack implies (Vercel/Netlify, Neon, Supabase, Firebase, MongoDB Atlas, Clerk, NextAuth, Resend, Cloudinary, UploadThing, Upstash, Paystack, Flutterwave, Stripe, OpenAI, Anthropic, Gemini, Pusher, Socket.IO, Sentry...). Add or remove services by hand.
3. Lets you pick the **plan you are really on** for each service (real prices, each with its source URL and checked date).
4. **Simulates usage** over 30 days or 12 months: daily users, pages, page weight, server calls, DB queries, uploads, emails, AI calls, payments, growth and a launch-day spike, plus your users' network mix (MTN/Airtel/Glo 4G, 3G, 2G).
5. Shows **where it breaks** (which limit, which day, at how many users, what users feel), the **monthly bill in $ and ₦**, **package health** (latest version from npm, vulnerabilities from OSV.dev, deprecations), a **real-network check** (load time per Nigerian network, data cost per visit in naira) and **better options** sized to your load.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export in out/
npm test           # checks the built site in site/ (copy out/ to site/ first)
```

## Where things live

- `data/plans.json`: every plan, limit and price, with `source` and `checkedOn`. Entries marked `"verified": false` are shown as unverified in the UI. Update this file to refresh prices.
- `lib/sim.ts`: the simulation engine. All modelling assumptions are in the `ASSUME` object at the top.
- `lib/options.ts`: the "better options" rules.
- `lib/detect.ts`: package to service detection.
- `lib/github.ts`, `lib/lockfile.ts`: repo and lockfile reading.
- `lib/health.ts`: npm registry, jsDelivr (range resolution) and OSV.dev checks.
- `lib/store.ts`: the persistence seam. v1 saves reports in localStorage. To move to a backend, add `app/api/reports/route.ts` writing to Neon via `DATABASE_URL`, drop `output: 'export'`, and swap in an API-backed store.

Everything runs in the browser for v1: no server, no tracking.

## Caveats

Estimates are based on public pricing as of the checked date; verify before deciding. Usage models are simplified (see `ASSUME`). 4G speeds are SpeedGeo Q1 2026 averages quoted by ohayu.com; 3G and 2G use standard lab profiles; data cost uses Cable.co.uk's Nigeria average ($0.39/GB); the naira rate is from open.er-api.com.
