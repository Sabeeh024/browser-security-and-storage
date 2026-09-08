import { useEffect, useRef, useState } from 'react'
import { authApi } from '../shared/bankApi'

/*
 * LESSON 4 — Where do you keep the auth credential in the browser?
 *
 * Three approaches, same protected resource. The questions that decide it:
 *   - Can XSS STEAL the credential (exfiltrate for offline/later use)?
 *   - Can XSS USE the credential while the page is open? (almost always yes)
 *   - Does it survive a page reload without a fresh login?
 *   - Is it exposed to CSRF?
 *   - How much plumbing?
 *
 * Needs the demo server:  npm run server
 */

// Approach B keeps the access token HERE — a module variable, never in
// localStorage/sessionStorage. Gone on reload (that's the point).
let accessToken = null

export default function AuthTokenLab() {
  return (
    <article>
      <h2>Lesson 4 — Auth token storage</h2>
      <p style={hint}>
        Run <code>npm run server</code> first. Each panel logs in, reads{' '}
        <code>/…/data</code>, and has a <b>Run XSS payload</b> button that prints
        exactly what an injected script could exfiltrate.
      </p>

      <CookiePanel />
      <MemoryPanel />
      <BffPanel />

      <Comparison />
      <Takeaways />
    </article>
  )
}

/* ---------------------------------------------------------------- */
/* A — HttpOnly cookie session                                     */
/* ---------------------------------------------------------------- */
function CookiePanel() {
  const [out, setOut] = useState([])
  const log = (label, r) => setOut((l) => [`${label}: ${fmt(r)}`, ...l].slice(0, 6))

  return (
    <section style={box}>
      <h3>A · HttpOnly cookie session</h3>
      <p style={hint}>
        Server sets <code>sid</code> as <code>HttpOnly; SameSite; Secure</code>.
        The browser attaches it automatically; JS never touches it.
      </p>
      <div style={row}>
        <button onClick={async () => log('login', await authApi.cookieLogin())}>Login</button>
        <button onClick={async () => log('GET /me', await authApi.cookieData())}>Read protected data</button>
        <button onClick={() => window.location.reload()}>Reload page</button>
        <button style={evil} onClick={async () => {
          // what an XSS payload sees:
          const stolen = { 'document.cookie': document.cookie || '(empty — sid is HttpOnly)' }
          // ...but it can still USE the session while the page is open:
          const ride = await authApi.cookieData()
          log('XSS payload', { stolen, canStillCallApiAsUser: ride.status === 200 })
        }}>Run XSS payload</button>
      </div>
      <pre style={pre}>{out.join('\n') || '(no calls yet)'}</pre>
      <p style={hint}>
        ✅ Survives reload. ✅ Token can't be exfiltrated (HttpOnly). ✅ Simplest.
        {' '}❌ Exposed to CSRF → needs <code>SameSite</code> + token (Lesson 3).
        {' '}❌ XSS can still <i>ride</i> the cookie to act as the user in-page.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* B — in-memory access token + HttpOnly refresh cookie            */
/* ---------------------------------------------------------------- */
function MemoryPanel() {
  const [out, setOut] = useState([])
  const [status, setStatus] = useState('logged out')
  const timer = useRef(null)
  const log = (label, r) => setOut((l) => [`${label}: ${fmt(r)}`, ...l].slice(0, 6))

  // Silent refresh: on mount, try to get a fresh access token from the
  // HttpOnly refresh cookie. This is what "stay logged in after reload" costs.
  useEffect(() => {
    (async () => {
      const r = await authApi.refresh()
      if (r.status === 200) { accessToken = r.data.accessToken; setStatus('restored via refresh cookie'); schedule(r.data.expiresInMs) }
    })()
    return () => clearTimeout(timer.current)
  }, []) // eslint-disable-line

  const schedule = (ms) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const r = await authApi.refresh()
      if (r.status === 200) { accessToken = r.data.accessToken; setStatus('auto-refreshed'); schedule(r.data.expiresInMs) }
      else setStatus('refresh failed — login again')
    }, ms - 2000) // refresh 2s before expiry
  }

  return (
    <section style={box}>
      <h3>B · In-memory access token + refresh cookie</h3>
      <p style={hint}>
        Access token (15s TTL here) lives in a JS variable. Refresh token is an{' '}
        <code>HttpOnly</code> cookie scoped to <code>/auth/refresh</code>.
        Status: <b>{status}</b>. In-memory token now:{' '}
        <code>{accessToken ? accessToken.slice(0, 10) + '…' : 'null'}</code>
      </p>
      <div style={row}>
        <button onClick={async () => {
          const r = await authApi.login()
          if (r.status === 200) { accessToken = r.data.accessToken; setStatus('logged in'); schedule(r.data.expiresInMs) }
          log('login', r)
        }}>Login</button>
        <button onClick={async () => log('GET /auth/data', await authApi.data(accessToken))}>Read protected data</button>
        <button onClick={() => window.location.reload()}>Reload page</button>
        <button onClick={async () => { await authApi.logout(); accessToken = null; setStatus('logged out') }}>Logout</button>
        <button style={evil} onClick={() => {
          // XSS can read the variable directly and POST it somewhere for later use
          log('XSS payload', {
            stolenAccessToken: accessToken || '(none in memory)',
            note: 'exfiltrated — usable off-site until it expires (15s). Refresh cookie is HttpOnly, so long-term persistence is NOT stolen.',
          })
        }}>Run XSS payload</button>
      </div>
      <pre style={pre}>{out.join('\n') || '(no calls yet)'}</pre>
      <p style={hint}>
        ❌ XSS reads the variable and exfiltrates it (short window). ✅ Refresh
        token stays HttpOnly. ✅ <code>/auth/data</code> uses a header → CSRF-immune.
        {' '}❌ Reload needs a refresh round-trip (brief unauthenticated flash).
        {' '}❌ Most plumbing.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* C — Backend-for-Frontend (BFF)                                  */
/* ---------------------------------------------------------------- */
function BffPanel() {
  const [out, setOut] = useState([])
  const log = (label, r) => setOut((l) => [`${label}: ${fmt(r)}`, ...l].slice(0, 6))

  return (
    <section style={box}>
      <h3>C · Backend-for-Frontend (BFF)</h3>
      <p style={hint}>
        The BFF holds the real API token <b>server-side</b>. The browser gets
        only an opaque <code>bff_sid</code> HttpOnly cookie. The SPA calls the
        BFF; the BFF adds the token and calls the upstream API.
      </p>
      <div style={row}>
        <button onClick={async () => log('bff/login', await authApi.bffLogin())}>Login</button>
        <button onClick={async () => log('GET /bff/data', await authApi.bffData())}>Read protected data</button>
        <button onClick={() => window.location.reload()}>Reload page</button>
        <button style={evil} onClick={async () => {
          const ride = await authApi.bffData()
          log('XSS payload', {
            'document.cookie': document.cookie || '(empty — bff_sid is HttpOnly)',
            tokenInBrowser: 'none — never sent here',
            canStillCallBffAsUser: ride.status === 200,
          })
        }}>Run XSS payload</button>
      </div>
      <pre style={pre}>{out.join('\n') || '(no calls yet)'}</pre>
      <p style={hint}>
        ✅ No token in the browser at all. ✅ Survives reload. ✅ Upstream token
        rotation/refresh hidden server-side. ❌ Cookie → CSRF applies to the BFF.
        {' '}❌ XSS can still ride the session in-page. ❌ You now run a backend.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function Comparison() {
  const rows = [
    ['XSS can exfiltrate the credential', 'No', 'Yes (15s window)', 'No'],
    ['XSS can act as user while page open', 'Yes', 'Yes', 'Yes'],
    ['Survives reload w/o re-login', 'Yes', 'Via refresh call', 'Yes'],
    ['CSRF exposure', 'Yes → SameSite+token', 'No (header auth)', 'Yes → SameSite+token'],
    ['Long-lived secret in browser', 'No (HttpOnly)', 'No (refresh HttpOnly)', 'No'],
    ['Needs your own backend', 'A server, yes', 'A server, yes', 'Yes, a real BFF'],
    ['Plumbing', 'Minimal', 'Most', 'Medium (infra)'],
  ]
  return (
    <section style={box}>
      <h3>Side by side</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead><tr>{['', 'A · Cookie', 'B · In-memory + refresh', 'C · BFF'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r[0]}>{r.map((c, i) => <td key={i} style={i === 0 ? { ...td, fontWeight: 600 } : td}>{c}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>localStorage is not on this list.</b> A token there is stealable by any XSS with no time limit — strictly worse than every option above.</li>
        <li><b>No client storage stops XSS from acting as the user in-page.</b> "Can it be exfiltrated?" is the only thing storage choice changes. XSS prevention (Lesson 2) is the actual mitigation.</li>
        <li><b>Default for most apps: HttpOnly cookie session (A)</b> + <code>SameSite=Lax</code> + CSRF token. Least code, no long-lived secret in JS.</li>
        <li><b>In-memory + refresh (B)</b> when you need header-based auth (third-party API, mobile + web share a backend) and want CSRF immunity. Accept the reload refresh cost.</li>
        <li><b>BFF (C)</b> for OAuth/OIDC SPAs — keeps access/refresh tokens off the client entirely. Now the recommended pattern (OAuth 2.0 for Browser-Based Apps).</li>
        <li><b>Access tokens short, refresh tokens rotated,</b> logout invalidates server-side — regardless of approach.</li>
      </ol>
    </section>
  )
}

const fmt = (r) => `${r.status} ${JSON.stringify(r.data)}`
const box = { border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }
const row = { display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center', margin: '.5rem 0' }
const hint = { fontSize: 14, color: '#444' }
const evil = { borderColor: '#c00', color: '#c00' }
const pre = { background: '#111', color: '#0f0', padding: '.75rem', borderRadius: 6, overflowX: 'auto', fontSize: 12.5, whiteSpace: 'pre-wrap' }
const table = { borderCollapse: 'collapse', width: '100%', fontSize: 13 }
const th = { border: '1px solid #ccc', padding: '.4rem .6rem', background: '#eee', textAlign: 'left' }
const td = { border: '1px solid #ccc', padding: '.4rem .6rem', verticalAlign: 'top' }
