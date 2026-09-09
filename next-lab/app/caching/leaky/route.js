import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getBalance } from '@/app/lib/db'

// ❌ BUG: a per-user response with a SHARED cache directive. A CDN / proxy /
// browser cache keyed only on the URL will serve one user's balance to the
// next visitor. Also: `force-static` on a route that reads cookies is the
// App-Router-specific version of the same mistake.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const body = { user: s.user, balance: getBalance(s.user), servedAt: new Date().toISOString() }
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=60' }, // <-- the bug
  })
}
