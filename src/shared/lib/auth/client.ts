import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// No baseURL: the auth routes are same-origin at /api/auth/*. Only the server needs BETTER_AUTH_URL.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] })

export const { signIn, signOut, useSession } = authClient

/**
 * The email codes: `emailOtp.sendVerificationOtp({ email, type: 'sign-in' })` sends one, and
 * `signIn.emailOtp({ email, otp })` signs in with it.
 */
export const emailOtp = authClient.emailOtp
