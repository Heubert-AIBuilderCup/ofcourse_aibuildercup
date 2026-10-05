import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/shared/lib/auth'

// Better Auth's own endpoints (Google sign-in, callback, session, sign-out); it checks origin and state.
export const { GET, POST } = toNextJsHandler(auth)
