import Link from 'next/link'

export const dynamic = 'force-dynamic'

// process.env.X on the server: real value.
// process.env.NEXT_PUBLIC_X: inlined into the CLIENT bundle at build — public.
// process.env.SOME_SECRET referenced in client code: undefined (not leaked, but broken).

export default function EnvPage() {
  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>6 · Secrets in the bundle — Next edition</h1>

      <table>
        <thead><tr><th>Reference</th><th>Server</th><th>Client bundle</th></tr></thead>
        <tbody>
          <tr>
            <td><code>process.env.UPSTREAM_API_SECRET</code></td>
            <td>real value</td>
            <td><b>not included</b> (and <code>undefined</code> if you try)</td>
          </tr>
          <tr>
            <td><code>process.env.NEXT_PUBLIC_ORIGIN</code></td>
            <td>real value</td>
            <td><b>inlined as a string literal at build</b> — 100% public</td>
          </tr>
          <tr>
            <td>a value passed as a prop to a Client Component</td>
            <td>—</td>
            <td>shipped in the RSC payload (see <Link href="/rsc-leak">/rsc-leak</Link>)</td>
          </tr>
        </tbody>
      </table>

      <p className="hint">
        Rule from topic 6 restated: <b><code>NEXT_PUBLIC_</code> is the <i>VITE_</i>
        of Next</b> — anything with that prefix, or referenced from a{' '}
        <code>&apos;use client&apos;</code> module, is public. Real secrets stay
        server-side (route handlers, server actions, server components) and are
        guarded with <code>import 'server-only'</code>. Keep the CI bundle
        secret-scan from topic 7 — it works the same on <code>.next/static</code>.
      </p>
    </main>
  )
}
