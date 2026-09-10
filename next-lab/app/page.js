import Link from 'next/link'
import { getSession } from './lib/session'
import { getAccount } from './lib/backend'

export const dynamic = 'force-dynamic' // reads cookies — see /caching

export default async function Home() {
  const session = await getSession()
  // SSR: Server Component → Express backend directly. Fast, private, no CORS,
  // no round-trip through the browser.
  const account = session ? (await getAccount(session.accessToken)).data : null

  return (
    <main>
      <h1>Topic 08 — Next.js as frontend + BFF, Express as the backend</h1>
      <p className="hint">
        Realistic split: <b>Next</b> renders (SSR/CSR) and proxies; the actual
        API is a separate <b>Express</b> service on <code>:8787</code> (the bank
        API from topics 3–7). Run both: <code>npm run server</code> in the repo
        root, <code>npm run dev</code> in <code>next-lab/</code>.
      </p>

      <div className="row">
        Session: <b>{session ? `${session.user} — backend balance $${account?.balance ?? '?'}` : 'logged out'}</b>
        {session
          ? <form action="/api/logout" method="post"><button>logout</button></form>
          : <form action="/api/login" method="post"><button>login as alice</button></form>}
      </div>

      <h2>Demos</h2>
      <ul>
        <li><Link href="/data-flow">Data flow</Link> — SSR (server→Express) vs CSR (browser→Next→Express); the browser never touches Express</li>
        <li><Link href="/csrf">3 · CSRF</Link> — Server Action vs Route Handler; only browser↔Next matters</li>
        <li><Link href="/auth">4 · Auth &amp; the BFF</Link> — Express issues the token, Next holds it, browser gets a cookie</li>
        <li><Link href="/rsc-leak">4/6 · RSC data leakage</Link> — props to a Client Component ship in the HTML</li>
        <li><Link href="/env">6 · Secrets in the bundle</Link> — <code>NEXT_PUBLIC_</code> vs <code>BACKEND_API_KEY</code></li>
        <li><Link href="/caching">7 · Caching correctness</Link> — a cached per-user response leaks across users</li>
        <li>5/7 · Headers &amp; CSP — <code>next.config.mjs</code> + <code>proxy.js</code> (check response headers)</li>
      </ul>
    </main>
  )
}
