import { expect, test } from 'bun:test'

import { buttonVariants } from './button'

// DESIGN.md: plain primary is 3.7:1 on the background, too low for a 14px label.
// The filled button uses the primary-strong shade, which passes 4.5:1.
test('the default (filled) button uses the primary-strong tokens, not plain primary', () => {
  const classes = buttonVariants({ variant: 'default' }).split(/\s+/)
  expect(classes).toContain('bg-primary-strong')
  expect(classes).toContain('text-primary-strong-foreground')
  expect(classes).not.toContain('bg-primary')
  expect(classes).not.toContain('text-primary-foreground')
})
