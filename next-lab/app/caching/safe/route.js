import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getBalance } from '@/app/lib/db'

// ✅ per-user data: mark it private and uncacheable. In the App Router, reading
// cookies() already makes a route dynamic — but be explicit for responses that
// pass through any shared cache.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const body = { user: s.user, balance: getBalance(s.user), servedAt: new Date().toISOString() }
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
