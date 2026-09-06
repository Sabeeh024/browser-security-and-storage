// Client for the demo bank API (server/index.js). Base is a different origin,
// so every call needs credentials:'include' to send/receive the cookies.
const BASE = 'http://localhost:8787'

const readCookie = (name) =>
  document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1]

async function req(path, { method = 'GET', body, csrf = false } = {}) {
  const headers = {}
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
