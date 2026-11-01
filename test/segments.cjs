
const { chromium } = require('/home/user/node_modules/playwright-core');
const [BASE, OUT, W, H, DSF] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DSF, isMobile: +W < 600 });
  const p = await ctx.newPage(); await p.goto(BASE, { waitUntil: 'networkidle' });
  const total = await p.evaluate(() => document.documentElement.scrollHeight);
  let i = 0; for (let y = 0; y < total; y += +H - 60) { await p.evaluate(y => window.scrollTo(0, y), y); await new Promise(r => setTimeout(r, 1800)); await p.screenshot({ path: `${OUT}_${i++}.png` }); }
  console.log(i, total); await b.close();
})();
