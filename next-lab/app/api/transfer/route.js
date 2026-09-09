import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { transfer } from '@/app/lib/db'

// A mutating Route Handler. Unlike a Server Action, Next does NOT check the
// Origin here — this is exactly as exposed to CSRF as the Express /transfer in
// topic 3. It relies on: SameSite=Lax cookie + the middleware Origin check.
export async function POST(req) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const { amount } = await req.json().catch(() => ({}))
  const balance = transfer(s.user, amount ?? 100)
  return NextResponse.json({ ok: true, via: 'route handler', balance })
}
