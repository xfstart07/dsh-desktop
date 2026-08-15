// Deploys the built dsh CLI (plus prod dependencies and the web frontend dist)
// into ./backend as a self-contained module tree, using pnpm deploy from the
// harness repo. Requires: repo built (pnpm run build) and pnpm available.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = process.env.DSH_REPO || '/Users/x/myspace/deepseek-harness'
const target = join(projectRoot, 'backend')

if (!existsSync(join(repoRoot, 'pnpm-workspace.yaml'))) {
  console.error(`not a pnpm workspace: ${repoRoot} (set DSH_REPO)`)
  process.exit(1)
}
if (!existsSync(join(repoRoot, 'apps', 'cli', 'lib', 'bin.js')) || !existsSync(join(repoRoot, 'apps', 'web', 'dist', 'index.html'))) {
  console.error('harness repo not built; run `pnpm run build` there first')
  process.exit(1)
}
rmSync(target, { recursive: true, force: true })
execFileSync('pnpm', ['--filter', '@deepseek-ai/dsh', 'deploy', '--legacy', target], {
  cwd: repoRoot,
  stdio: 'inherit',
})

// pnpm deploy already links workspace packages into its own virtual store
// (relative symlinks, deps resolvable as store siblings), so top-level links
// must be KEPT. The only gap: workspace peerDependencies that the root
// project's own closure does not declare are not linked at all, yet some
// packages import those peers statically. Link any missing @deepseek-ai peer
// into the same store (recurse through the added package's own edges).
const scopeDir = join(target, 'node_modules', '@deepseek-ai')
const storeScope = join(target, 'node_modules', '.pnpm', 'node_modules', '@deepseek-ai')
const repaired = new Set()
function materialize(name) {
  const bare = name.startsWith('@deepseek-ai/') ? name.slice('@deepseek-ai/'.length) : name
  if (repaired.has(bare)) return
  repaired.add(bare)
  const dest = join(scopeDir, bare)
  if (existsSync(dest) || lstatSync(dest, { throwIfNoEntry: false }) !== undefined) return
  const storeEntry = join(storeScope, bare)
  if (existsSync(storeEntry)) {
    symlinkSync(join('..', '.pnpm', 'node_modules', '@deepseek-ai', bare), dest, 'dir')
    console.log(`peer linked: ${bare}`)
  } else {
    // Not resolved into the deployed store: fall back to a bare copy from the
    // repo store. Only valid for packages whose own edges are all covered by
    // the deployed tree (checked by recursion below).
    const repoStoreEntry = join(repoRoot, 'node_modules', '.pnpm', 'node_modules', '@deepseek-ai', bare)
    if (!existsSync(repoStoreEntry)) return
    cpSync(realpathSync(repoStoreEntry), dest, { recursive: true })
    console.log(`peer copied: ${bare}`)
  }
  const pj = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'))
  for (const dep of [...Object.keys(pj.dependencies ?? {}), ...Object.keys(pj.peerDependencies ?? {})]) {
    if (dep.startsWith('@deepseek-ai/')) materialize(dep)
  }
}
// Scan every resolved @deepseek-ai package (top-level links plus the virtual
// store root), not just top-level ones: deep peers are imported from store
// paths and must be linkable from both resolution paths.
const candidates = new Set(readdirSync(scopeDir))
for (const entry of readdirSync(storeScope)) candidates.add(entry)
for (const entry of candidates) {
  const localPath = join(scopeDir, entry)
  const pjPath = join(existsSync(localPath) ? localPath : storeScope, 'package.json')
  if (!existsSync(pjPath)) continue
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
  for (const name of [...Object.keys(pj.dependencies ?? {}), ...Object.keys(pj.peerDependencies ?? {})]) {
    if (name.startsWith('@deepseek-ai/')) materialize(name)
  }
}
console.log(`backend deployed to ${target}`)
