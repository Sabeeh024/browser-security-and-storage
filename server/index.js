/*
 * Tiny bank API for the CSRF lesson (and reused in Lessons 4–5).
 *
 *   API + legit app origin : http://localhost:8787   (this server)
 *   the SPA (Vite)          : http://localhost:5173
 *   the "attacker" page     : http://127.0.0.1:8787/evil
 *
 * localhost and 127.0.0.1 are treated by browsers as DIFFERENT SITES, so a
 * request from 127.0.0.1 -> localhost is genuinely cross-site — exactly the
 * condition SameSite cookies and CSRF tokens are meant to handle.
 *
 * Run:  npm run server        (in a second terminal, alongside `npm run dev`)
 */
import express from 'express'
import cookieParser from 'cookie-parser'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

const PORT = 8787
const SPA_ORIGIN = 'http://localhost:5173'
const APP_ORIGINS = [SPA_ORIGIN, `http://localhost:${PORT}`]

// in-memory "database"
const sessions = new Map() // sid -> { user, balance, csrfToken }
let config = { sameSite: 'Lax', csrf: true, originCheck: true }

const rand = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

/* ======================================================================
 * LESSON 5 — CORS playground + security response headers.
 * These routes get their OWN (deliberately mis-configurable) handling,
 * so they bypass the sane global CORS middleware below.
 * ==================================================================== */
let corsCfg = { mode: 'allowlist', credentials: true } // off | wildcard | reflect | allowlist
let hdrCfg = { securityHeaders: true, frameAncestors: "'none'" } // 'none' | 'self' | <origin>

app.use('/cors', (req, res, next) => {
  const origin = req.headers.origin
  res.set('Vary', 'Origin')
  if (corsCfg.mode === 'wildcard') {
    res.set('Access-Control-Allow-Origin', '*')
    // NB: browsers forbid '*' + credentials, so we can't also allow creds here
  } else if (corsCfg.mode === 'reflect' && origin) {
    res.set('Access-Control-Allow-Origin', origin) // <-- the dangerous misconfig
    if (corsCfg.credentials) res.set('Access-Control-Allow-Credentials', 'true')
  } else if (corsCfg.mode === 'allowlist' && APP_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    if (corsCfg.credentials) res.set('Access-Control-Allow-Credentials', 'true')
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/cors/config', (_req, res) => res.json(corsCfg))
app.post('/cors/config', (req, res) => { corsCfg = { ...corsCfg, ...req.body }; res.json(corsCfg) })
app.get('/cors/data', (req, res) =>
  res.json({ secret: 'cross-origin JSON payload', sawSessionCookie: !!req.cookies.sid }))

app.get('/headers/config', (_req, res) => res.json(hdrCfg))
app.post('/headers/config', (req, res) => { hdrCfg = { ...hdrCfg, ...req.body }; res.json(hdrCfg) })

// the page we try to iframe from the SPA to test frame-ancestors / XFO
app.get('/framed', (_req, res) => {
  // frameAncestors: "'none'" | "'self'" | "http://localhost:5173"
  const fa = hdrCfg.frameAncestors
  res.set('Content-Security-Policy', `frame-ancestors ${fa}`)
  if (fa === "'none'") res.set('X-Frame-Options', 'DENY')
  res.type('html').send(`<!doctype html><meta charset=utf-8>
    <body style="font:14px system-ui;background:#dfe;margin:0;display:grid;place-items:center;height:100vh">
    <div><b>/framed</b> loaded inside an iframe.<br>frame-ancestors = <code>${fa}</code></div>`)
})

// a probe page on the OTHER site (127.0.0.1) — genuinely cross-site
app.get('/cors-probe', (_req, res) => {
  res.type('html').send(`<!doctype html><meta charset=utf-8><title>CORS probe</title>
  <style>body{font:14px system-ui;max-width:640px;margin:2rem auto;padding:0 1rem}</style>
  <h1>CORS probe — I am http://127.0.0.1:8787 (a different site)</h1>
  <pre id=o>fetching http://localhost:8787/cors/data …</pre>
  <script>
    fetch('http://localhost:8787/cors/data', { credentials: 'include' })
      .then(async r => document.getElementById('o').textContent =
        'READ THE RESPONSE ✅ (server allowed this origin)\\n\\n' + JSON.stringify(await r.json(), null, 2))
      .catch(e => document.getElementById('o').textContent =
        'BLOCKED by CORS ✅ — request may have been sent, but JS cannot read the reply\\n\\n' + e)
  </script>`)
})

/* --- global security headers for everything else ------------------------ */
app.use((_req, res, next) => {
  if (hdrCfg.securityHeaders) {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.set('X-Frame-Options', 'DENY')
    res.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains') // no-op on http, shown for reference
  }
  next()
})

/* --- CORS: only the real SPA may read responses with credentials --------- */
app.use((req, res, next) => {
  if (req.path.startsWith('/cors')) return next() // Lesson 5 owns its CORS
  const origin = req.headers.origin
  if (origin && APP_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Vary', 'Origin')
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/config', (_req, res) => res.json(config))
app.post('/config', (req, res) => { config = { ...config, ...req.body }; res.json(config) })

app.post('/login', (_req, res) => {
  const sid = rand()
  const csrfToken = rand()
  sessions.set(sid, { user: 'alice', balance: 1000, csrfToken })

  // session cookie: HttpOnly (JS can't read it) + SameSite (the CSRF lever)
  res.cookie('sid', sid, {
    httpOnly: true,
    sameSite: config.sameSite,     // 'Lax' | 'Strict' | 'None'
    secure: config.sameSite === 'None', // browsers require Secure for None (localhost is exempt in Chrome)
    path: '/',
  })
  // double-submit CSRF token: NOT HttpOnly on purpose — the SPA must read it
  // and echo it back in a header. An attacker on another site can't read it.
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    sameSite: config.sameSite,
    secure: config.sameSite === 'None',
    path: '/',
  })
  res.json({ user: 'alice', balance: 1000 })
})

app.get('/me', (req, res) => {
  const s = sessions.get(req.cookies.sid)
  if (!s) return res.status(401).json({ error: 'no session — sid cookie not sent' })
  res.json({ user: s.user, balance: s.balance })
})

app.post('/transfer', (req, res) => {
  const s = sessions.get(req.cookies.sid)
  const checks = []

  // The cookie IS the ambient credential. If the browser attached it, we're
  // "authenticated" — that's the whole CSRF problem.
  if (!s) {
    return res.status(401).json({
      error: 'not authenticated: browser did not attach the sid cookie',
      hint: 'SameSite=Lax/Strict blocked the cross-site cookie — attack stopped here',
      checks,
    })
  }

  // Defense 1: Origin / Referer header check
  if (config.originCheck) {
    const src = req.headers.origin || req.headers.referer || ''
    const ok = APP_ORIGINS.some((o) => src.startsWith(o))
    checks.push({ name: 'Origin/Referer check', ok, saw: src || '(none)' })
    if (!ok) return res.status(403).json({ error: 'Origin check failed', checks })
  }

  // Defense 2: double-submit CSRF token (header must equal cookie must equal session)
  if (config.csrf) {
    const header = req.headers['x-csrf-token']
    const cookie = req.cookies.csrfToken
    const ok = !!header && header === cookie && header === s.csrfToken
    checks.push({ name: 'CSRF token (header == cookie)', ok, saw: header || '(none)' })
    if (!ok) return res.status(403).json({ error: 'CSRF token missing or mismatched', checks })
  }

  const amount = Number(req.body.amount) || 500
  s.balance -= amount
  res.json({ ok: true, transferred: amount, balance: s.balance, checks })
})

/* ======================================================================
 * LESSON 4 — three ways to hold an auth credential in the browser.
 * All three authenticate the same protected endpoint shapes below.
 * ==================================================================== */

const ACCESS_TTL_MS = 15_000        // deliberately tiny so you SEE it expire
const REFRESH_TTL_MS = 60 * 60_000

const accessTokens = new Map()  // token -> { user, exp }
const refreshTokens = new Map() // token -> { user, exp }
const bffSessions = new Map()   // bff_sid -> { user, upstreamAccessToken }

const mint = (store, user, ttl) => {
  const t = rand()
  store.set(t, { user, exp: Date.now() + ttl })
  return t
}
const verify = (store, t) => {
  const rec = store.get(t)
  if (!rec) return null
  if (Date.now() > rec.exp) { store.delete(t); return null }
  return rec
}

/* ---- Approach B: in-memory access token + HttpOnly refresh cookie ------ */
app.post('/auth/login', (_req, res) => {
  const user = 'alice'
  const refresh = mint(refreshTokens, user, REFRESH_TTL_MS)
  // refresh token: HttpOnly + Strict + path-scoped to the refresh endpoint only
  res.cookie('refresh', refresh, {
    httpOnly: true, sameSite: 'Strict', secure: false, path: '/auth/refresh',
  })
  // access token: returned in the BODY. The SPA keeps it in a JS variable.
  res.json({ user, accessToken: mint(accessTokens, user, ACCESS_TTL_MS), expiresInMs: ACCESS_TTL_MS })
})

app.post('/auth/refresh', (req, res) => {
  const rec = verify(refreshTokens, req.cookies.refresh)
  if (!rec) return res.status(401).json({ error: 'no/expired refresh cookie — full login needed' })
  // (production: rotate the refresh token here too)
  res.json({ user: rec.user, accessToken: mint(accessTokens, rec.user, ACCESS_TTL_MS), expiresInMs: ACCESS_TTL_MS })
})

app.get('/auth/data', (req, res) => {
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '')
  const rec = verify(accessTokens, bearer)
  if (!rec) return res.status(401).json({ error: 'missing/expired access token in Authorization header' })
  res.json({ secret: `${rec.user}'s protected data`, servedAt: new Date().toISOString() })
})

app.post('/auth/logout', (req, res) => {
  refreshTokens.delete(req.cookies.refresh)
  res.clearCookie('refresh', { path: '/auth/refresh' }).json({ ok: true })
})

/* ---- Approach C: BFF — token never reaches the browser at all --------- */
app.post('/bff/login', (_req, res) => {
  const user = 'alice'
  const bffSid = rand()
  // The BFF holds the real upstream token server-side, keyed by its own cookie.
  bffSessions.set(bffSid, { user, upstreamAccessToken: mint(accessTokens, user, REFRESH_TTL_MS) })
  res.cookie('bff_sid', bffSid, {
    httpOnly: true, sameSite: 'Lax', secure: false, path: '/bff',
  })
  res.json({ user }) // <-- no token in the response
})

app.get('/bff/data', (req, res) => {
  const sess = bffSessions.get(req.cookies.bff_sid)
  if (!sess) return res.status(401).json({ error: 'no BFF session cookie' })
  // BFF attaches the token and calls the upstream API on the user's behalf.
  const rec = verify(accessTokens, sess.upstreamAccessToken)
  if (!rec) return res.status(502).json({ error: 'upstream token expired (BFF would refresh here)' })
  res.json({ secret: `${sess.user}'s protected data (via BFF)`, servedAt: new Date().toISOString() })
})

app.post('/bff/logout', (req, res) => {
  bffSessions.delete(req.cookies.bff_sid)
  res.clearCookie('bff_sid', { path: '/bff' }).json({ ok: true })
})

/* --- the attacker's page. Open at http://127.0.0.1:8787/evil ------------- */
app.get('/evil', (_req, res) => {
  res.type('html').send(`<!doctype html>
<meta charset=utf-8><title>Cutest Puppies 2026</title>
<style>body{font:16px system-ui;max-width:640px;margin:3rem auto;padding:0 1rem}</style>
<h1>🐶 Cutest Puppies 2026</h1>
<p>Just some innocent puppy pictures. Nothing else going on here. Honest.</p>
<pre id=log>running…</pre>

<!-- Attack A: auto-submitting cross-site form. Not subject to CORS at all. -->
<form id="a" action="http://localhost:8787/transfer" method="POST" target="sink">
  <input type="hidden" name="amount" value="500">
</form>
<iframe name="sink" style="display:none"></iframe>

<script>
  const log = document.getElementById('log')
  const line = (s) => log.textContent += '\\n' + s

  // Attack A — hidden form POST with the victim's cookies riding along
  line('Attack A: submitting hidden cross-site form to /transfer …')
  document.getElementById('a').submit()

  // Attack B — fetch with credentials. The REQUEST is sent (cookies attached
  // if SameSite allows); CORS only stops the attacker from READING the reply.
  line('Attack B: fetch() with credentials:"include" …')
  fetch('http://localhost:8787/transfer', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 500 }),
  }).then(r => line('Attack B: response status ' + r.status + ' (opaque to attacker)'))
    .catch(e => line('Attack B: blocked by CORS before send? ' + e))
</script>`)
})

app.listen(PORT, () => {
  console.log(`bank API on http://localhost:${PORT}`)
  console.log(`attacker page on http://127.0.0.1:${PORT}/evil`)
})
