import { useCallback, useEffect, useState } from 'react'
import { bank } from '../shared/bankApi'

/*
 * LESSON 3 — CSRF (Cross-Site Request Forgery)
 *
 * CSRF abuses the one thing that makes cookies convenient: the browser attaches
 * them to EVERY request to their origin, no matter which site triggered it.
 * So evil.com can make your browser POST to bank.com/transfer *with your
 * bank.com session cookie attached* — and the server can't tell it wasn't you.
 *
 * Requires the demo server:   npm run server   (second terminal)
 *
 * Note: XSS beats every CSRF defense (it runs ON your origin, so Origin checks
 * pass and it can read the CSRF token). CSRF defenses assume you don't have XSS.
 */
export default function CsrfLab() {
  const [cfg, setCfg] = useState(null)
  const [session, setSession] = useState(null)
  const [log, setLog] = useState([])
  const [err, setErr] = useState('')

  const push = (label, r) => setLog((l) => [{ label, ...r, t: Date.now() }, ...l].slice(0, 12))

  const loadCfg = useCallback(async () => {
    try {
      const { data } = await bank.getConfig()
      setCfg(data)
      setErr('')
    } catch {
      setErr('Cannot reach the API. Run `npm run server` in a second terminal.')
    }
  }, [])
  useEffect(() => { loadCfg() }, [loadCfg])

  const refreshMe = async () => {
    const r = await bank.me()
    setSession(r.status === 200 ? r.data : null)
    push('GET /me', r)
  }

  const setToggle = async (patch) => {
    const { data } = await bank.setConfig(patch)
    setCfg(data)
  }

  if (err) return <article><h2>Lesson 3 — CSRF</h2><p style={{ color: '#c00' }}>{err}</p></article>
  if (!cfg) return <article><h2>Lesson 3 — CSRF</h2><p>loading…</p></article>

  return (
    <article>
      <h2>Lesson 3 — CSRF (Cross-Site Request Forgery)</h2>

      <section style={box}>
        <h3>Setup</h3>
        <ol style={hint}>
          <li>Run <code>npm run server</code> in a second terminal.</li>
          <li>Click <b>Login</b> — sets an <code>HttpOnly</code> <code>sid</code> cookie for <code>localhost:8787</code>.</li>
          <li>Open the attacker page: <a href="http://127.0.0.1:8787/evil" target="_blank" rel="noreferrer">http://127.0.0.1:8787/evil</a> (a different <i>site</i>).</li>
          <li>Come back, hit <b>Refresh balance</b>. Did the forged transfer go through?</li>
          <li>Flip the defenses below and repeat.</li>
        </ol>
        <div style={row}>
          <button onClick={async () => { const r = await bank.login(); setSession(r.data); push('POST /login', r) }}>
            Login
          </button>
          <button onClick={refreshMe}>Refresh balance</button>
          <button onClick={async () => push('legit /transfer (−500, with CSRF header)', await bank.transfer(500))}>
            Legit transfer −500
          </button>
          <button onClick={async () => push('SPA forgot CSRF header (−500)', await bank.transferNoCsrf(500))}>
            Transfer without CSRF header
          </button>
        </div>
        <p style={{ fontSize: 18 }}>
          Balance: <b>{session ? `$${session.balance}` : '(not logged in / no session)'}</b>
        </p>
      </section>

      <section style={box}>
        <h3>Defenses (toggle, then re-run the attack)</h3>
        <div style={row}>
          <label>
            <b>SameSite</b>{' '}
            <select value={cfg.sameSite} onChange={(e) => setToggle({ sameSite: e.target.value })}>
              <option>Lax</option><option>Strict</option><option>None</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={cfg.csrf} onChange={(e) => setToggle({ csrf: e.target.checked })} />
            {' '}<b>CSRF token</b> (double-submit)
          </label>
          <label>
            <input type="checkbox" checked={cfg.originCheck} onChange={(e) => setToggle({ originCheck: e.target.checked })} />
            {' '}<b>Origin/Referer check</b>
          </label>
        </div>
        <p style={hint}>
          Re-<b>Login</b> after changing SameSite (the flag is baked into the
          cookie at set-time). Then reload the attacker page.
        </p>
        <table style={table}>
          <thead><tr><th style={th}>Setting</th><th style={th}>Effect on the forged request</th></tr></thead>
          <tbody>
            <tr><td style={td}>SameSite=Lax (default)</td><td style={td}>Cross-site <b>POST</b> → cookie NOT sent. Top-level GET navigations still send it. Blocks most CSRF for free.</td></tr>
            <tr><td style={td}>SameSite=Strict</td><td style={td}>Cookie never sent from another site, even on GET. Safest; breaks "click a link from email and stay logged in".</td></tr>
            <tr><td style={td}>SameSite=None</td><td style={td}>Cookie always sent cross-site (needs Secure). You are now fully exposed — the token/Origin checks are all that's left.</td></tr>
            <tr><td style={td}>CSRF token</td><td style={td}>Attacker's site can't read your <code>csrfToken</code> cookie (that's the Same-Origin Policy), so it can't put the matching value in the header. Request rejected.</td></tr>
            <tr><td style={td}>Origin/Referer check</td><td style={td}>Forged request carries the attacker's <code>Origin</code> (or a cross-site <code>Referer</code>). Server rejects anything not on its allowlist.</td></tr>
          </tbody>
        </table>
      </section>

      <section style={box}>
        <h3>Request log</h3>
        <pre style={pre}>{log.length === 0 ? '(nothing yet)' : log.map(fmt).join('\n\n')}</pre>
      </section>

      <Takeaways />
    </article>
  )
}

const fmt = (e) =>
  `[${new Date(e.t).toLocaleTimeString()}] ${e.label}\n  → ${e.status} ${JSON.stringify(e.data)}`

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>CSRF only matters for cookie/ambient auth.</b> If you send the token in an <code>Authorization</code> header (Lesson 4), a cross-site page can't add that header — it's largely CSRF-immune. Trade-off: that token now lives where JS can reach it (XSS risk).</li>
        <li><b>Set <code>SameSite=Lax</code> (or Strict) on every auth cookie.</b> This is the single highest-leverage fix and it's a one-liner.</li>
        <li><b>Add a CSRF token for anything sensitive</b> — double-submit (stateless) or synchronizer (stored server-side). Defense in depth behind SameSite.</li>
        <li><b>Check <code>Origin</code> (fallback <code>Referer</code>) on state-changing requests.</b> Cheap, no token plumbing.</li>
        <li><b>CORS is not a CSRF defense.</b> It controls who can <i>read</i> a response, not whether the request is <i>sent</i>. The forged POST still hits your handler. (More in Lesson 5.)</li>
        <li><b>Only mutate on POST/PUT/DELETE, never GET.</b> A GET that changes state can be triggered by an <code>&lt;img&gt;</code>.</li>
      </ol>
    </section>
  )
}

const box = { border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }
const row = { display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center', margin: '.5rem 0' }
const hint = { fontSize: 14, color: '#444' }
const pre = { background: '#111', color: '#0f0', padding: '.75rem', borderRadius: 6, overflowX: 'auto', fontSize: 12.5, whiteSpace: 'pre-wrap' }
const table = { borderCollapse: 'collapse', width: '100%', fontSize: 13, marginTop: '.5rem' }
const th = { border: '1px solid #ccc', padding: '.4rem .6rem', background: '#eee', textAlign: 'left' }
const td = { border: '1px solid #ccc', padding: '.4rem .6rem', verticalAlign: 'top' }
