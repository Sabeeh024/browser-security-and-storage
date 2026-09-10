import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { backendTransfer } from '@/app/lib/backend'

/*
 * A thin proxy. Route Handlers get NO automatic CSRF check (unlike Server
 * Actions) — this one is protected by:
 *   - the SameSite=Lax session cookie
 *   - the Origin check in proxy.js
 * The backend ALSO re-validates the bearer token — never trust "Next forwarded
 * it" as authorization.
 */
export async function POST(req) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const { amount } = await req.json().catch(() => ({}))
  const { status, data } = await backendTransfer(s.accessToken, amount ?? 100)
  return NextResponse.json({ via: 'next route handler → express', ...data }, { status })
}
