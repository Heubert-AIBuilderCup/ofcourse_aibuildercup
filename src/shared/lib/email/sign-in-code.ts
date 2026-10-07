import 'server-only'

// Sends the six-digit sign-in code (Better Auth's email-code plugin, auth/index.ts). Through Resend
// when RESEND_API_KEY and EMAIL_FROM are set; otherwise, outside production, to the server console
// so development works without a provider. Production without a provider refuses.

/** How long a sign-in code works: ten minutes. */
export const SIGN_IN_CODE_TTL_SECONDS = 600

const RESEND_URL = 'https://api.resend.com/emails'
// The provider answers in well under a second; a hung connection must not hold the request.
const PROVIDER_TIMEOUT_MS = 10_000

export async function sendSignInCode(email: string, code: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (key && from) {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Your OfCourse code',
        text: `Your OfCourse code is ${code}. It works for 10 minutes.`,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`Email provider refused the code email (${response.status})`)
    }
    return
  }
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[sign-in code] ${email}: ${code}`)
    return
  }
  throw new Error('No email provider: set RESEND_API_KEY and EMAIL_FROM.')
}
