let pw; try { pw = require('playwright-core'); } catch { pw = require('/home/user/node_modules/playwright-core'); }
const { chromium } = pw;
const EXE = process.env.CHROME_PATH || '/usr/bin/chromium';
const BASE = process.argv[2]; const OUT = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('#sample'); await p.waitForSelector('#chips');
  await p.waitForFunction(() => !document.body.textContent.includes('Checking packages'), null, { timeout: 60000 }).catch(() => {});
  await p.evaluate(() => { window.scrollTo(0, document.querySelector('#s1b').closest('section').offsetTop - 12); }); await sleep(400);
  await p.screenshot({ path: OUT + '/wahala_stack.png' });
  await p.click('#run'); await p.waitForSelector('#simcard');
  // let it play into the second half of the month where Neon goes red
  await p.waitForFunction(() => +(document.querySelector('#sim-step')?.firstChild?.textContent || 0) >= 18, null, { timeout: 30000 });
  await p.click('.controls .btn'); // pause
  await p.evaluate(() => { window.scrollTo(0, document.querySelector('#simcard').offsetTop - 12); }); await sleep(700);
  await p.screenshot({ path: OUT + '/wahala_sim.png' });
  console.log('red nodes at pause:', await p.$$eval('[data-status=over]', e => e.map(x => x.getAttribute('data-node'))));
  await p.click('.controls .btn'); await p.waitForSelector('#results', { timeout: 30000 });
  await p.waitForSelector('#health, #r5', { timeout: 30000 });
  await p.evaluate(() => { window.scrollTo(0, document.querySelector('#results').offsetTop - 12); }); await sleep(500);
  await p.screenshot({ path: OUT + '/wahala_results.png' });
  console.log('stayup:', await p.textContent('#stayup').catch(() => 'none'));
  console.log('bill:', (await p.textContent('#bill')).slice(0, 600));
  // 12 month mode
  await p.click('text=12 months'); await p.click('#run'); await p.click('#skip').catch(() => {}); await p.waitForSelector('#results');
  console.log('12mo breaks:', (await p.$$eval('.brk', e => e.map(x => x.textContent.slice(0, 130)))).join('\n  '));
  console.log('12mo stayup:', await p.textContent('#stayup').catch(() => 'none'));
  console.log('advice:', (await p.$$eval('.adv', e => e.map(x => x.textContent.slice(0, 260)))).join('\n  '));
  // phone results
  const ph = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const q = await ph.newPage(); await q.goto(BASE, { waitUntil: 'networkidle' }); await q.click('#sample'); await q.click('#run');
  await q.waitForFunction(() => +(document.querySelector('#sim-step')?.firstChild?.textContent || 0) >= 18, null, { timeout: 30000 });
  await q.click('.controls .btn'); await q.evaluate(() => window.scrollTo(0, document.querySelector('#simcard').offsetTop - 8)); await sleep(500);
  await q.screenshot({ path: OUT + '/wahala_sim_phone.png' });
  console.log('errors:', errs);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
