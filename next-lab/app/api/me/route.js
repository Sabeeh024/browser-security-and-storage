import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/backend'

// CSR data path: browser → Next route handler → Express.
// The browser never calls Express. It calls us; we attach the token and relay.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  const { status, data } = await getAccount(s.accessToken)
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
