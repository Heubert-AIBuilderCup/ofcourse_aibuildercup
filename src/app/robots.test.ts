import { describe, expect, it } from 'bun:test'
import robots from './robots'

// What crawlers may read (criterion 107, BR10): the live posts' and blogs' public pages and their
// images, never the admin, the signed-in feed or the API.

describe('robots.txt', () => {
  it('allows the public post and blog pages and keeps the admin, the feed and the API out', () => {
    const { rules } = robots()
    expect(rules).toMatchObject({
      userAgent: '*',
      allow: ['/posts/', '/blog/'],
      disallow: ['/admin', '/feed', '/api'],
    })
  })
})
