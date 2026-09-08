import { useCallback, useEffect, useState } from 'react'
import { headersApi, PROBE_BASE } from '../shared/bankApi'

/*
 * LESSON 5 — CORS + security response headers
 *
 * Two things devs constantly conflate:
 *   - Same-Origin Policy (SOP): the browser's default — script on site A can
 *     SEND requests to site B but can't READ cross-origin responses.
 *   - CORS: site B's way to OPT IN to letting specific origins read its
 *     responses. CORS only ever *loosens* SOP. It is not a server-side access
 *     control and it does not stop requests from being sent (see Lesson 3).
 *
 * Needs the demo server:  npm run server
 */
export default function HeadersCorsLab() {
  return (
    <article>
      <h2>Lesson 5 — Security headers &amp; CORS</h2>
      <CorsPlayground />
      <FrameAncestors />
      <HeaderCatalogue />
      <Takeaways />
    </article>
  )
}

/* ---------------------------------------------------------------- */
function CorsPlayground() {
  const [cfg, setCfg] = useState(null)
  const [result, setResult] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setCfg((await headersApi.getCorsCfg()).data); setErr('') }
    catch { setErr('Start the server: npm run server') }
  }, [])
  useEffect(() => { load() }, [load])

  const sameOriginFetch = async () => {
    try {
      const r = await headersApi.corsData()
      setResult(`SPA origin (localhost:5173) → READ OK\n${JSON.stringify(r.data, null, 2)}`)
    } catch (e) {
      setResult(`SPA origin → BLOCKED\n${e}`)
    }
  }

  if (err) return <section style={box}><h3>CORS playground</h3><p style={{ color: '#c00' }}>{err}</p></section>
  if (!cfg) return <section style={box}><h3>CORS playground</h3><p>loading…</p></section>

  return (
    <section style={box}>
      <h3>1 · CORS playground</h3>
      <p style={hint}>
        The endpoint <code>GET /cors/data</code> returns JSON. Change how its
        server sends <code>Access-Control-Allow-Origin</code>, then try to read
        it from (a) this SPA and (b) a genuinely different site.
      </p>
      <div style={row}>
        <label><b>ACAO mode</b>{' '}
          <select value={cfg.mode} onChange={(e) => headersApi.setCorsCfg({ mode: e.target.value }).then((r) => setCfg(r.data))}>
            <option value="off">off — send no ACAO</option>
            <option value="wildcard">wildcard — ACAO: *</option>
            <option value="reflect">reflect — echo any Origin ⚠️</option>
            <option value="allowlist">allowlist — only known origins ✅</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={cfg.credentials}
            onChange={(e) => headersApi.setCorsCfg({ credentials: e.target.checked }).then((r) => setCfg(r.data))} />
          {' '}Allow-Credentials
        </label>
      </div>
      <div style={row}>
        <button onClick={sameOriginFetch}>fetch from this SPA</button>
        <button onClick={() => window.open(`${PROBE_BASE}/cors-probe`, '_blank')}>
          open cross-site probe (127.0.0.1) ↗
        </button>
      </div>
      <pre style={pre}>{result || '(no fetch yet)'}</pre>
      <table style={table}>
        <thead><tr><th style={th}>Mode</th><th style={th}>What it means</th></tr></thead>
        <tbody>
          <tr><td style={td}>off</td><td style={td}>Default SOP. Cross-origin JS can't read the response. Same-origin still works.</td></tr>
          <tr><td style={td}><code>ACAO: *</code></td><td style={td}>Any site can read it — fine for <b>public</b> data. Browser <b>forbids</b> <code>*</code> together with credentials.</td></tr>
          <tr><td style={td}>reflect Origin ⚠️</td><td style={td}>Server echoes whatever <code>Origin</code> it got + <code>Allow-Credentials: true</code> = <b>every site can read authenticated responses</b>. Classic account-takeover bug.</td></tr>
          <tr><td style={td}>allowlist ✅</td><td style={td}>Compare <code>Origin</code> against a fixed set; echo only on match. The correct pattern.</td></tr>
        </tbody>
      </table>
      <p style={hint}>
        Preflight: non-simple requests (custom headers, <code>PUT</code>, JSON
        with some content-types) send an <code>OPTIONS</code> first; the browser
        blocks the real request unless the preflight is answered correctly.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function FrameAncestors() {
  const [fa, setFa] = useState("'none'")
  const [nonce, setNonce] = useState(0)

  const apply = async (v) => {
    setFa(v)
    await headersApi.setHdrCfg({ frameAncestors: v })
    setNonce((n) => n + 1) // force iframe reload
  }

  return (
    <section style={box}>
      <h3>2 · Clickjacking defense — <code>frame-ancestors</code> / <code>X-Frame-Options</code></h3>
      <p style={hint}>
        Clickjacking = your real page loaded in a transparent iframe on an
        attacker's site, so the victim's clicks land on your UI. Defense: tell
        the browser who may frame you. We iframe <code>/framed</code> below with
        different policies.
      </p>
      <div style={row}>
        <button onClick={() => apply("'none'")}>frame-ancestors 'none'</button>
        <button onClick={() => apply("'self'")}>'self' (its own origin only)</button>
        <button onClick={() => apply('http://localhost:5173')}>allow this SPA</button>
      </div>
      <p style={hint}>Current: <code>frame-ancestors {fa}</code></p>
      <iframe
        key={nonce}
        title="framed"
        src={`http://localhost:8787/framed?x=${nonce}`}
        style={{ width: '100%', height: 90, border: '2px dashed #999', borderRadius: 6 }}
      />
      <p style={hint}>
        <code>'none'</code> and <code>'self'</code> → the iframe is blank (browser
        refused, check console). <code>allow this SPA</code> → it renders.
        <code>X-Frame-Options: DENY</code> is the older header with the same
        effect; send both for old-browser coverage.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function HeaderCatalogue() {
  const rows = [
    ['Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
      'Allowlist for what can load/run. Biggest single XSS mitigation. Roll out with Report-Only first.'],
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload',
      'Force HTTPS for future visits — kills SSL-strip downgrade. HTTPS only; irreversible for max-age duration.'],
    ['X-Content-Type-Options', 'nosniff',
      'Stop the browser guessing MIME types (e.g. treating an uploaded .txt as JS). Always set it.'],
    ['X-Frame-Options', 'DENY',
      'Legacy anti-clickjacking. Superseded by CSP frame-ancestors; still send for old browsers.'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin',
      'Trim the Referer header cross-site so URLs/paths (and tokens in them) do not leak.'],
    ['Permissions-Policy', 'geolocation=(), camera=(), microphone=()',
      'Turn off powerful APIs you never use, for you and any embedded frames.'],
    ['Cross-Origin-Opener-Policy', 'same-origin',
      'Isolate your window from cross-origin openers/popups; needed for some isolation features + Spectre hardening.'],
    ['Cross-Origin-Resource-Policy', 'same-origin',
      'Stop other sites embedding your resources (images, JSON) as no-cors loads.'],
  ]
  return (
    <section style={box}>
      <h3>3 · The response-header checklist</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead><tr><th style={th}>Header</th><th style={th}>Reasonable value</th><th style={th}>Why / caveat</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r[0]}>
              <td style={{ ...td, whiteSpace: 'nowrap' }}><code>{r[0]}</code></td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r[1]}</td>
              <td style={td}>{r[2]}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p style={hint}>
        Set these at the edge (CDN / reverse proxy / host config) so they cover
        every response including static files and error pages. Verify with{' '}
        <code>curl -I https://yoursite</code> or securityheaders.com.
        Wiring them through Vite/host is Lesson 7.
      </p>
    </section>
  )
}

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>SOP is the default; CORS only loosens it.</b> CORS controls who can <i>read</i> a response, never whether a request is <i>sent</i> or what the server does with it.</li>
        <li><b>Never reflect <code>Origin</code> blindly with <code>Allow-Credentials: true</code>.</b> Allowlist. This is the most common serious CORS bug.</li>
        <li><b><code>ACAO: *</code> is fine for genuinely public endpoints</b> and can't be combined with credentials anyway.</li>
        <li><b>CSP is the highest-value header</b> — <code>frame-ancestors</code> (clickjacking), <code>script-src</code> (XSS), <code>connect-src</code> (exfil). Deploy Report-Only, watch reports, then enforce.</li>
        <li><b>Baseline set for every app:</b> HSTS, <code>nosniff</code>, <code>frame-ancestors 'none'</code> (+ XFO), <code>Referrer-Policy</code>, <code>Permissions-Policy</code>.</li>
        <li><b>Headers belong at the edge</b>, applied to all responses, and checked in CI so they can't silently regress.</li>
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
