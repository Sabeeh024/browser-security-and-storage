import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/backend'

// ✅ per-user data: mark it private and uncacheable. Reading cookies() already
// makes the route dynamic; be explicit for anything through a shared cache.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const { data } = await getAccount(s.accessToken)
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
