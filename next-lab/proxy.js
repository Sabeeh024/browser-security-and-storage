import { NextResponse } from 'next/server'

/*
 * (Next 16 renamed `middleware.js` → `proxy.js`; the export is `proxy`.)
 *
 * Two topic-5/3 jobs done at the edge for every request:
 *   1. CSP with a per-request nonce (Next's official pattern) — the dev/prod
 *      inline-script problem from topic 7 is solved by the nonce, not by
 *      loosening the policy.
 *   2. An Origin check on state-changing requests to /api/* — cheap CSRF
 *      defense-in-depth for Route Handlers, which (unlike Server Actions)
 *      don't get one automatically.
 */
export function proxy(request) {
  // --- 2. Origin check for mutating API calls -----------------------------
  const method = request.method
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin && new URL(origin).host !== host) {
      return new NextResponse('cross-origin request rejected', { status: 403 })
    }
  }

  // --- 1. CSP nonce ------------------------------------------------------
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  // Dev-only escape hatch: React's dev build uses eval() for stack traces and
  // Turbopack HMR is inline. Production drops both — the exact dev/prod CSP
  // split from topic 7, now visible in one file.
  const devSrc = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `connect-src 'self'`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce) // Next reads this to nonce its own scripts
  requestHeaders.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)
  return response
}

export const config = {
  matcher: [
    // everything except static assets and images
    { source: '/((?!_next/static|_next/image|favicon.ico).*)' },
  ],
}
