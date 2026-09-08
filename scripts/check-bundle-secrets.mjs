/*
 * Fail the build if the client bundle looks like it contains a secret.
 * Runs in CI after `npm run build`.  node scripts/check-bundle-secrets.mjs
 *
 * This is a backstop, not a guarantee — the real rule is "never reference a
 * secret from front-end code". Anything in import.meta.env.VITE_* is public.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const patterns = [
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bsk_live_[0-9a-zA-Z]{16,}\b/, 'Stripe live secret key'],
  [/\bghp_[0-9A-Za-z]{36}\b/, 'GitHub personal access token'],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, 'private key'],
  [/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, 'Slack token'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT (could be a baked-in token)'],
]

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

let hits = 0
for (const file of walk(DIST)) {
  if (!/\.(js|css|html|map|json)$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const [re, label] of patterns) {
    const m = text.match(re)
    if (m) { console.error(`✗ ${file}: possible ${label} — "${m[0].slice(0, 12)}…"`); hits++ }
  }
}

if (hits) { console.error(`\n${hits} possible secret(s) in the bundle. Failing.`); process.exit(1) }
console.log('✓ no obvious secrets in dist/')
