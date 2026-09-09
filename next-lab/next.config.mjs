/** @type {import('next').NextConfig} */

// Topic 5/7 header set — host-agnostic, applied to every route by Next itself.
// The dynamic bits (CSP nonce) are in middleware.js; the static headers live here.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig = {
  turbopack: { root: import.meta.dirname }, // this folder, not the parent Vite lab
  poweredByHeader: false, // drop the X-Powered-By: Next.js fingerprint
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
