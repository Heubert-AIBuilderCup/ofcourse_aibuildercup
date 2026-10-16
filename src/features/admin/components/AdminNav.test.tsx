/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'

let pathname = '/admin/users'
mock.module('next/navigation', () => ({ ...navigation, usePathname: () => pathname }))

const { AdminNav } = await import('./AdminNav')

afterEach(cleanup)

it('links every section a superadmin may open and marks the current one', () => {
  pathname = '/admin/users'
  render(<AdminNav viewer={{ role: 'superadmin' }} />)
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  expect(nav.querySelectorAll('a')).toHaveLength(7)
  expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Board' })).not.toHaveAttribute('aria-current')
})

it('keeps the section marked on its sub-pages', () => {
  pathname = '/admin/users/u1'
  render(<AdminNav viewer={{ role: 'admin' }} />)
  expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page')
})

it('shows an editor the Board and Comic gaps, without a Users link', () => {
  pathname = '/admin/board'
  render(<AdminNav viewer={{ role: 'user', editor: true }} />)
  const nav = screen.getByRole('navigation', { name: 'Admin sections' })
  expect(nav.querySelectorAll('a')).toHaveLength(5)
  expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('link', { name: 'Users' })).toBeNull()
})
