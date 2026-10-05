/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'

let pathname = '/admin/users'
mock.module('next/navigation', () => ({ ...navigation, usePathname: () => pathname }))

const { AdminNav } = await import('./AdminNav')

afterEach(cleanup)

it('links every admin section and marks the current one', () => {
  render(<AdminNav />)
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  expect(nav.querySelectorAll('a')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
})

it('keeps the section marked on its sub-pages', () => {
  pathname = '/admin/users/u1'
  render(<AdminNav />)
  expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
})
