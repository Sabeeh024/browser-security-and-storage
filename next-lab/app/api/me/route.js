import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getBalance } from '@/app/lib/db'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  return NextResponse.json({ user: s.user, balance: getBalance(s.user) })
}
