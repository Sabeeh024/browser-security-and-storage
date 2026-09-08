// Client for the demo bank API (server/index.js). Base is a different origin,
// so every call needs credentials:'include' to send/receive the cookies.
const BASE = 'http://localhost:8787'

const readCookie = (name) =>
  document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1]

async function req(path, { method = 'GET', body, csrf = false, headers: extra } = {}) {
  const headers = { ...extra }
  if (body) headers['Content-Type'] = 'application/json'
  // Double-submit: read the non-HttpOnly csrfToken cookie and echo it in a header.
  if (csrf) headers['X-CSRF-Token'] = readCookie('csrfToken') ?? ''

  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

export const bank = {
  getConfig: () => req('/config'),
  setConfig: (patch) => req('/config', { method: 'POST', body: patch }),
  login: () => req('/login', { method: 'POST' }),
  me: () => req('/me'),
  // legit transfer from the SPA: sends the CSRF header
  transfer: (amount) => req('/transfer', { method: 'POST', body: { amount }, csrf: true }),
  // simulate a lazy SPA that forgot the CSRF header
  transferNoCsrf: (amount) => req('/transfer', { method: 'POST', body: { amount } }),
}

// --- Lesson 4: auth-token-storage approaches ---
export const authApi = {
  // A — HttpOnly cookie session (reuses /login + /me above)
  cookieLogin: () => req('/login', { method: 'POST' }),
  cookieData: () => req('/me'),

  // B — in-memory access token + HttpOnly refresh cookie
  login: () => req('/auth/login', { method: 'POST' }),
  refresh: () => req('/auth/refresh', { method: 'POST' }),
  data: (accessToken) =>
    req('/auth/data', { headers: { Authorization: `Bearer ${accessToken ?? ''}` } }),
  logout: () => req('/auth/logout', { method: 'POST' }),

  // C — BFF: browser never holds a token
  bffLogin: () => req('/bff/login', { method: 'POST' }),
  bffData: () => req('/bff/data'),
  bffLogout: () => req('/bff/logout', { method: 'POST' }),
}
