import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import CookieProbe from './CookieProbe'

export const dynamic = 'force-dynamic'

export default async function AuthPage() {
  const session = await getSession() // reads the HttpOnly cookie ON THE SERVER

  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>4 · Auth token storage in Next.js</h1>
      <div className="box">
        <h3>Server Component reads the session</h3>
        <p className="hint">
          <code>await getSession()</code> → <code>cookies()</code> on the server.
          The Server Component sees the decoded session; the browser never gets
          a token, only the opaque HttpOnly cookie.
        </p>
        <pre>{JSON.stringify(session, null, 2) || 'null — log in on the home page'}</pre>
      </div>

      <CookieProbe />

      <h2>The mapping</h2>
      <ul className="hint">
        <li><b>Topic 4 approach A (HttpOnly cookie)</b> is the Next default — via <code>cookies()</code>.</li>
        <li><b>Approach C (BFF)</b> is essentially free: Next <i>is</i> the backend-for-frontend. Route handlers / Server Actions hold any upstream API tokens; the browser gets a session cookie.</li>
        <li><b>Approach B (in-memory access token)</b> is rarely needed — you have a server to proxy through.</li>
        <li>Write cookies only in Route Handlers, Server Actions, or <code>middleware.js</code> — never in a Server Component render.</li>
        <li>Real apps: Auth.js / Lucia / Clerk. All cookie-session by default.</li>
      </ul>
    </main>
  )
}
