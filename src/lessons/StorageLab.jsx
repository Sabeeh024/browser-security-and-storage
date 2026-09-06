import { useEffect, useRef, useState } from 'react'

/*
 * LESSON 1 — Client-side storage: the options, and when each fits.
 *
 * Five places a web app can keep data in the browser:
 *   1. localStorage      — persistent, sync, ~5MB, strings only, JS-readable
 *   2. sessionStorage    — same as above but cleared when the TAB closes
 *   3. Cookies           — sent to the server automatically; server can lock them down
 *   4. IndexedDB         — async, large (100s of MB), structured data, offline
 *   5. In-memory (JS)    — a variable / React state; gone on reload; safest
 *
 * The security punchline: anything JS can read, an XSS payload can also read.
 * That's localStorage, sessionStorage, IndexedDB, and non-HttpOnly cookies.
 * Only an HttpOnly cookie is invisible to JavaScript.
 */

// ---- 5. In-memory: just a module-scoped variable. Not persisted anywhere. ----
let inMemoryValue = ''

export default function StorageLab() {
  return (
    <article>
      <h2>Lesson 1 — Client-side storage</h2>
      <p>
        Open DevTools → <b>Application</b> tab while you poke at these. Watch
        Local Storage, Session Storage, Cookies, and IndexedDB update live.
      </p>

      <WebStorageDemo kind="localStorage" store={window.localStorage} />
      <WebStorageDemo kind="sessionStorage" store={window.sessionStorage} />
      <CookieDemo />
      <IndexedDbDemo />
      <InMemoryDemo />

      <ComparisonTable />
      <Takeaways />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* 1 & 2 — Web Storage (localStorage / sessionStorage share an API)   */
/* ------------------------------------------------------------------ */
function WebStorageDemo({ kind, store }) {
  const [key, setKey] = useState('theme')
  const [value, setValue] = useState('dark')
  const [dump, setDump] = useState({})

  const refresh = () => {
    const out = {}
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      out[k] = store.getItem(k)
    }
    setDump(out)
  }
  useEffect(refresh, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section style={box}>
      <h3>{kind}</h3>
      <p style={hint}>
        {kind === 'localStorage'
          ? 'Survives reloads, tab close, browser restart. Same for every tab on the origin.'
          : 'Scoped to ONE tab. Duplicate the tab and it copies; close the tab and it is gone.'}
        {' '}Synchronous API — big reads/writes block the main thread.
        Values are always strings, so objects need <code>JSON.stringify</code>.
      </p>
      <div style={row}>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" />
        <button onClick={() => { store.setItem(key, value); refresh() }}>setItem</button>
        <button onClick={() => { store.removeItem(key); refresh() }}>removeItem</button>
        <button onClick={() => { store.clear(); refresh() }}>clear</button>
      </div>
      <pre style={pre}>{JSON.stringify(dump, null, 2)}</pre>
      <p style={hint}>
        Try: set a value, then run <code>{kind}.getItem('{key}')</code> in the
        console. That console call is exactly what an injected XSS script does.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 3 — Cookies                                                        */
/* ------------------------------------------------------------------ */
function CookieDemo() {
  const [readable, setReadable] = useState(document.cookie)

  const setCookie = (extra) => {
    document.cookie = `lab_pref=blue; path=/; max-age=3600; SameSite=Lax${extra}`
    setReadable(document.cookie)
  }

  return (
    <section style={box}>
      <h3>Cookies</h3>
      <p style={hint}>
        The only storage the <b>server</b> controls. Every matching request
        carries them automatically — that convenience is also what makes CSRF
        possible (Lesson 3). Tiny: ~4KB per cookie.
      </p>
      <div style={row}>
        <button onClick={() => setCookie('')}>Set readable cookie</button>
        <button onClick={() => setCookie('; Secure')}>+ Secure (HTTPS only)</button>
        <button onClick={() => { document.cookie = 'lab_pref=; max-age=0; path=/'; setReadable(document.cookie) }}>
          Delete
        </button>
      </div>
      <p><b>document.cookie sees:</b></p>
      <pre style={pre}>{readable || '(nothing JS can read)'}</pre>
      <p style={hint}>
        Key flags a server sets on the <code>Set-Cookie</code> header:
      </p>
      <ul style={hint}>
        <li><b>HttpOnly</b> — JS cannot read it. <code>document.cookie</code> won't show it. This is what defeats token theft via XSS.</li>
        <li><b>Secure</b> — only sent over HTTPS.</li>
        <li><b>SameSite=Lax/Strict/None</b> — whether the cookie rides along on cross-site requests. Main CSRF lever.</li>
        <li><b>Domain / Path</b> — how widely the cookie is scoped.</li>
        <li><b>Max-Age / Expires</b> — session cookie vs. persistent.</li>
      </ul>
      <p style={hint}>
        You can't demo HttpOnly from the client — it only exists on a server
        response. We'll do that with a tiny backend in Lesson 4.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 4 — IndexedDB (promise wrapper kept minimal, no library)           */
/* ------------------------------------------------------------------ */
const DB_NAME = 'lab-db'
const STORE = 'notes'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function IndexedDbDemo() {
  const [text, setText] = useState('offline-capable note')
  const [rows, setRows] = useState([])

  const refresh = async () => {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const all = await new Promise((res) => {
      const r = tx.objectStore(STORE).getAll()
      r.onsuccess = () => res(r.result)
    })
    setRows(all)
  }
  useEffect(() => { refresh() }, [])

  const add = async () => {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ text, at: new Date().toISOString() })
    tx.oncomplete = refresh
  }
  const wipe = async () => {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = refresh
  }

  return (
    <section style={box}>
      <h3>IndexedDB</h3>
      <p style={hint}>
        Asynchronous, transactional, holds structured objects (not just
        strings), and can store hundreds of MB. This is where offline apps and
        big caches live. API is clunky — real apps use <code>idb</code> or Dexie.
      </p>
      <div style={row}>
        <input value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={add}>add record</button>
        <button onClick={wipe}>clear store</button>
      </div>
      <pre style={pre}>{JSON.stringify(rows, null, 2)}</pre>
      <p style={hint}>Still plain JS-readable — no security boundary vs. XSS.</p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 5 — In-memory                                                      */
/* ------------------------------------------------------------------ */
function InMemoryDemo() {
  const [value, setValue] = useState(inMemoryValue)
  const renders = useRef(0)
  renders.current++

  return (
    <section style={box}>
      <h3>In-memory (JS variable / React state)</h3>
      <p style={hint}>
        Nothing is written to disk. Gone on reload, gone on tab close, never
        shared between tabs. Not reachable by another site, not persisted for a
        later XSS to scrape. This is the <b>safest</b> place for an access token
        — the cost is you must re-obtain it after every reload (silent refresh).
      </p>
      <div style={row}>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); inMemoryValue = e.target.value }}
        />
        <button onClick={() => window.location.reload()}>reload page</button>
      </div>
      <p style={hint}>
        Type something, reload — it's gone. (Renders this mount: {renders.current})
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function ComparisonTable() {
  const data = [
    ['localStorage', '~5MB', 'Persistent', 'Sync', 'Yes ❌', 'User prefs, non-sensitive UI cache'],
    ['sessionStorage', '~5MB', 'Per tab', 'Sync', 'Yes ❌', 'One-tab flow state, wizard progress'],
    ['Cookie (HttpOnly)', '~4KB', 'Configurable', 'Auto-sent', 'No ✅', 'Session/auth token (with SameSite+Secure)'],
    ['Cookie (normal)', '~4KB', 'Configurable', 'Auto-sent', 'Yes ❌', 'CSRF token (double-submit), light prefs'],
    ['IndexedDB', '100s MB', 'Persistent', 'Async', 'Yes ❌', 'Offline data, large caches, media'],
    ['In-memory', 'RAM', 'Until reload', 'Sync', 'No ✅*', 'Access tokens, secrets during a session'],
  ]
  return (
    <section style={box}>
      <h3>Cheat sheet</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead>
            <tr>{['Store', 'Size', 'Lifetime', 'Access', 'JS-readable', 'Good for'].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i} style={td}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={hint}>
        * In-memory is safe from <i>persisted</i> theft, but a live XSS running
        in your page can still read your variables. Nothing on the client
        survives arbitrary script execution — XSS prevention (Lesson 2) is the
        real fix.
      </p>
    </section>
  )
}

function Takeaways() {
  return (
    <section style={{ ...box, background: '#f5f7ff' }}>
      <h3>Takeaways</h3>
      <ol>
        <li><b>Match the store to the data:</b> prefs → localStorage; per-tab flow → sessionStorage; offline/large → IndexedDB; auth → cookie or memory.</li>
        <li><b>Never put anything you'd hate to leak in localStorage.</b> No tokens, no PII. It's readable by every script on the origin, forever.</li>
        <li><b>HttpOnly cookie is the only client store JS can't read.</b> That's why session tokens belong there — paired with <code>Secure</code> and <code>SameSite</code>.</li>
        <li><b>Client storage is not a trust boundary.</b> The user can edit any of it in DevTools. Validate on the server.</li>
        <li><b>"Where do I keep the JWT?"</b> → HttpOnly cookie, or in-memory + refresh. We settle this in Lesson 4.</li>
      </ol>
    </section>
  )
}

/* --- inline styles, keeps the lesson self-contained --- */
const box = { border: '1px solid #ddd', borderRadius: 8, padding: '1rem', margin: '1rem 0' }
const row = { display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.5rem 0' }
const hint = { fontSize: 14, color: '#444' }
const pre = { background: '#111', color: '#0f0', padding: '.75rem', borderRadius: 6, overflowX: 'auto', fontSize: 13 }
const table = { borderCollapse: 'collapse', width: '100%', fontSize: 13 }
const th = { border: '1px solid #ccc', padding: '.4rem .6rem', background: '#eee', textAlign: 'left' }
const td = { border: '1px solid #ccc', padding: '.4rem .6rem' }
