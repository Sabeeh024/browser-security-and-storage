import 'server-only' // build fails if this module is ever imported by a Client Component

// The "bank" — module state, resets on server restart. Stands in for a real DB.
const users = new Map([['alice', { balance: 1000 }]])

export function getBalance(user) {
  return users.get(user)?.balance ?? null
}

export function transfer(user, amount) {
  const u = users.get(user)
  if (!u) throw new Error('no such user')
  u.balance -= Number(amount) || 0
  return u.balance
}

// A value that must never reach the browser.
export const API_SECRET = process.env.UPSTREAM_API_SECRET || 'super-secret-upstream-key'
