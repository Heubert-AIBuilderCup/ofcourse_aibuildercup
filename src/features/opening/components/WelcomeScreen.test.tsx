/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'

afterEach(cleanup)

const HEADING = 'About 10 minutes, then three futures'
const LEDE =
  "Your answers shape three futures you'll see at the end: what you'd study, where you'd live, and what could come after."
const POINTS = [
  [
    'Six short steps, one question at a time',
    'Everything saves as you go, so you can stop and pick up where you left off.',
  ],
  [
    'Each question says why it asks',
    "“Not sure” and Skip are always fine. I'll assume a sensible default and show it as a chip you can change.",
  ],
  [
    'Three futures, side by side',
    'Nothing is ranked or recommended. You compare them and decide what matters to you.',
  ],
] as const
const FIRST =
  'How your comic character is drawn. It only sets the drawing in the comics, and you can skip it.'

it('greets her by first name, says how long it takes and what the answers shape', () => {
  render(<WelcomeScreen firstName="Sita" />)
  expect(screen.getByText('Welcome, Sita.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: HEADING })).toBeInTheDocument()
  expect(screen.getByText(LEDE)).toBeInTheDocument()
})

it('says "Welcome." when the account has no name', () => {
  render(<WelcomeScreen firstName="" />)
  expect(screen.getByText('Welcome.')).toBeInTheDocument()
  expect(screen.queryByText(/Welcome,/)).not.toBeInTheDocument()
})

it('lists the three points, each with its title and text', () => {
  render(<WelcomeScreen firstName="Sita" />)
  const items = within(screen.getByRole('list', { name: 'How it works' })).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  POINTS.forEach(([title, text], n) => {
    expect(within(items[n]).getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    expect(within(items[n]).getByText(text)).toBeInTheDocument()
  })
})

it('notes what comes first, and offers Start to step 00 with no Back and no Skip', () => {
  render(<WelcomeScreen firstName="Sita" />)
  expect(screen.getByText('First · optional')).toBeInTheDocument()
  expect(screen.getByText(FIRST)).toBeInTheDocument()
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
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: HEADING }))
})
