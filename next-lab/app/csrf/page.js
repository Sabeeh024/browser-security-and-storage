import Link from 'next/link'
import { getSession } from '@/app/lib/session'
import { getBalance } from '@/app/lib/db'
import { doTransfer } from './actions'
import RouteHandlerCall from './RouteHandlerCall'

export const dynamic = 'force-dynamic'

export default async function CsrfPage() {
  const session = await getSession()
  const balance = session ? getBalance(session.user) : null

  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>3 · CSRF in Next.js</h1>
      {!session && <p style={{ color: '#c00' }}>Log in on the home page first.</p>}
      <p style={{ fontSize: 18 }}>Balance: <b>{balance == null ? '—' : `$${balance}`}</b></p>

      <div className="box">
        <h3>A · Server Action <code>doTransfer</code></h3>
        <p className="hint">
          Next only accepts POST for actions and checks <code>Origin</code> vs{' '}
          <code>Host</code> automatically — a cross-site <code>&lt;form&gt;</code>{' '}
          can't forge this. Still: the action re-checks the session and validates
          <code>amount</code> itself (authorization is on you).
        </p>
        <form action={doTransfer} className="row">
          <input name="amount" defaultValue="100" size={6} />
          <button type="submit">transfer via Server Action</button>
        </form>
      </div>

      <RouteHandlerCall />

      <h2>The mapping</h2>
      <table>
        <thead><tr><th></th><th>Server Action</th><th>Route Handler</th></tr></thead>
        <tbody>
          <tr><td>Auto Origin/CSRF check</td><td>✅ built in</td><td>❌ you add it</td></tr>
          <tr><td>Method</td><td>POST only</td><td>whatever you export</td></tr>
          <tr><td>Authorization</td><td>your code</td><td>your code</td></tr>
          <tr><td>Good for</td><td>form mutations from your own UI</td><td>public API, webhooks, non-browser clients</td></tr>
        </tbody>
      </table>
    </main>
  )
}
