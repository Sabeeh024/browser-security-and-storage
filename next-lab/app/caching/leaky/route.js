import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/backend'

// ❌ BUG: a per-user response (proxied from the backend) with a SHARED cache
// directive. A CDN / proxy / browser cache keyed only on the URL serves one
// user's balance to the next visitor. `force-static` on a route that reads
// cookies() is the App-Router-specific version of the same mistake.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const { data } = await getAccount(s.accessToken)
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=60' }, // <-- the bug
  })
}
