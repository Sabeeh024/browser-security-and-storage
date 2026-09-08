/*
 * Production-style static server for the built SPA (`dist/`).
 *
 *   npm run build && npm run serve:prod    → http://localhost:4173
 *
 * Shows what the real deploy should send: HTTPS-only (HSTS), a strict CSP that
 * Vite's *production* build satisfies with no nonces/hashes (it emits no inline
 * scripts — only the dev server does), and the baseline header set. A
 * `/csp-report` endpoint collects violation reports.
 *
 * In a real deploy these headers live at the edge (CDN / host config) — see
 * the `deploy/` folder for Netlify / Vercel / nginx versions of this same set.
 */
import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const PORT = 4173
const API_ORIGIN = 'http://localhost:8787' // your API domain in prod

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",                 // prod build has NO inline scripts
  "style-src 'self' 'unsafe-inline'",  // Vite injects a tiny inline <style>; swap for a hash to drop 'unsafe-inline'
  "img-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
  'report-uri /csp-report',
].join('; ')

const app = express()
app.use(express.json({ type: ['application/json', 'application/csp-report', 'application/reports+json'] }))

// let the dev-server lesson UI read these two endpoints
app.use(['/csp-report', '/_audit'], (req, res, next) => {
  res.set('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const cspReports = []
app.post('/csp-report', (req, res) => {
  cspReports.push({ at: new Date().toISOString(), body: req.body })
  console.log('CSP violation:', JSON.stringify(req.body))
  res.sendStatus(204)
})
app.get('/csp-report', (_req, res) => res.json(cspReports)) // for the lesson UI

app.get('/_audit', (_req, res) => res.json({ csp: CSP, headers: SECURITY_HEADERS }))

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

app.use((_req, res, next) => {
  res.set('Content-Security-Policy', CSP)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.set(k, v)
  next()
})

app.use(express.static(DIST, { setHeaders: (res, p) => {
  if (p.endsWith('.html')) res.set('Cache-Control', 'no-cache')
  else if (p.includes(`${'assets'}/`)) res.set('Cache-Control', 'public, max-age=31536000, immutable')
}}))
app.get('*', (_req, res) => res.sendFile(join(DIST, 'index.html'))) // SPA fallback

app.listen(PORT, () => console.log(`prod SPA on http://localhost:${PORT}  (CSP report-uri: /csp-report)`))
