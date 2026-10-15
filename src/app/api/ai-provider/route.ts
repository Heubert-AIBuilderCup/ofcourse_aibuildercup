import { aiConfig } from '@/features/content/ai/config'
import { DEV_LOGIN_HEADER, devLoginAllowed } from '@/shared/lib/auth/dev-login'

/**
 * Development-only: which model provider this server runs, `{ provider: 'fake' | 'vertex' }`, so
 * the e2e specs refuse to run against a server that would spend real calls. Gated like the dev
 * login (src/app/api/dev-login): a 404 in production, without DEV_LOGIN_SECRET, or without the
 * `x-dev-login-secret` header carrying it.
 */
export async function GET(request: Request) {
  const allowed = devLoginAllowed(
    { nodeEnv: process.env.NODE_ENV, secret: process.env.DEV_LOGIN_SECRET },
    request.headers.get(DEV_LOGIN_HEADER),
  )
  if (!allowed) return new Response('Not Found', { status: 404 })
  return Response.json({ provider: aiConfig(process.env).provider })
}
