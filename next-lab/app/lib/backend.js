import 'server-only'

/*
 * Client for the REAL backend — the Express bank API from topics 3–7,
 * running separately on :8787. In a real project this is a Spring / Rails /
 * Go / NestJS service owned by another team.
 *
 * Key point: these calls are SERVER-TO-SERVER (Next server → Express).
 *   - No browser involved → CORS is irrelevant (CORS is a browser mechanism).
 *   - No cookies → we authenticate with a Bearer token the Next BFF holds.
 *   - The BACKEND_API_KEY and the per-user access token NEVER reach the browser.
 */
const BASE = process.env.BACKEND_URL || 'http://localhost:8787'
const API_KEY = process.env.BACKEND_API_KEY || 'dev-backend-key'

// Exchanged once at login for a per-user access token the BFF keeps in its
// session cookie (server-readable only).
export async function issueToken(user = 'alice') {
  const r = await fetch(`${BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ user }),
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`backend token exchange failed: ${r.status}`)
  return r.json() // { accessToken, user, expiresInMs }
}

export async function getAccount(accessToken) {
  const r = await fetch(`${BASE}/api/account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store', // per-user — never cache (topic 7)
  })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}

export async function backendTransfer(accessToken, amount) {
  const r = await fetch(`${BASE}/api/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ amount }),
    cache: 'no-store',
  })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}
