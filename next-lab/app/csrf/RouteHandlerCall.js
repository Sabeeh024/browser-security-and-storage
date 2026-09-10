'use client'
import { useState } from 'react'

export default function RouteHandlerCall() {
  const [out, setOut] = useState('')
  const call = async () => {
    const r = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 }),
    })
    setOut(`${r.status} ${JSON.stringify(await r.json())}`)
  }
  return (
    <div className="box">
      <h3>B · Route Handler <code>POST /api/transfer</code></h3>
      <p className="hint">
        No automatic CSRF check (unlike the Server Action). Protected here by{' '}
        <code>SameSite=Lax</code> + the <code>proxy.js</code> Origin check. Next
        then relays to <code>POST :8787/api/transfer</code> with the Bearer
        token. Add a CSRF token too if you want defense in depth.
      </p>
      <div className="row"><button onClick={call}>fetch POST /api/transfer</button></div>
      <pre>{out || '(not called)'}</pre>
    </div>
  )
}
