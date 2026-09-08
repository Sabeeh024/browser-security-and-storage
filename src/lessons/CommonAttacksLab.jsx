import { useEffect, useRef, useState } from 'react'

/*
 * LESSON 6 — common attacks, briefly.
 * The "every dev should know" tail: things that aren't XSS/CSRF but bite
 * constantly. Each is a small demo + the one-line fix.
 *
 * Some demos need:  npm run server
 */
export default function CommonAttacksLab() {
  return (
    <article>
      <h2>Lesson 6 — Common attacks, briefly</h2>
      <OpenRedirect />
      <Tabnabbing />
      <PostMessageDemo />
      <PrototypePollution />
      <Reference />
      <Takeaways />
    </article>
  )
}

/* ---------------------------------------------------------------- */
function OpenRedirect() {
  const [to, setTo] = useState('https://evil.example/login')
  return (
    <section style={box}>
      <h3>1 · Open redirect</h3>
      <p style={hint}>
        A redirect endpoint that forwards to a user-supplied URL. The phishing
        link reads <code>https://<b>your-trusted-site</b>/redirect?to=…</code> —
        users (and email filters) see your domain, then land on the attacker's.
        Also used to smuggle past OAuth <code>redirect_uri</code> allowlists.
      </p>
      <input value={to} onChange={(e) => setTo(e.target.value)} style={{ width: '100%' }} />
      <div style={row}>
        <a href={`http://localhost:8787/redirect?to=${encodeURIComponent(to)}`} target="_blank" rel="noreferrer">
          /redirect (naive) ↗
        </a>
        <a href={`http://localhost:8787/safe-redirect?to=${encodeURIComponent(to)}`} target="_blank" rel="noreferrer">
          /safe-redirect (path allowlist) ↗
        </a>
      </div>
      <p style={hint}>
        Fix: never redirect to a raw external URL. Allow only relative paths
        (<code>startsWith('/') &amp;&amp; !startsWith('//')</code>), or map an
        opaque key → URL server-side, or check the host against an allowlist.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function Tabnabbing() {
  return (
    <section style={box}>
      <h3>2 · Reverse tabnabbing — <code>target="_blank"</code></h3>
      <p style={hint}>
        A page you open in a new tab gets a <code>window.opener</code> reference
        back to your tab and can navigate it — e.g. swap your original tab for a
        look-alike login while the user reads the new tab.
      </p>
      <div style={row}>
        <a href="http://localhost:8787/tabnab" target="_blank">
          open WITHOUT rel (vulnerable-ish) ↗
        </a>
        <a href="http://localhost:8787/tabnab" target="_blank" rel="noopener noreferrer">
          open WITH rel="noopener noreferrer" ✅ ↗
        </a>
      </div>
      <p style={hint}>
        The opened page reports whether it received <code>window.opener</code>.
        Modern browsers now imply <code>noopener</code> for <code>target="_blank"</code>{' '}
        (Chrome 88+, FF 79+, Safari 12.1+), so the first link is likely already
        safe — but <b>set <code>rel="noopener noreferrer"</code> explicitly</b>;
        don't rely on browser defaults, and older embedded webviews still leak.
        <code>noreferrer</code> also strips the <code>Referer</code>.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function PostMessageDemo() {
  const [guarded, setGuarded] = useState(true)
  const [received, setReceived] = useState([])
  const [balance, setBalance] = useState(1000)
  const guardedRef = useRef(guarded)
  guardedRef.current = guarded

  useEffect(() => {
    const onMsg = (e) => {
      const trusted = e.origin === window.location.origin
      const entry = { origin: e.origin, data: e.data, trusted }
      setReceived((r) => [entry, ...r].slice(0, 6))
      // The bug: acting on a message without checking e.origin.
      if (guardedRef.current && !trusted) return
      if (e.data && e.data.type === 'SET_BALANCE') setBalance(e.data.amount)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  return (
    <section style={box}>
      <h3>3 · <code>postMessage</code> without an origin check</h3>
      <p style={hint}>
        <code>window.addEventListener('message', …)</code> receives messages from
        <b> any</b> origin — other tabs, iframes, popups. If your handler acts on
        <code>event.data</code> without checking <code>event.origin</code>, any
        embedded/opener page can drive your app.
      </p>
      <label style={hint}>
        <input type="checkbox" checked={guarded} onChange={(e) => setGuarded(e.target.checked)} />
        {' '}check <code>event.origin === location.origin</code> before acting
      </label>
      <p style={{ fontSize: 18 }}>App balance: <b>${balance}</b></p>
      <iframe
        title="pm-frame"
        src="http://localhost:8787/pm-frame"
        style={{ width: '100%', height: 44, border: '1px solid #ccc', borderRadius: 4 }}
      />
      <p style={hint}>
        The iframe (origin <code>localhost:8787</code>, not ours) posts{' '}
        <code>{'{type:"SET_BALANCE", amount:0}'}</code>. Unchecked → balance
        drops to $0. Checked → message logged but ignored.
      </p>
      <pre style={pre}>{received.map((r) =>
        `${r.trusted ? '✓ same-origin' : '✗ ' + r.origin}  ${JSON.stringify(r.data)}`
      ).join('\n') || '(no messages yet)'}</pre>
      <p style={hint}>
        Also: when <i>sending</i>, pass an explicit target origin —{' '}
        <code>frame.postMessage(msg, 'https://known.example')</code>, never{' '}
        <code>'*'</code> for anything sensitive.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function PrototypePollution() {
  const [json, setJson] = useState('{"__proto__":{"polluted":"yes"}}')
  const [result, setResult] = useState('')

  // Deliberately vulnerable deep-merge (the shape of many real CVEs).
  const badMerge = (target, source) => {
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null) {
        target[key] = target[key] || {}
        badMerge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
    return target
  }

  const run = () => {
    try {
      const obj = {}
      badMerge(obj, JSON.parse(json))
      // did we manage to write onto Object.prototype?
      const leaked = ({}).polluted
      setResult(`({}).polluted  →  ${JSON.stringify(leaked)}\n${leaked ? '💥 Object.prototype was polluted — every object in the app now has this key' : 'no pollution'}`)
      delete Object.prototype.polluted // clean up the demo
    } catch (e) { setResult(String(e)) }
  }

  return (
    <section style={box}>
      <h3>4 · Prototype pollution</h3>
      <p style={hint}>
        Attacker-controlled keys like <code>__proto__</code> /{' '}
        <code>constructor.prototype</code> passed into a recursive merge / clone
        / <code>set(obj, path, val)</code> land on <code>Object.prototype</code>,
        affecting every object — leading to DoS, logic bypass, sometimes RCE
        (esp. server-side / SSR).
      </p>
      <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={2} style={{ width: '100%', fontFamily: 'monospace' }} />
      <div style={row}><button onClick={run}>merge into {'{}'}</button></div>
      <pre style={pre}>{result || '(not run)'}</pre>
      <p style={hint}>
        Fix: reject <code>__proto__</code> / <code>constructor</code> /{' '}
        <code>prototype</code> keys, use <code>Object.create(null)</code> or{' '}
        <code>Map</code> for lookup tables, <code>Object.freeze(Object.prototype)</code>,
        and prefer vetted libs (lodash ≥ 4.17.21). Node 20+ also has{' '}
        <code>--disable-proto</code>.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- */
function Reference() {
  return (
    <section style={box}>
      <h3>5 · Non-demo footguns worth knowing</h3>
      <table style={table}>
        <thead><tr><th style={th}>Issue</th><th style={th}>What it is</th><th style={th}>Fix</th></tr></thead>
        <tbody>
          <tr>
            <td style={td}>Secrets in the bundle</td>
            <td style={td}>Anything in <code>import.meta.env.VITE_*</code> or referenced client-side is shipped in plain text. `curl` the JS and grep.</td>
            <td style={td}>Only publishable keys client-side. Real secrets stay on the server / BFF. Add a CI grep for known secret patterns.</td>
          </tr>
          <tr>
            <td style={td}>Dependency / supply chain</td>
            <td style={td}>A transitive npm package ships malware or a vuln; a typo-squatted name; a compromised maintainer.</td>
            <td style={td}><code>npm audit</code> + <code>npm ci</code> from a committed lockfile in CI; pin/renovate; <code>--ignore-scripts</code>; Dependabot; SRI for CDN scripts.</td>
          </tr>
          <tr>
            <td style={td}>GET that mutates state</td>
            <td style={td}>An <code>&lt;img src="/logout"&gt;</code> or a prefetch fires it. (Called out back in Lesson 3.)</td>
            <td style={td}>Only POST/PUT/PATCH/DELETE change state; GET is safe/idempotent.</td>
          </tr>
          <tr>
            <td style={td}>Unvalidated file upload</td>
            <td style={td}>User uploads <code>x.html</code>/<code>x.svg</code>; served from your origin → stored XSS.</td>
            <td style={td}>Serve user files from a separate origin, force <code>Content-Disposition: attachment</code> + <code>nosniff</code>, validate type.</td>
          </tr>
          <tr>
            <td style={td}>Verbose errors / source maps</td>
            <td style={td}>Stack traces, internal paths, or prod source maps handed to attackers.</td>
            <td style={td}>Generic error pages; upload source maps to your error tracker, don't deploy them publicly.</td>
          </tr>
          <tr>
            <td style={td}>Rate limiting / enumeration</td>
            <td style={td}>Login, password-reset, OTP, "email exists?" endpoints brute-forced or enumerated.</td>
            <td style={td}>Per-IP + per-account throttling, generic responses, CAPTCHA on abuse, lockout with backoff.</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>Never redirect / <code>window.location =</code> to a raw user-supplied URL.</b> Allowlist paths or hosts.</li>
        <li><b><code>rel="noopener noreferrer"</code> on every <code>target="_blank"</code></b> — explicitly, not trusting browser defaults.</li>
        <li><b>Every <code>message</code> listener checks <code>event.origin</code></b> first; every <code>postMessage</code> send names an explicit target origin.</li>
        <li><b>Untrusted keys never reach a recursive merge/set</b> — filter <code>__proto__</code>/<code>constructor</code>/<code>prototype</code>, or use null-proto objects / <code>Map</code>.</li>
        <li><b>The client bundle is public.</b> No secret survives being referenced in front-end code.</li>
        <li><b><code>npm audit</code> + lockfile + <code>npm ci</code> in CI</b> — supply chain is now the most common way real apps get popped.</li>
      </ol>
    </section>
  )
}

const box = { border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }
const row = { display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'center', margin: '.5rem 0' }
const hint = { fontSize: 14, color: '#444' }
const pre = { background: '#111', color: '#0f0', padding: '.75rem', borderRadius: 6, overflowX: 'auto', fontSize: 12.5, whiteSpace: 'pre-wrap' }
const table = { borderCollapse: 'collapse', width: '100%', fontSize: 13 }
const th = { border: '1px solid #ccc', padding: '.4rem .6rem', background: '#eee', textAlign: 'left' }
const td = { border: '1px solid #ccc', padding: '.4rem .6rem', verticalAlign: 'top' }
