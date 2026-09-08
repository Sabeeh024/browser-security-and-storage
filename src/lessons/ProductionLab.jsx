import { useState } from 'react'

/*
 * LESSON 7 — production practices (the capstone).
 * Where every "set this header / flag / check" from topics 1–6 actually lives.
 *
 * Optional live bits need the prod server:
 *   npm run build && npm run serve:prod        (http://localhost:4173)
 */
const PROD = 'http://localhost:4173'

export default function ProductionLab() {
  return (
    <article>
      <h2>Lesson 7 — Production practices</h2>
      <ViteAndCsp />
      <HeaderAudit />
      <CspReporting />
      <Checklist />
      <Takeaways />
    </article>
  )
}

/* ---------------------------------------------------------------- */
function ViteAndCsp() {
  return (
    <section style={box}>
      <h3>1 · CSP with Vite — the dev/prod split</h3>
      <p style={hint}>
        The <b>production</b> build (<code>npm run build</code>) emits{' '}
        <b>no inline scripts</b> — just hashed <code>&lt;script type="module"
        src&gt;</code> files. So a strict <code>script-src 'self'</code> works
        with <b>no nonces or hashes</b>. The Vite <b>dev server</b> is the only
        part that injects inline scripts (HMR client), which is why you can't
        run the same strict CSP in dev.
      </p>
      <pre style={pre}>{`dist/index.html  (nothing inline — CSP-clean):
  <script type="module" crossorigin src="/assets/index-[hash].js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-[hash].css">

# one small exception: Vite may inline a tiny <style>. Options:
#  - keep style-src 'unsafe-inline'  (low risk for style, common)
#  - or add the style hash to style-src
#  - or a build plugin that extracts it`}</pre>
      <p style={hint}>
        Don't hand-maintain script hashes for an SPA. If you have genuine inline
        scripts (analytics snippets), use a <b>per-response nonce</b> injected by
        your server/edge, not static hashes.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
const EXPECTED = [
  'Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options',
  'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy',
  'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy',
]

function HeaderAudit() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  const run = async () => {
    try {
      const r = await fetch(`${PROD}/_audit`)
      setData(await r.json()); setErr('')
    } catch {
      setErr('Start the prod server:  npm run build && npm run serve:prod')
    }
  }

  return (
    <section style={box}>
      <h3>2 · Audit what the deploy actually sends</h3>
      <p style={hint}>
        Reads <code>{PROD}/_audit</code> (mirrors what <code>server/prod.js</code>{' '}
        sets on every response). In real life: <code>curl -I https://yoursite</code>,
        securityheaders.com, or Mozilla Observatory in CI.
      </p>
      <div style={row}><button onClick={run}>run audit</button></div>
      {err && <p style={{ color: '#c00' }}>{err}</p>}
      {data && (
        <>
          <table style={table}>
            <tbody>
              {EXPECTED.map((h) => {
                const present = h === 'Content-Security-Policy'
                  ? !!data.csp
                  : Object.keys(data.headers).some((k) => k.toLowerCase() === h.toLowerCase())
                return (
                  <tr key={h}>
                    <td style={td}>{present ? '✅' : '❌'}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{h}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {h === 'Content-Security-Policy' ? data.csp : data.headers[h] ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={hint}>CSP directives, one per line:</p>
          <pre style={pre}>{data.csp.split('; ').join('\n')}</pre>
        </>
      )}
    </section>
  )
}

/* ---------------------------------------------------------------- */
function CspReporting() {
  const [reports, setReports] = useState(null)
  const [msg, setMsg] = useState('')

  const sample = {
    'csp-report': {
      'document-uri': 'https://app.example.com/',
      'violated-directive': "script-src 'self'",
      'blocked-uri': 'https://evil.cdn.example/x.js',
      'source-file': 'https://app.example.com/',
      'line-number': 1,
    },
  }

  const send = async () => {
    try {
      await fetch(`${PROD}/csp-report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample),
      })
      const r = await fetch(`${PROD}/csp-report`)
      setReports(await r.json()); setMsg('')
    } catch {
      setMsg('Start the prod server:  npm run build && npm run serve:prod')
    }
  }

  return (
    <section style={box}>
      <h3>3 · CSP reporting pipeline</h3>
      <p style={hint}>
        Roll CSP out as <code>Content-Security-Policy-Report-Only</code> first:
        the browser <i>reports</i> violations to your <code>report-uri</code> /{' '}
        <code>report-to</code> endpoint without blocking anything. Watch the
        stream, fix the legit sources, tighten, then switch to the enforcing
        header. Expect noise from browser extensions — filter by{' '}
        <code>blocked-uri</code>.
      </p>
      <div style={row}><button onClick={send}>POST a sample violation → then GET the log</button></div>
      {msg && <p style={{ color: '#c00' }}>{msg}</p>}
      {reports && <pre style={pre}>{JSON.stringify(reports, null, 2)}</pre>}
      <p style={hint}>
        <code>server/prod.js</code> has a minimal <code>/csp-report</code>{' '}
        collector. In production, send reports to a dedicated service (Sentry,
        report-uri.com, or your log pipeline) — they get spammy.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function Checklist() {
  const groups = [
    ['Transport', [
      ['HTTPS everywhere; HTTP → HTTPS redirect', '7'],
      ['HSTS with a long max-age (+ preload once confident)', '5 / 7'],
    ]],
    ['Response headers (at the edge, on every response)', [
      ['CSP — enforce after a Report-Only period', '2 / 5 / 7'],
      ['frame-ancestors \'none\' + X-Frame-Options: DENY', '5'],
      ['X-Content-Type-Options: nosniff', '5'],
      ['Referrer-Policy, Permissions-Policy, COOP, CORP', '5'],
    ]],
    ['Auth & sessions', [
      ['Session in an HttpOnly + Secure + SameSite cookie, or BFF', '1 / 4'],
      ['CSRF token on state-changing endpoints; check Origin', '3'],
      ['Short access-token TTL, refresh rotation, server-side logout', '4'],
      ['No tokens or PII in localStorage / sessionStorage', '1 / 4'],
    ]],
    ['App code', [
      ['No dangerouslySetInnerHTML / innerHTML on untrusted data; DOMPurify if unavoidable', '2'],
      ['Allowlist URL schemes and redirect targets', '2 / 6'],
      ['Every postMessage listener checks event.origin', '6'],
      ['Untrusted keys never hit a recursive merge/set', '6'],
      ['State changes only on POST/PUT/PATCH/DELETE', '3 / 6'],
    ]],
    ['CORS', [
      ['Allowlist origins; never reflect Origin + Allow-Credentials', '5'],
      ['ACAO: * only on genuinely public endpoints', '5'],
    ]],
    ['Supply chain & CI', [
      ['npm ci from a committed lockfile', '6 / 7'],
      ['npm audit (fail on high) in CI', '6 / 7'],
      ['Secret-scan the built bundle; Dependabot/Renovate on', '6 / 7'],
      ['No secret referenced in front-end code / VITE_* env', '6 / 7'],
      ['Source maps to the error tracker, not the public deploy', '6'],
    ]],
    ['Ops', [
      ['Rate-limit auth / OTP / reset; generic responses', '6'],
      ['User-uploaded files served from a separate origin', '6'],
      ['Generic error pages; no stack traces to clients', '6'],
    ]],
  ]
  return (
    <section style={box}>
      <h3>4 · Pre-ship checklist</h3>
      {groups.map(([title, items]) => (
        <div key={title} style={{ marginBottom: '.8rem' }}>
          <b style={{ fontSize: 14 }}>{title}</b>
          <ul style={{ margin: '.3rem 0' }}>
            {items.map(([text, topic]) => (
              <li key={text} style={{ fontSize: 13 }}>
                {text} <span style={{ color: '#999' }}>— topic {topic}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>Headers belong at the edge</b> (CDN / host / reverse proxy), applied to every response, versioned in the repo (<code>deploy/</code>) and checked in CI so they can't silently regress.</li>
        <li><b>Vite's prod build is CSP-friendly out of the box.</b> Strict <code>script-src 'self'</code> just works; only the dev server needs the loose policy.</li>
        <li><b>Ship CSP in Report-Only first.</b> Enforcing a wrong CSP breaks your app; reporting a wrong one just makes noise.</li>
        <li><b>Supply chain is the likeliest way you actually get popped</b> now — lockfile + <code>npm ci</code> + <code>npm audit</code> + bounded, reviewed updates.</li>
        <li><b>The client is a hostile environment.</b> Every check that matters is re-done on the server; the browser-side controls are defense in depth and UX.</li>
        <li><b>Minimum viable secure setup</b>: HTTPS+HSTS, the header set, HttpOnly+SameSite session cookie + CSRF token, React default escaping, allowlisted CORS, `npm ci`+audit in CI. Add BFF / separate upload origin / WAF / rate-limit tuning as you grow.</li>
      </ol>
    </section>
  )
}

const box = { border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }
const row = { display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center', margin: '.5rem 0' }
const hint = { fontSize: 14, color: '#444' }
const pre = { background: '#111', color: '#0f0', padding: '.75rem', borderRadius: 6, overflowX: 'auto', fontSize: 12, whiteSpace: 'pre-wrap' }
const table = { borderCollapse: 'collapse', width: '100%', fontSize: 13, marginTop: '.5rem' }
const td = { border: '1px solid #ccc', padding: '.4rem .6rem', verticalAlign: 'top' }
