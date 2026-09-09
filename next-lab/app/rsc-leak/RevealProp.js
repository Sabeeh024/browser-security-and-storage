'use client'
import { useState } from 'react'

// This Client Component receives `apiKey` as a prop from a Server Component.
// Whatever a Server Component passes to a Client Component is SERIALISED into
// the RSC payload that ships to the browser — visible in the page source and
// the /_next/... network response, even though it's never rendered.
export default function RevealProp({ apiKey }) {
  const [shown, setShown] = useState(false)
  return (
    <div>
      <button onClick={() => setShown((s) => !s)}>
        {shown ? 'hide' : 'reveal the prop this client component received'}
      </button>
      {shown && <pre>apiKey = {apiKey}</pre>}
      <p className="hint">
        Even before you click: View Source / search the page for this value, or
        look at the streamed RSC payload. It's already in the browser.
      </p>
    </div>
  )
}
