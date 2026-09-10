import 'server-only'
import { cookies } from 'next/headers'

/*
 * The BFF session. The browser holds ONE opaque HttpOnly cookie. Inside it
 * (server-readable only) sits the backend access token — so:
 *   - the browser never sees a backend token (topic 4 approach C, for real)
 *   - XSS can't exfiltrate it (HttpOnly) — it can still ride the session by
 *     calling our /api/* routes, which we re-check
 *   - CORS between browser and Next is a non-issue (same origin)
 *
 * Real apps: encrypt/sign this (iron-session, Auth.js, JWE) instead of base64,
 * or store only a session id and keep the token in a server-side store (Redis).
 */
const NAME = 'bff_session'

export async function getSession() {
  const raw = (await cookies()).get(NAME)?.value
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

export async function setSession(data) {
  ;(await cookies()).set(NAME, Buffer.from(JSON.stringify(data)).toString('base64'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 30,
  })
}

export async function clearSession() {
  ;(await cookies()).delete(NAME)
}
