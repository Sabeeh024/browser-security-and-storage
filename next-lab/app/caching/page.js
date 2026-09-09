import Link from 'next/link'
import Probe from './Probe'

export const dynamic = 'force-dynamic'

export default function CachingPage() {
  return (
    <main>
      <p><Link href="/">← home</Link></p>
      <h1>7 · Caching correctness — the Next-specific vuln class</h1>
      <p className="hint">
        No analog in the Vite SPA lab. Next caches aggressively across layers
        (full-route cache, Data Cache, Router Cache, plus whatever CDN sits in
        front). A response that depends on <code>cookies()</code> /{' '}
        <code>headers()</code> / the user, but gets cached with a shared key or a
        public directive, <b>serves one user's data to another</b>.
      </p>
      <Probe />
      <h2>Rules</h2>
      <ul className="hint">
        <li>Reading <code>cookies()</code>/<code>headers()</code> opts a route into dynamic rendering — good. Don't fight it with <code>force-static</code>.</li>
        <li>Per-user API responses: <code>Cache-Control: private, no-store</code>. Never <code>public</code>.</li>
        <li><code>fetch(url, {'{ cache: \'force-cache\' }'})</code> of a personalised upstream = the same bug one layer down. Pass <code>{'{ cache: \'no-store\' }'}</code> or tag + revalidate per user.</li>
        <li><code>unstable_cache</code> / <code>&apos;use cache&apos;</code>: the cache key must include every input that changes the output — the user id included.</li>
        <li>Test it: log in as A, hit the route, log in as B, hit it again — same URL, must not see A's data.</li>
      </ul>
    </main>
  )
}
