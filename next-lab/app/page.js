import Link from 'next/link'
import { getSession } from './lib/session'

export const dynamic = 'force-dynamic' // reads cookies — see /caching for why this matters

export default async function Home() {
  const session = await getSession()
  return (
    <main>
      <h1>Topic 08 — Browser security, mapped onto Next.js</h1>
      <p className="hint">
        Same concepts as the Vite lab (topics 1–7). What changes is <b>where the
        server-side half lives</b>: route handlers, Server Actions, middleware,
        and Server Components — all inside one project.
      </p>
      <div className="row">
        Session: <b>{session ? `logged in as ${session.user}` : 'logged out'}</b>
        {session
          ? <form action="/api/logout" method="post"><button>logout</button></form>
          : <form action="/api/login" method="post"><button>login as alice</button></form>}
      </div>

      <h2>Demos</h2>
      <ul>
        <li><Link href="/csrf">3 · CSRF</Link> — Server Actions get Origin checks for free; route handlers don't</li>
        <li><Link href="/auth">4 · Auth storage</Link> — <code>cookies()</code> HttpOnly session; Next is the BFF</li>
        <li><Link href="/rsc-leak">4/6 · RSC data leakage</Link> — props to a Client Component ship in the HTML</li>
        <li><Link href="/env">6 · Secrets in the bundle</Link> — <code>NEXT_PUBLIC_</code> vs server env</li>
        <li><Link href="/caching">7 · Caching correctness</Link> — a cached route that reads cookies leaks across users</li>
        <li>5/7 · Headers &amp; CSP — see <code>next.config.mjs</code> + <code>middleware.js</code> (view source / response headers)</li>
      </ul>
    </main>
  )
}
