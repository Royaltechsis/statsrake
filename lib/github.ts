import { parsePackageLock, parsePnpmLock, parseYarnLock } from './lockfile';
import type { Dep, StackSource } from './types';

export class StackError extends Error {}

export function parseRepoUrl(input: string): { owner: string; repo: string; branch?: string; path?: string } | null {
  const s = input.trim().replace(/\.git$/, '').replace(/\/$/, '');
  let m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/i);
  if (m) return { owner: m[1], repo: m[2], branch: m[3], path: m[4] && m[4].replace(/\/?package\.json$/, '') };
  m = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

async function getText(url: string, timeoutMs = 12000): Promise<string | null> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) return null; return await r.text(); }
  catch { return null; } finally { clearTimeout(t); }
}

export function depsFromPackageJson(pkg: any): Dep[] {
  const deps: Dep[] = [];
  for (const [n, r] of Object.entries<string>(pkg.dependencies || {})) deps.push({ name: n, range: String(r), dev: false, via: 'unknown' });
  for (const [n, r] of Object.entries<string>(pkg.devDependencies || {})) deps.push({ name: n, range: String(r), dev: true, via: 'unknown' });
  return deps;
}

export function parsePackageJsonText(text: string): any {
  let pkg: any;
  try { pkg = JSON.parse(text); } catch (e: any) { throw new StackError('That is not valid JSON: ' + (e?.message || 'parse error')); }
  if (!pkg || typeof pkg !== 'object' || (!pkg.dependencies && !pkg.devDependencies)) throw new StackError('No "dependencies" or "devDependencies" found in that package.json.');
  return pkg;
}

export function applyLock(deps: Dep[], lockName: string | undefined, lockText: string | null): string | undefined {
  if (!lockName || !lockText) return undefined;
  let map: Record<string, string> = {};
  try {
    if (lockName === 'package-lock.json') map = parsePackageLock(lockText);
    else if (lockName === 'pnpm-lock.yaml') map = parsePnpmLock(lockText);
    else if (lockName === 'yarn.lock') map = parseYarnLock(lockText, Object.fromEntries(deps.map(d => [d.name, d.range])));
  } catch { return undefined; }
  let hit = 0;
  for (const d of deps) if (map[d.name]) { d.installed = map[d.name]; d.via = 'lockfile'; hit++; }
  return hit ? lockName : undefined;
}

export async function loadFromGitHub(input: string): Promise<{ pkg: any; deps: Dep[]; source: StackSource }> {
  const p = parseRepoUrl(input);
  if (!p) throw new StackError('That does not look like a GitHub repo link. Try https://github.com/owner/repo');
  const notes: string[] = [];
  let branches = p.branch ? [p.branch] : [];
  if (!p.branch) {
    const meta = await getText(`https://api.github.com/repos/${p.owner}/${p.repo}`);
    if (meta) { try { const j = JSON.parse(meta); if (j.private) throw new StackError('That repo is private. Paste its package.json instead.'); if (j.default_branch) branches.push(j.default_branch); } catch (e) { if (e instanceof StackError) throw e; } }
    for (const b of ['main', 'master']) if (!branches.includes(b)) branches.push(b);
  }
  const base = p.path ? p.path + '/' : '';
  let pkgText: string | null = null, branch = '';
  for (const b of branches) {
    pkgText = await getText(`https://raw.githubusercontent.com/${p.owner}/${p.repo}/${b}/${base}package.json`);
    if (pkgText) { branch = b; break; }
  }
  if (!pkgText) throw new StackError(`Could not find a package.json at the root of ${p.owner}/${p.repo} (tried ${branches.join(', ')}). Is the repo public and a JavaScript project?`);
  const pkg = parsePackageJsonText(pkgText);
  const deps = depsFromPackageJson(pkg);
  const raw = (f: string) => `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${branch}/${base}${f}`;
  const locks = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
  const texts = await Promise.all(locks.map(f => getText(raw(f), 15000)));
  let lockfile: string | undefined;
  for (let i = 0; i < locks.length && !lockfile; i++) lockfile = applyLock(deps, locks[i], texts[i]);
  if (pkg.workspaces) notes.push('This looks like a monorepo. v1 reads the root package.json only, so app packages inside workspaces are not included.');
  if (!lockfile) notes.push('No lockfile found at the root, so installed versions are resolved from your version ranges as npm would today.');
  return { pkg, deps, source: { label: `${p.owner}/${p.repo}`, repoUrl: `https://github.com/${p.owner}/${p.repo}`, branch, lockfile, notes } };
}
