import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function EnvPage() {
  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>6 · Secrets in the bundle — Next edition</h1>

      <table>
        <thead><tr><th>Reference</th><th>Server</th><th>Client bundle</th></tr></thead>
        <tbody>
          <tr>
            <td><code>process.env.BACKEND_API_KEY</code></td>
            <td>real value (used by <code>lib/backend.js</code> to call Express)</td>
            <td><b>not included</b> — and <code>undefined</code> if a client module reads it</td>
          </tr>
          <tr>
            <td><code>process.env.NEXT_PUBLIC_APP_NAME</code></td>
            <td>real value</td>
            <td><b>inlined as a string literal at build</b> — 100% public</td>
          </tr>
          <tr>
            <td>a value passed as a prop to a Client Component</td>
            <td>—</td>
            <td>shipped in the RSC payload (see <Link href="/rsc-leak">/rsc-leak</Link>)</td>
          </tr>
          <tr>
            <td>the backend access token</td>
            <td>in Next&apos;s HttpOnly session cookie only</td>
            <td><b>never</b> — browser holds the opaque cookie, not its contents</td>
          </tr>
        </tbody>
      </table>

      <p className="hint">
        <b><code>NEXT_PUBLIC_</code> is the <i>VITE_</i> of Next</b> — that prefix,
        or anything referenced from a <code>&apos;use client&apos;</code> module,
        is public. The service API key and per-user tokens live only in Next&apos;s
        server process / session cookie. Keep the topic-7 CI bundle secret-scan —
        it works the same on <code>.next/static</code>.
      </p>
    </main>
  )
}
