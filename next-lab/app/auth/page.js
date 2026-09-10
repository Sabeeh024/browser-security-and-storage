import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import CookieProbe from './CookieProbe'

export const dynamic = 'force-dynamic'

export default async function AuthPage() {
  const session = await getSession() // reads the HttpOnly cookie ON THE SERVER

  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>4 · Auth &amp; the BFF — Express issues, Next holds, browser gets a cookie</h1>
      <div className="box">
        <h3>What the server session holds</h3>
        <p className="hint">
          On login: browser → Next → <code>POST :8787/api/token</code> (with the
          service API key). Express returns a per-user access token. Next stores{' '}
          <code>{'{ user, accessToken }'}</code> in its own HttpOnly cookie.
          <code>await getSession()</code> decodes it on the server:
        </p>
        <pre>{session ? JSON.stringify(session, null, 2) : 'null — log in on the home page'}</pre>
      </div>

      <CookieProbe />

      <h2>The mapping</h2>
      <ul className="hint">
        <li>This <b>is</b> topic 4 approach C (BFF), as the real architecture: the backend token lives only in Next's session; the browser holds one opaque HttpOnly cookie.</li>
        <li>Approach A (HttpOnly cookie) and C collapse into the same thing here — the cookie <i>is</i> the BFF session.</li>
        <li>Approach B (in-memory access token in the browser) is what you'd avoid — you have Next to hold it.</li>
        <li>Write cookies only in Route Handlers, Server Actions, or <code>proxy.js</code> — never during a Server Component render.</li>
        <li>Real apps: Auth.js / Lucia / iron-session; sign or encrypt the cookie, or keep only a session id + a server-side store.</li>
      </ul>
    </main>
  )
}
