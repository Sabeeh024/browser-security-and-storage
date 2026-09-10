'use client'
import { useState } from 'react'

const BACKEND = 'http://localhost:8787'

export default function ClientPaths() {
  const [viaNext, setViaNext] = useState('')
  const [direct, setDirect] = useState('')

  return (
    <>
      <div className="box">
        <h3>CSR path ✅ — browser → Next route handler → Express</h3>
        <p className="hint">
          The client calls <code>/api/me</code> (same origin, no CORS). Next
          attaches the Bearer token server-side and relays to Express.
        </p>
        <div className="row"><button onClick={async () => {
          const r = await fetch('/api/me')
          setViaNext(`${r.status} ${JSON.stringify(await r.json())}`)
        }}>fetch('/api/me')</button></div>
        <pre>{viaNext || '(not called)'}</pre>
      </div>

      <div className="box" style={{ borderColor: '#c00' }}>
        <h3>❌ browser → Express directly</h3>
        <p className="hint">
          Blocked three ways over: the CSP <code>connect-src 'self'</code>
          (proxy.js) stops it leaving; Express sends no CORS headers for{' '}
          <code>localhost:3000</code>; and the browser has no backend token
          anyway. Defense in depth.
        </p>
        <div className="row"><button onClick={async () => {
          try {
            const r = await fetch(`${BACKEND}/api/account`)
            setDirect(`${r.status} ${JSON.stringify(await r.json())}`)
          } catch (e) {
            setDirect(`blocked / failed: ${e}`)
          }
        }}>fetch(&apos;http://localhost:8787/api/account&apos;)</button></div>
        <pre>{direct || '(not called)'}</pre>
      </div>
    </>
  )
}
