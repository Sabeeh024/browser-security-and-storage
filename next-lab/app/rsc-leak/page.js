import Link from 'next/link'
import { SIGNING_KEY } from '@/app/lib/secrets'
import RevealProp from './RevealProp'

export const dynamic = 'force-dynamic'

// A leaky demo value derived from the server-only secret.
const LEAKY = `${SIGNING_KEY.slice(0, 6)}…(server secret, first 6 chars)`

export default function RscLeakPage() {
  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>4/6 · RSC data leakage — the new footgun</h1>

      <div className="box" style={{ borderColor: '#c00' }}>
        <h3>❌ Server → Client prop</h3>
        <p className="hint">
          The Server Component below passes a value to a Client Component as a
          prop. That prop is now in the browser's RSC payload — search the page
          source for it.
        </p>
        <RevealProp apiKey={LEAKY} />
      </div>

      <div className="box" style={{ borderColor: '#0a0' }}>
        <h3>✅ Keep it on the server</h3>
        <p className="hint">
          Do the work that needs the secret <i>in the Server Component</i> (or a
          route handler / server action) and pass only the <b>result</b> to the
          client. Guard the module with <code>import 'server-only'</code> so a
          stray client import fails the build. Never hand a secret to a Client
          Component "just to use it there".
        </p>
      </div>

      <h2>Also in this class</h2>
      <ul className="hint">
        <li><b>Serialised props</b>: objects, tokens, full user records passed to Client Components all ship.</li>
        <li><b>Error messages</b> from Server Components can surface server internals in the browser — sanitise, use <code>error.js</code> boundaries.</li>
        <li><b><code>&apos;use client&apos;</code> at the top of a file makes the <i>whole module</i> client</b> — including anything it re-exports.</li>
      </ul>
    </main>
  )
}
