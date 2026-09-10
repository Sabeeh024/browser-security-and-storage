import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/backend'
import ClientPaths from './ClientPaths'

export const dynamic = 'force-dynamic'

export default async function DataFlowPage() {
  const session = await getSession()
  const ssr = session ? await getAccount(session.accessToken) : null

  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>Data flow — Next frontend, Express backend</h1>
      {!session && <p style={{ color: '#c00' }}>Log in on the home page first.</p>}

      <div className="box" style={{ borderColor: '#0a0' }}>
        <h3>SSR path ✅ — Server Component → Express</h3>
        <p className="hint">
          This page is a Server Component. It called{' '}
          <code>GET :8787/api/account</code> with the Bearer token <b>during
          render, on the server</b>. Server-to-server: no CORS, no browser
          round-trip, the token never left the server. The browser just gets
          HTML.
        </p>
        <pre>{ssr ? JSON.stringify(ssr.data, null, 2) : '(logged out)'}</pre>
      </div>

      <ClientPaths />

      <h2>The two trust boundaries</h2>
      <table>
        <thead><tr><th></th><th>browser ↔ Next</th><th>Next ↔ Express</th></tr></thead>
        <tbody>
          <tr><td>Same origin?</td><td>yes (:3000)</td><td>n/a — server-to-server</td></tr>
          <tr><td>CORS</td><td>irrelevant (same origin)</td><td>irrelevant (no browser)</td></tr>
          <tr><td>CSRF</td><td><b>applies</b> → SameSite + Origin check + Server Actions</td><td>not possible</td></tr>
          <tr><td>Credential</td><td>opaque HttpOnly cookie</td><td>Bearer token + service API key</td></tr>
          <tr><td>XSS impact</td><td>can ride the cookie via /api/*</td><td>can't reach it</td></tr>
          <tr><td>Harden with</td><td>CSP, cookie flags, CSRF, input handling</td><td>network policy / mTLS, token scope, backend authz</td></tr>
        </tbody>
      </table>
      <p className="hint">
        Putting Next in front <b>removes the browser↔API CORS relationship
        entirely</b> — the Express CORS config from topic 5 now only matters if
        some other browser client calls Express directly.
      </p>
    </main>
  )
}
