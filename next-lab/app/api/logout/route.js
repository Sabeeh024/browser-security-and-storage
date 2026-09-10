import { NextResponse } from 'next/server'
import { clearSession } from '@/app/lib/session'

export async function POST(req) {
  await clearSession() // (a real BFF would also revoke the token at the backend)
  return NextResponse.redirect(new URL('/', req.url), 303)
}
