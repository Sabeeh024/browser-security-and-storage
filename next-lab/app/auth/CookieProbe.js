'use client'
import { useEffect, useState } from 'react'

export default function CookieProbe() {
  const [cookie, setCookie] = useState('')
  const [me, setMe] = useState('')
  useEffect(() => { setCookie(document.cookie || '(nothing readable)') }, [])
  return (
    <div className="box">
      <h3>What the browser can see</h3>
      <p className="hint"><code>document.cookie</code> (what an XSS payload reads):</p>
      <pre>{cookie}</pre>
      <div className="row">
        <button onClick={async () => {
          const r = await fetch('/api/me')
          setMe(`${r.status} ${JSON.stringify(await r.json())}`)
        }}>fetch /api/me (rides the cookie)</button>
      </div>
      <pre>{me || '(not called)'}</pre>
      <p className="hint">
        The <code>bff_session</code> cookie is <code>HttpOnly</code> — absent
        above, and the backend token inside it never reaches the browser at all.
        But <code>/api/me</code> still works, because the browser attaches the
        cookie automatically. Topic 4 again: XSS can't steal it, but can ride it
        by calling our <code>/api/*</code> routes — which is why those re-check.
      </p>
    </div>
  )
}
