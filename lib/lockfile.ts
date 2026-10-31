// Parse exact installed versions for root dependencies from common lockfiles.
export function parsePackageLock(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const j = JSON.parse(text);
  if (j.packages) {
    for (const [k, v] of Object.entries<any>(j.packages)) {
      if (!k.startsWith('node_modules/')) continue;
      const name = k.slice('node_modules/'.length);
      if (name.includes('/node_modules/')) continue; // nested copy, not the root one
      if (v && v.version) out[name] = v.version;
    }
  } else if (j.dependencies) {
    for (const [k, v] of Object.entries<any>(j.dependencies)) if (v && v.version) out[k] = v.version;
  }
  return out;
}

export function parsePnpmLock(text: string): Record<string, string> {
  // pnpm v6 to v9: importers['.'].dependencies.<name>.version  or root dependencies: name: { specifier, version }
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let inRoot = false, inDeps = false, current = '';
  const hasImporters = lines.some(l => l.startsWith('importers:'));
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (hasImporters) {
      if (/^  \.:\s*$/.test(l)) { inRoot = true; continue; }
      if (inRoot && /^  \S/.test(l)) { inRoot = false; inDeps = false; }
      if (!inRoot) continue;
      if (/^    (dependencies|devDependencies|optionalDependencies):\s*$/.test(l)) { inDeps = true; continue; }
      if (/^    \S/.test(l)) { inDeps = false; continue; }
      if (!inDeps) continue;
      const m = l.match(/^      ['"]?([^'":]+)['"]?:\s*$/); if (m) { current = m[1]; continue; }
      const v = l.match(/^        version:\s*['"]?([^'"\s(]+)/); if (v && current) { out[current] = v[1]; }
    } else {
      if (/^(dependencies|devDependencies):\s*$/.test(l)) { inDeps = true; continue; }
      if (/^\S/.test(l)) { inDeps = false; continue; }
      if (!inDeps) continue;
      const m = l.match(/^  ['"]?([^'":]+)['"]?:\s*(\S+)?\s*$/);
      if (m) { current = m[1]; if (m[2] && /^\d/.test(m[2])) out[current] = m[2].replace(/[_(].*$/, ''); continue; }
      const v = l.match(/^    version:\s*['"]?([^'"\s(_]+)/); if (v && current) out[current] = v[1];
    }
  }
  return out;
}

export function parseYarnLock(text: string, wanted: Record<string, string>): Record<string, string> {
  // Works for yarn v1 and berry. Maps "name@range" headers to the version line below them.
  const out: Record<string, string> = {};
  const blocks = text.split(/\r?\n(?=\S)/);
  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    const header = lines[0].replace(/:$/, '');
    const vLine = lines.find(l => /^\s+version:?\s/.test(l));
    if (!vLine) continue;
    const version = vLine.replace(/^\s+version:?\s+/, '').replace(/["']/g, '').trim();
    for (const spec of header.split(/,\s*/)) {
      const s = spec.replace(/["']/g, '').trim();
      const at = s.lastIndexOf('@'); if (at <= 0) continue;
      const name = s.slice(0, at); const range = s.slice(at + 1).replace(/^npm:/, '');
      if (wanted[name] !== undefined && (wanted[name] === range || !out[name])) out[name] = version;
    }
  }
  return out;
}
