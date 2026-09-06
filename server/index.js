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

/* --- CORS: only the real SPA may read responses with credentials --------- */
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && APP_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Credentials', 'true')
    res.set('Vary', 'Origin')
  }
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
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
