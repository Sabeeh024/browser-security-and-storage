import 'server-only'
import { cookies } from 'next/headers'

/*
 * Cookie session — the Lesson 4 "HttpOnly cookie" approach, but the server half
 * is now in-framework. `cookies()` reads in Server Components; it writes only in
 * Route Handlers, Server Actions, and middleware.
 *
 * Real apps: use Auth.js / Lucia / Clerk. This is the mechanism, minus signing.
 */
const NAME = 'demo_session'

export async function getSession() {
  const jar = await cookies()
  const raw = jar.get(NAME)?.value
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export async function setSession(data) {
  const jar = await cookies()
  jar.set(NAME, Buffer.from(JSON.stringify(data)).toString('base64'), {
    httpOnly: true,               // JS can't read it — Lesson 1/2
    sameSite: 'lax',              // not sent on cross-site POST — Lesson 3
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  })
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(NAME)
}
