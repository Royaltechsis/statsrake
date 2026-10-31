import { DATA } from './plans';
import type { Dep, Selection } from './types';

const POSTGRES = ['pg', 'postgres', '@vercel/postgres', 'kysely', 'pg-promise', 'sequelize', 'typeorm'];
const ORMS = ['prisma', '@prisma/client', 'drizzle-orm', 'drizzle-kit'];
const STATIC_FW = ['vite', 'react-scripts', '@vitejs/plugin-react', 'astro', 'parcel', 'gatsby'];
const SERVERS = ['express', 'fastify', 'hono', 'koa', '@nestjs/core'];

export interface Detection { selections: Selection[]; framework: string; notes: string[]; ormNote?: string; staticSite: boolean }

export function detect(deps: Dep[]): Detection {
  const names = new Set(deps.map(d => d.name));
  const has = (n: string) => names.has(n);
  const sel: Selection[] = [];
  const add = (serviceId: string, why: string) => { if (!sel.some(s => s.serviceId === serviceId)) sel.push({ serviceId, planId: DATA.services.find(s => s.id === serviceId)!.plans[0].id, why }); };
  const notes: string[] = [];
  let framework = 'Node app';
  const staticSite = !has('next') && STATIC_FW.some(has);
  if (has('next')) framework = 'Next.js ' + (deps.find(d => d.name === 'next')?.installed || deps.find(d => d.name === 'next')?.range || '');
  else if (has('vite')) framework = 'Vite';
  else if (has('react-scripts')) framework = 'Create React App';
  else if (has('astro')) framework = 'Astro';
  else if (has('expo')) framework = 'Expo / React Native';

  // Host
  if (DATA.services.find(s => s.id === 'netlify')!.detect.some(has)) add('netlify', 'Netlify plugin in your deps');
  else if (has('next')) add('vercel', 'next is in your deps, so Vercel is the default host');
  else if (staticSite) add('vercel', framework + ' builds a static site; Vercel hosts it (switch to Netlify if you use it)');

  for (const s of DATA.services) {
    if (s.category === 'host') continue;
    const hit = s.detect.find(has);
    if (hit) add(s.id, `found ${hit}`);
  }
  const pg = POSTGRES.find(has);
  if (pg && !sel.some(s => ['neon', 'supabase', 'planetscale'].includes(s.serviceId))) add('neon', `found ${pg} (plain Postgres driver), defaulted to Neon. Swap it if your Postgres lives elsewhere`);
  const orm = ORMS.find(has);
  let ormNote: string | undefined;
  if (orm) {
    ormNote = `${orm} is an ORM, not a bill. It runs queries against your database, so it counts through "DB queries per request".`;
    if (!sel.some(s => DATA.services.find(x => x.id === s.serviceId)?.category === 'db')) add('neon', `found ${orm} with no database driver, assumed Postgres on Neon`);
  }
  const server = SERVERS.find(has);
  if (server && !has('next')) { add('railway', `found ${server}: a long-running server needs a host like Railway`); notes.push(`${server} runs as a long-running server, not on a static host.`); }
  if (has('socket.io') && sel.some(s => s.serviceId === 'vercel' || s.serviceId === 'netlify')) notes.push('socket.io needs a server that stays up. Vercel and Netlify functions cannot hold WebSocket connections.');
  if (staticSite) notes.push('Static front end: no server functions unless you add an API. Set "API calls per page" to 0 if it only calls third parties.');
  return { selections: sel, framework, notes, ormNote, staticSite };
}
