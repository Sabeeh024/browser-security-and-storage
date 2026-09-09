'use server'

import { getSession } from '@/app/lib/session'
import { transfer } from '@/app/lib/db'
import { revalidatePath } from 'next/cache'

/*
 * A Server Action. Next automatically:
 *   - only accepts POST
 *   - checks the Origin header matches the Host (its built-in CSRF defense)
 *   - serialises the call so a cross-site <form> can't forge it
 *
 * What it does NOT do for you: authorization. We still must check the session
 * and that the user is allowed to perform THIS action with THESE args.
 */
export async function doTransfer(formData) {
  const session = await getSession()
  if (!session) return { error: 'not authenticated' }

  const amount = Number(formData.get('amount')) || 100
  if (amount <= 0 || amount > 10_000) return { error: 'amount out of range' }

  const balance = transfer(session.user, amount)
  revalidatePath('/csrf')
  return { ok: true, via: 'server action', balance }
}
