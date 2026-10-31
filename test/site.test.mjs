import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const html = readFileSync(join(site, 'index.html'), 'utf8');

test('index has title, viewport and tagline', () => {
  assert.match(html, /<title>Wahala: stress-test your stack before launch<\/title>/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /Give your app wahala/);
  assert.match(html, /Try a sample stack/);
  assert.match(html, /Estimates based on public pricing as of the checked date/);
});
test('no em dashes or placeholders in the page', () => {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.ok(!text.includes('\u2014'), 'em dash found');
  assert.ok(!/lorem ipsum|TODO|FIXME/i.test(text));
});
test('local assets referenced by the page exist', () => {
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(m => m[1]);
  assert.ok(refs.length > 3);
  for (const r of refs) assert.ok(existsSync(join(site, r)), 'missing ' + r);
});
test('plans data carries a source and checked date for every service', () => {
  const d = JSON.parse(readFileSync(join(root, 'data', 'plans.json'), 'utf8'));
  assert.ok(d.services.length >= 20);
  for (const s of d.services) {
    assert.ok(s.source.startsWith('https://'), s.id);
    assert.equal(s.checkedOn, '2026-10-31');
    for (const p of s.plans) assert.equal(typeof p.verified, 'boolean', s.id + '/' + p.id);
  }
});
test('the built bundle contains the simulator and sample stack', () => {
  const js = readdirSync(join(site, '_next', 'static', 'chunks')).filter(f => f.endsWith('.js')).map(f => readFileSync(join(site, '_next', 'static', 'chunks', f), 'utf8')).join('\n');
  assert.match(js, /react-paystack/);
  assert.match(js, /api\.osv\.dev\/v1\/querybatch/);
  assert.match(js, /raw\.githubusercontent\.com/);
});
