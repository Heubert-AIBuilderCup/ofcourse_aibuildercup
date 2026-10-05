import { describe, expect, test } from 'bun:test'
import { GET } from './route'

// Better Auth sends a failed Google sign-in here with `?error=<code>&error_description=<text>`.
const call = (query: string) => GET(new Request(`http://localhost/signin-error${query}`))

// The page a response redirects to: it must be a redirect, and only its target is read.
function redirectTarget(res: Response): string {
  expect(res.status).toBeGreaterThanOrEqual(300)
  expect(res.status).toBeLessThan(400)
  return res.headers.get('location') ?? ''
}

describe('/signin-error', () => {
  test('a sign-in refused for a suspended account goes to the suspended page', async () => {
    const res = await call('?error=ACCOUNT_SUSPENDED&error_description=This+account+is+suspended.')
    expect(redirectTarget(res)).toEndWith('/suspended')
  })

  test('any other failed sign-in goes back to the welcome page with its message', async () => {
    expect(redirectTarget(await call('?error=invalid_code'))).toEndWith('/?error=signin')
    expect(redirectTarget(await call(''))).toEndWith('/?error=signin')
  })
})
