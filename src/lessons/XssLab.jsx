import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'

/*
 * LESSON 2 — XSS (Cross-Site Scripting)
 *
 * XSS = attacker gets THEIR JavaScript to run in YOUR page's origin.
 * Once it runs, it has everything the page has: cookies (non-HttpOnly),
 * localStorage, the DOM, the user's session, the ability to make requests
 * as the user. This is why Lesson 1 said "never put a token in localStorage".
 *
 * Three delivery routes (the payload is the same; how it arrives differs):
 *   - Reflected : payload is in the request (URL/query), echoed straight back
 *   - Stored    : payload is saved server-side, served to every later visitor
 *   - DOM-based  : no server involved — client JS takes attacker input and
 *                  feeds it to a sink (innerHTML, eval, document.write, ...)
 *
 * The fix is always the same shape: treat data as data, never as markup/code.
 */

const STEAL_PAYLOAD = `<img src=x onerror="alert('XSS — I can now read: ' + JSON.stringify(localStorage))">`

export default function XssLab() {
  return (
    <article>
      <h2>Lesson 2 — XSS (Cross-Site Scripting)</h2>
      <p>
        Set a value in the Lesson 1 localStorage demo first (e.g.{' '}
        <code>token = secret123</code>). Then watch these demos read it.
      </p>

      <ReactEscapingDemo />
      <DangerousHtmlDemo />
      <DomSinkDemo />
      <HrefInjectionDemo />
      <SanitizeDemo />
      <CspNote />
      <Takeaways />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* React auto-escaping — the reason most React apps aren't full of XSS */
/* ------------------------------------------------------------------ */
function ReactEscapingDemo() {
  const [input, setInput] = useState(STEAL_PAYLOAD)
  return (
    <section style={box}>
      <h3>1. React escapes <code>{'{expressions}'}</code> by default ✅</h3>
      <p style={hint}>
        Anything you interpolate as <code>{'{value}'}</code> in JSX is inserted as
        <b> text</b>, not parsed as HTML. The tags below show up as literal
        characters — nothing executes.
      </p>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} style={ta} />
      <p><b>Rendered as <code>{'{input}'}</code>:</b></p>
      <div style={out}>{input}</div>
      <p style={hint}>
        This is the whole reason "React is XSS-safe by default" — but only for
        this path. The next three demos are the ways you opt back out of it.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* dangerouslySetInnerHTML — the #1 React XSS hole                     */
/* ------------------------------------------------------------------ */
function DangerousHtmlDemo() {
  const [html, setHtml] = useState(STEAL_PAYLOAD)
  const [armed, setArmed] = useState(false)
  return (
    <section style={{ ...box, borderColor: '#c00' }}>
      <h3>2. <code>dangerouslySetInnerHTML</code> — XSS hole ❌</h3>
      <p style={hint}>
        This prop takes your string and sets <code>.innerHTML</code> with it.
        The <code>&lt;img onerror&gt;</code> payload fires because the browser
        parses it as real markup. Note a bare <code>&lt;script&gt;</code> tag
        does <i>not</i> run via innerHTML — attackers use event handlers
        (<code>onerror</code>, <code>onload</code>) or <code>javascript:</code> URLs instead.
      </p>
      <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={3} style={ta} />
      <label style={hint}>
        <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} />
        {' '}I understand this will run the payload — render it
      </label>
      {armed && (
        <div style={out} dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <p style={hint}>
        Real-world source of the string: a CMS field, a "rich" comment, a
        markdown-to-HTML conversion, an API you don't control.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* DOM-based: plain innerHTML outside React                           */
/* ------------------------------------------------------------------ */
function DomSinkDemo() {
  const ref = useRef(null)
  const [input, setInput] = useState(STEAL_PAYLOAD)
  const [armed, setArmed] = useState(false)

  const runInnerHtml = () => { if (ref.current) ref.current.innerHTML = input }
  const runTextContent = () => { if (ref.current) ref.current.textContent = input }

  return (
    <section style={box}>
      <h3>3. DOM sinks — <code>el.innerHTML =</code> ❌ vs <code>.textContent =</code> ✅</h3>
      <p style={hint}>
        DOM-based XSS never touches your server. Client code takes input
        (from <code>location.hash</code>, <code>postMessage</code>, a fetch
        response) and writes it to a <b>sink</b>. <code>innerHTML</code>,{' '}
        <code>outerHTML</code>, <code>insertAdjacentHTML</code>,{' '}
        <code>document.write</code>, <code>eval</code>,{' '}
        <code>new Function</code> are the classic ones.
      </p>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} style={ta} />
      <label style={hint}>
        <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} />
        {' '}arm the dangerous button
      </label>
      <div style={row}>
        <button disabled={!armed} onClick={runInnerHtml}>el.innerHTML = input ❌</button>
        <button onClick={runTextContent}>el.textContent = input ✅</button>
      </div>
      <div ref={ref} style={out} />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* href / javascript: URLs — an injection vector people forget        */
/* ------------------------------------------------------------------ */
function HrefInjectionDemo() {
  const [url, setUrl] = useState("javascript:alert('href XSS: ' + document.domain)")
  const safe = /^(https?:|mailto:|\/|#)/i.test(url.trim())
  return (
    <section style={box}>
      <h3>4. <code>javascript:</code> URLs in <code>href</code> / <code>src</code></h3>
      <p style={hint}>
        React blocks <code>javascript:</code> in <code>href</code> since v16.9
        (warns) / fully in v18+... actually it only <i>warns</i> — it still
        renders. So validate the scheme yourself: allow only{' '}
        <code>http(s):</code>, <code>mailto:</code>, or relative URLs.
      </p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: '100%' }} />
      <p>
        Unchecked: <a href={url}>click me</a>{' '}
        {!safe && <b style={{ color: '#c00' }}>← scheme rejected by allowlist</b>}
      </p>
      <p style={hint}>
        Guarded: <a href={safe ? url : '#'}>{safe ? 'click me' : '(link disabled)'}</a>
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* DOMPurify — when you genuinely must render user HTML               */
/* ------------------------------------------------------------------ */
function SanitizeDemo() {
  const [html, setHtml] = useState(
    `<p>Legit <b>bold</b> and <a href="https://example.com">a link</a>.</p>` +
    `<img src=x onerror="alert('stolen: '+localStorage.token)">` +
    `<script>alert('nope')</script>`
  )
  const clean = DOMPurify.sanitize(html)
  return (
    <section style={{ ...box, borderColor: '#0a0' }}>
      <h3>5. DOMPurify — sanitise, don't trust ✅</h3>
      <p style={hint}>
        If the product requires rendering user/CMS HTML, run it through a
        maintained sanitiser <b>every render</b> (it strips scripts, event
        handlers, and dangerous URLs, keeps safe tags). Pair with{' '}
        <code>dangerouslySetInnerHTML</code>. Do it client-side at render, or
        server-side on write — ideally the sanitiser runs where the HTML is
        finally turned into DOM.
      </p>
      <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={4} style={ta} />
      <p><b>Raw string (escaped for display):</b></p>
      <pre style={pre}>{html}</pre>
      <p><b>After <code>DOMPurify.sanitize()</code>, then rendered:</b></p>
      <div style={out} dangerouslySetInnerHTML={{ __html: clean }} />
      <p style={hint}>Sanitised HTML string: <code>{clean}</code></p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function CspNote() {
  const [csp, setCsp] = useState(null)
  useEffect(() => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    setCsp(meta ? meta.content : null)
  }, [])
  return (
    <section style={box}>
      <h3>6. Content-Security-Policy — defence in depth</h3>
      <p style={hint}>
        CSP is a browser-enforced allowlist for what the page may load/run. A
        strict policy means that <i>even if</i> a payload lands in the DOM,
        inline handlers and unknown script origins are blocked from executing.
        It's a safety net, not a substitute for output encoding.
      </p>
      <pre style={pre}>{`# A reasonable starting policy (served as a response header, ideally):
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  object-src 'none'`}</pre>
      <p style={hint}>
        This page's CSP meta tag: <code>{csp ?? '(none set — added in Lesson 5/7)'}</code>.
        Vite's dev server injects inline scripts, so a truly strict{' '}
        <code>script-src 'self'</code> needs nonces/hashes and is a
        build-config topic — deferred to Lesson 7.
      </p>
    </section>
  )
}

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>Default to interpolation.</b> <code>{'{value}'}</code> in JSX, <code>.textContent</code> in DOM code. Both escape automatically.</li>
        <li><b>Every "render HTML" API is an opt-out of that safety:</b> <code>dangerouslySetInnerHTML</code>, <code>innerHTML</code>, <code>insertAdjacentHTML</code>, <code>document.write</code>, <code>eval</code>, <code>new Function</code>.</li>
        <li><b>If you must render user HTML → sanitise with DOMPurify</b> at the point it becomes DOM, on every render.</li>
        <li><b>Validate URL schemes</b> before putting user input in <code>href</code>/<code>src</code> — allow <code>https:</code>, <code>mailto:</code>, relative only.</li>
        <li><b>Add a strict CSP</b> as a second line of defence (Lesson 5/7).</li>
        <li><b>Consequence:</b> a single XSS bug empties localStorage, non-HttpOnly cookies, and lets the attacker act as the user. That's the case for HttpOnly-cookie sessions (Lesson 4).</li>
      </ol>
    </section>
  )
}

const box = { border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }
const row = { display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.5rem 0' }
const hint = { fontSize: 14, color: '#444' }
const ta = { width: '100%', fontFamily: 'monospace', fontSize: 13 }
const out = { border: '1px dashed #999', borderRadius: 6, padding: '.75rem', margin: '.5rem 0', minHeight: '1.5rem', background: '#fff' }
const pre = { background: '#111', color: '#0f0', padding: '.75rem', borderRadius: 6, overflowX: 'auto', fontSize: 13, whiteSpace: 'pre-wrap' }
