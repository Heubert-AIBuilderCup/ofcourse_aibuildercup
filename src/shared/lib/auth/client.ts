import { createAuthClient } from 'better-auth/react'

// No baseURL: the auth routes are same-origin at /api/auth/*. Only the server needs BETTER_AUTH_URL.
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
