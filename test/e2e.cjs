// End-to-end check in a headless browser: node test/e2e.cjs <baseUrl> <outDir>
let pw; try { pw = require('playwright-core'); } catch { pw = require('/home/user/node_modules/playwright-core'); }
const { chromium } = pw;
const EXE = process.env.CHROME_PATH || '/usr/bin/chromium';
const BASE = (process.argv[2] || 'http://127.0.0.1:8811/').replace(/\/?$/, '/') + 'simulate/';
const OUT = process.argv[3] || '/tmp/statsrake_shots';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  let fails = 0; const ok = (c, m) => { log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  for (const vp of [{ name: 'phone', width: 390, height: 844, mobile: true }, { name: 'desktop', width: 1366, height: 900, mobile: false }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    // 1. invalid URL
    await p.fill('#repo-input', 'not a repo at all'); await p.click('#load-repo'); await p.waitForSelector('#err');
    ok((await p.textContent('#err')).includes('GitHub repo link'), `${vp.name}: invalid URL shows a clear error`);
    await p.fill('#repo-input', 'https://github.com/Royaltechsis/this-repo-does-not-exist-xyz'); await p.click('#load-repo');
    await p.waitForFunction(() => document.querySelector('#err')?.textContent.includes('Could not find'), null, { timeout: 30000 });
    ok(true, `${vp.name}: missing repo shows a clear error`);
    // 2. sample stack
    await p.click('#sample'); await p.waitForSelector('#chips');
    const chips = await p.$$eval('#chips .chip', els => els.map(e => e.textContent));
    ok(chips.length >= 5, `${vp.name}: sample detected ${chips.length} services: ${chips.join(' | ')}`);
    const hw = Date.now(); await p.waitForFunction(() => !document.body.textContent.includes('Checking packages'), null, { timeout: 60000 }).catch(() => {});
    log(`  health took ${Date.now() - hw} ms`);
    if (vp.name === 'desktop') { await p.$eval('#s1b', el => el.scrollIntoView()); await sleep(300); await p.screenshot({ path: `${OUT}/stack_${vp.name}.png` }); }
    else await p.screenshot({ path: `${OUT}/stack_${vp.name}.png`, fullPage: false });
    await p.click('#run');
    await p.waitForSelector('#simcard');
    // wait for a red node mid-run
    let red = false;
    for (let i = 0; i < 60; i++) { if (await p.$('[data-status=over]')) { red = true; break; } await sleep(150); }
    ok(red, `${vp.name}: a node turned red during the run (step ${await p.textContent('#sim-step')})`);
    await sleep(500);
    await p.$eval('#simcard', el => el.scrollIntoView()); await sleep(200);
    await p.screenshot({ path: `${OUT}/sim_${vp.name}.png` });
    await p.waitForSelector('#results', { timeout: 20000 });
    const breaks = await p.$$eval('.brk', els => els.map(e => e.textContent.slice(0, 160)));
    ok(breaks.length > 0, `${vp.name}: results list ${breaks.length} entries`); breaks.slice(0, 6).forEach(x => log('   ', x));
    const adv = await p.$$eval('.adv h3', els => els.map(e => e.textContent)); log('   advice:', adv.join(' | '));
    await p.waitForFunction(() => !document.querySelector('#r5')?.closest('section')?.textContent.includes('Checking'), null, { timeout: 60000 }).catch(() => {});
    await p.$eval('#results', el => el.scrollIntoView()); await sleep(300);
    await p.screenshot({ path: `${OUT}/results_${vp.name}.png` });
    await p.screenshot({ path: `${OUT}/full_${vp.name}.png`, fullPage: true });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(overflow <= 1, `${vp.name}: no horizontal overflow (${overflow}px)`);
    const emdash = await p.evaluate(() => document.body.innerText.includes('\u2014'));
    ok(!emdash, `${vp.name}: no em dashes on screen`);
    // 3. pasted package.json
    if (vp.name === 'desktop') {
      await p.goto(BASE, { waitUntil: 'networkidle' });
      await p.click('text=Paste package.json');
      await p.fill('#paste-input', JSON.stringify({ name: 'pasted', dependencies: { next: '^14.1.0', mongoose: '^7.0.0', '@clerk/nextjs': '^4.29.0', openai: '^4.20.0', 'socket.io': '^4.7.0', request: '2.88.2' } }));
      await p.click('#load-paste'); await p.waitForSelector('#chips');
      const c2 = await p.$$eval('#chips .chip', els => els.map(e => e.textContent)); ok(c2.length >= 4, 'paste detected: ' + c2.join(' | '));
      await p.click('#run'); await p.click('#skip').catch(() => {}); await p.waitForSelector('#results');
      await p.waitForFunction(() => document.querySelector('#health') || document.body.textContent.includes('look healthy'), null, { timeout: 60000 }).catch(() => {});
      const h = await p.$$eval('#health tr', els => els.map(e => e.textContent.slice(0, 120))); ok(h.length > 1, 'paste health rows: ' + h.length); h.slice(0, 5).forEach(x => log('   ', x));
      // 4. real repos
      for (const repo of ['https://github.com/Royaltechsis/rigready', process.env.REPO2 || 'https://github.com/vercel/nextjs-postgres-auth-starter']) {
        await p.goto(BASE, { waitUntil: 'networkidle' });
        await p.fill('#repo-input', repo); await p.click('#load-repo');
        try { await p.waitForSelector('#chips', { timeout: 40000 }); const c3 = await p.$$eval('#chips .chip', els => els.map(e => e.textContent)); const sub = await p.textContent('#s1b'); ok(true, `repo ${repo}: ${sub} :: ${c3.join(' | ')}`);
          const notes = await p.$$eval('.note', els => els.slice(0, 4).map(e => e.textContent)); log('    notes:', notes.join(' / '));
          const rows = await p.$$eval('#deps tbody tr', els => els.slice(0, 6).map(e => e.textContent)); log('    deps:', rows.join(' / '));
          await p.click('#run'); await p.click('#skip').catch(() => {}); await p.waitForSelector('#results', { timeout: 20000 }); ok(true, `repo ${repo}: simulation ran`);
        } catch (e) { ok(false, `repo ${repo}: ${e.message.split('\n')[0]} ${await p.textContent('#err').catch(() => '')}`); }
      }
    }
    ok(errs.length === 0, `${vp.name}: console errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
