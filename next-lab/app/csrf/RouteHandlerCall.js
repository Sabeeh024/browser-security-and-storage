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
        No automatic CSRF check. As exposed as the Express endpoint in topic 3 —
        protected here only by <code>SameSite=Lax</code> + the middleware Origin
        check. You add a CSRF token yourself if you need one.
      </p>
      <div className="row"><button onClick={call}>fetch POST /api/transfer</button></div>
      <pre>{out || '(not called)'}</pre>
    </div>
  )
}
