/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'

afterEach(cleanup)

it('greets her by first name', () => {
  render(<WelcomeScreen firstName="Sita" />)
  expect(screen.getByText('Welcome, Sita.')).toBeInTheDocument()
})

it('says "Welcome." when the account has no name', () => {
  render(<WelcomeScreen firstName="" />)
  expect(screen.getByText('Welcome.')).toBeInTheDocument()
  expect(screen.queryByText(/Welcome,/)).not.toBeInTheDocument()
})

it('offers Start to step 00 with no Back and no Skip', () => {
  render(<WelcomeScreen firstName="Sita" />)
  expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute(
    'href',
    '/onboarding/character',
  )
  expect(screen.queryByRole('link', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Skip' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
})

it('puts focus on the heading when it opens', () => {
  render(<WelcomeScreen firstName="Sita" />)
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
})
