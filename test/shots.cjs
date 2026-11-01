
const { chromium } = require('/home/user/node_modules/playwright-core');
const BASE = process.argv[2]; const OUT = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const errs = [];
  for (const [name, vp, dsf] of [['desk', { width: 1440, height: 900 }, 1], ['phone', { width: 390, height: 844 }, 2]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, isMobile: name === 'phone', hasTouch: name === 'phone' });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await sleep(2600);
    await p.screenshot({ path: `${OUT}/landing_${name}_top.png` });
    await p.screenshot({ path: `${OUT}/landing_${name}_full.png`, fullPage: true });
    const ow = await p.evaluate(() => document.documentElement.scrollWidth); errs.push(`${name} landing scrollWidth ${ow}`);
    await p.goto(BASE + '/simulate/', { waitUntil: 'networkidle' }); await sleep(500);
    await p.screenshot({ path: `${OUT}/sim_${name}_top.png` });
    await p.goto(BASE + '/simulate/?sample=1', { waitUntil: 'networkidle' });
    await p.waitForSelector('#skip', { timeout: 15000 }); await sleep(1500);
    await p.click('#skip'); await p.waitForSelector('#raketimeline');
    await p.evaluate(() => { const el = document.querySelector('#results'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 10); }); await sleep(600);
    // tap third rake
    const rk = await p.$$('.rk'); if (rk[2]) { await rk[2].click(); await sleep(700); }
    await p.screenshot({ path: `${OUT}/results_${name}.png` });
    const ow2 = await p.evaluate(() => document.documentElement.scrollWidth); errs.push(`${name} sim scrollWidth ${ow2}`);
    await ctx.close();
  }
  console.log(errs.join('\n')); await b.close();
})();
