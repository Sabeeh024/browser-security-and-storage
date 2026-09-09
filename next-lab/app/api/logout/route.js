import { NextResponse } from 'next/server'
import { clearSession } from '@/app/lib/session'

export async function POST() {
  await clearSession()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000'), 303)
}
