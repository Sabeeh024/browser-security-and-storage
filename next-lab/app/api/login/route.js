import { NextResponse } from 'next/server'
import { setSession } from '@/app/lib/session'

// Route Handler. Note: this is a plain POST endpoint — it does NOT get the
// automatic CSRF/Origin check that Server Actions do. A cross-site form could
// hit it. Mitigations: SameSite cookie (we set Lax), + a CSRF token, + the
// Origin check we do in middleware.js.
export async function POST() {
  await setSession({ user: 'alice', loginAt: Date.now() })
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000'), 303)
}
