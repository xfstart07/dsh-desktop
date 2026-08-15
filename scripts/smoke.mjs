// Smoke: boot the deployed backend under a given node binary, wait for the
// readiness line, probe the served page for the __DSH_BOOT__ manifest, then
// SIGTERM and expect a clean exit.
// Usage: node scripts/smoke.mjs <node-binary> [extra-args...]
import { spawn } from 'node:child_process'
import { argv } from 'node:process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const [nodeBin, ...extra] = argv.slice(2)
const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend', 'lib', 'bin.js')
const child = spawn(nodeBin, ['--expose-internals', bin, 'web', '--port', '0', ...extra], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let out = ''
let done = false
const timer = setTimeout(() => { console.error('SMOKE TIMEOUT'); child.kill('SIGKILL'); process.exit(1) }, 90_000)
child.stdout.on('data', (d) => {
  out += d
  process.stdout.write(d)
  const m = out.match(/dsh web: (https?:\/\/\S+)/)
  if (m && !done) {
    done = true
    void (async () => {
      try {
        const res = await fetch(m[1])
        const html = await res.text()
        console.log(`PROBE GET / -> ${res.status}, __DSH_BOOT__ injected: ${html.includes('__DSH_BOOT__')}`)
      } catch (err) {
        console.error('PROBE FAILED', err)
        child.kill('SIGKILL')
        process.exit(1)
      }
      child.kill('SIGTERM')
    })()
  }
})
child.stderr.on('data', (d) => process.stderr.write(d))
child.on('exit', (code, signal) => {
  clearTimeout(timer)
  console.log(`SMOKE backend exited code=${code} signal=${signal}`)
  process.exit(code === 0 || signal === 'SIGTERM' ? 0 : 1)
})
