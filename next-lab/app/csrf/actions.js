'use server'

import { getSession } from '@/app/lib/session'
import { backendTransfer } from '@/app/lib/backend'
import { revalidatePath } from 'next/cache'

/*
 * Server Action. Next automatically: POST-only + checks Origin vs Host (its
 * built-in CSRF defense) + serialises the call so a cross-site <form> can't
 * forge it.
 *
 * NOT done for you: authorization. We re-check the session and validate args,
 * then call the real backend (which re-validates the token independently).
 */
export async function doTransfer(formData) {
  const session = await getSession()
  if (!session) return { error: 'not authenticated' }

  const amount = Number(formData.get('amount')) || 100
  if (amount <= 0 || amount > 10_000) return { error: 'amount out of range' }

  const { status, data } = await backendTransfer(session.accessToken, amount)
  if (status !== 200) return { error: data.error || `backend ${status}` }
  revalidatePath('/csrf')
  return { ok: true, via: 'server action → express', balance: data.balance }
}
