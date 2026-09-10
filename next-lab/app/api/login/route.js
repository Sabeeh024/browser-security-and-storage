import { NextResponse } from 'next/server'
import { issueToken } from '@/app/lib/backend'
import { setSession } from '@/app/lib/session'

// Browser → Next (same origin) → Express (server-to-server).
// Next exchanges a service credential for a per-user token and stashes it in
// its own HttpOnly cookie. The browser gets a redirect and a cookie — no token.
export async function POST(req) {
  const { accessToken, user } = await issueToken('alice')
  await setSession({ user, accessToken })
  return NextResponse.redirect(new URL('/', req.url), 303)
}
