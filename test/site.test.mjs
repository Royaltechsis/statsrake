import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = existsSync(join(root, 'site', 'index.html')) ? join(root, 'site') : join(root, 'out');
const landing = readFileSync(join(site, 'index.html'), 'utf8');
const sim = readFileSync(join(site, 'simulate', 'index.html'), 'utf8');
const visible = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');

test('landing has the brand, tagline, viewport and the sections asked for', () => {
  assert.match(landing, /<title>StatsRake: see the rake before it sees your face<\/title>/);
  assert.match(landing, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(landing, /See the rake <em>before it sees your face\.<\/em>/);
  for (const s of ['How it works', 'A real result', 'What it catches', 'Who it is for', 'FAQ', 'Built by']) assert.ok(landing.includes(s), s);
  for (const s of ['Resend free', 'Cloudinary free', 'Vercel Hobby', 'Neon free']) assert.ok(landing.includes(s), s);
  assert.match(landing, /\$(<!-- -->)?158\.40/);
  assert.match(landing, /href="\/simulate\/"/);
  assert.match(landing, /github\.com\/Royaltechsis/);
  assert.match(landing, /og:image/);
});
test('simulator page is renamed and keeps its controls', () => {
  assert.match(sim, /Simulator \| StatsRake/);
  assert.match(sim, /Try a sample stack/);
  assert.match(sim, /Read my repo/);
});
test('no Wahala, no em dashes, no placeholders in visible copy', () => {
  for (const h of [landing, sim]) {
    const t = visible(h);
    assert.ok(!/wahala/i.test(t), 'old name found');
    assert.ok(!t.includes('\u2014'), 'em dash found');
    assert.ok(!/lorem ipsum|TODO|FIXME|placeholder text/i.test(t));
  }
});
test('blueprint art replaces the mascot', () => {
  assert.match(landing, /A rake drawn as a technical schematic/);
  assert.match(landing, /14 DAYS TO HOSTING LIMIT/);
  assert.match(landing, /Drawn by/);
  for (const h of [landing, sim]) {
    const t = visible(h);
    assert.ok(!/SMACK!|mascot|clipboard/i.test(t), 'cartoon leftovers found');
  }
  const fav = readFileSync(join(site, 'favicon.svg'), 'utf8');
  assert.match(fav, /#ffb347/);
  assert.ok(!/clipboard|eye/i.test(fav));
  for (const f of ['fonts/SpaceGrotesk.woff2', 'fonts/PlexMono-400.woff2']) assert.ok(existsSync(join(site, f)), f);
});
test('local assets exist and no remote assets are loaded', () => {
  for (const f of ['favicon.svg', 'og.png']) assert.ok(existsSync(join(site, f)), f);
  const refs = [...landing.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(m => m[1].split('#')[0].split('?')[0]).filter(r => !r.endsWith('/'));
  for (const r of refs) assert.ok(existsSync(join(site, r)), 'missing ' + r);
  assert.ok(!/<script[^>]+src="https?:/.test(landing));
});
test('no single file is too big to publish', () => {
  const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [[p, statSync(p).size]]; });
  for (const [p, s] of walk(site)) assert.ok(s < 1_300_000, p + ' is ' + s);
});
