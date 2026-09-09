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
        The <code>demo_session</code> cookie is <code>HttpOnly</code> — absent
        above. But the fetch still authenticates, because the browser attaches
        the cookie automatically. Same lesson as topic 4: XSS can't steal it,
        but can ride it.
      </p>
    </div>
  )
}
