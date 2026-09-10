import 'server-only'

// Stand-in for a real server-side secret (a signing key, the BACKEND_API_KEY,
// a DB URL). `import 'server-only'` makes the build fail if a Client Component
// ever imports this module.
export const SIGNING_KEY = process.env.BACKEND_API_KEY || 'dev-backend-key'
