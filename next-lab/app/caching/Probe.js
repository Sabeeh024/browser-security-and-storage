'use client'
import { useState } from 'react'

export default function Probe() {
  const [rows, setRows] = useState([])
  const hit = async (path) => {
    const r = await fetch(path)
    const body = await r.json()
    const cc = r.headers.get('cache-control')
    setRows((x) => [{ path, cc, body, t: Date.now() }, ...x].slice(0, 8))
  }
  return (
    <div className="box">
      <div className="row">
        <button onClick={() => hit('/caching/leaky')}>GET /caching/leaky</button>
        <button onClick={() => hit('/caching/safe')}>GET /caching/safe</button>
      </div>
      <pre>{rows.map((r) =>
        `${r.path}\n  Cache-Control: ${r.cc}\n  ${JSON.stringify(r.body)}`
      ).join('\n\n') || '(nothing yet)'}</pre>
      <p className="hint">
        Look at <code>Cache-Control</code>. <code>/leaky</code> sends{' '}
        <code>public, max-age=60</code> on a response that depends on{' '}
        <i>your</i> cookie — any shared cache (CDN, corporate proxy) can now
        hand your balance to the next person who requests that URL.{' '}
        <code>/safe</code> sends <code>private, no-store</code>.
      </p>
    </div>
  )
}
