import { describe, expect, it, mock } from 'bun:test'
import { NextRequest } from 'next/server'
import { ADMIN_PATH, APP_PATHS, BLOG_PATH, POSTS_PATH } from '@/shared/lib/auth/gate'

// The proxy's matcher: the signed-in paths (APP_PATHS), the admin, and the public post pages, which
// it only rate-limits (criterion 107); every other page stays public without a cookie: the sitemap
// and robots.txt. The proxy reads the session only under /admin; nothing here reaches it.

// The real module, as email-code-rate-limit.test.ts loads it: building auth opens no connection.
mock.module('server-only', () => ({}))
const { config, default: proxy } = await import('./proxy')

/** "/feed/:path*" covers /feed and everything under it. */
const prefixOf = (matcher: string) => matcher.replace(/\/:path\*$/, '')
const covered = (pathname: string) =>
  config.matcher
    .map(prefixOf)
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

describe('proxy matcher', () => {
  it('is the signed-in paths, the admin and the public post and blog pages, kept in step with APP_PATHS', () => {
    expect(config.matcher.map(prefixOf).sort()).toEqual(
      [...APP_PATHS, ADMIN_PATH, POSTS_PATH, BLOG_PATH].sort(),
    )
  })

  it('leaves the sitemap and robots.txt alone (107)', () => {
    for (const path of ['/sitemap.xml', '/robots.txt']) expect(covered(path)).toBe(false)
    expect(covered(`${POSTS_PATH}/assets/abc`)).toBe(true)
    expect(covered('/feed/abc')).toBe(true)
  })
})

describe('the public blog pages under the proxy (BR9, BR10)', () => {
  const request = (path: string, address: string) =>
    new NextRequest(`http://localhost:3000${path}`, { headers: { 'x-forwarded-for': address } })

  it('lets a visitor with no session through to a blog and its pictures, never to sign in', async () => {
    for (const path of [`${BLOG_PATH}/how-many-hours`, `${BLOG_PATH}/assets/a_1`]) {
      const res = await proxy(request(path, '203.0.113.10'))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    }
  })

  it('counts blog pages with the post pages, and refuses past 60 a minute from one address', async () => {
    const address = '203.0.113.11'
    for (let i = 0; i < 30; i++) {
      expect((await proxy(request(`${POSTS_PATH}/post-${i}`, address))).status).toBe(200)
      expect((await proxy(request(`${BLOG_PATH}/blog-${i}`, address))).status).toBe(200)
    }
    const refused = await proxy(request(`${BLOG_PATH}/one-more`, address))
    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await proxy(request(`${BLOG_PATH}/assets/a_1`, address))).status).toBe(200)
  })

  it("sends a visitor with no session from a blog's page in the feed to sign in (BR11)", async () => {
    const res = await proxy(request('/feed/blog/b1', '203.0.113.12'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/')
  })
})

describe('the public post pages under the proxy (107)', () => {
  const request = (path: string, address: string) =>
    new NextRequest(`http://localhost:3000${path}`, { headers: { 'x-forwarded-for': address } })

  it('lets a visitor with no session through, never to sign in', async () => {
    const res = await proxy(request(`${POSTS_PATH}/paid-work-in-the-feed`, '203.0.113.1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('answers 429 with Retry-After past 60 requests a minute from one address; pages and images count apart', async () => {
    const address = '203.0.113.2'
    for (let i = 0; i < 60; i++) {
      expect((await proxy(request(`${POSTS_PATH}/post-${i}`, address))).status).toBe(200)
    }
    const refused = await proxy(request(`${POSTS_PATH}/one-more`, address))
    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0)
    // The images have their own count, and another address its own.
    expect((await proxy(request(`${POSTS_PATH}/assets/a_1`, address))).status).toBe(200)
    expect((await proxy(request(`${POSTS_PATH}/one-more`, '203.0.113.3'))).status).toBe(200)
  })
})
