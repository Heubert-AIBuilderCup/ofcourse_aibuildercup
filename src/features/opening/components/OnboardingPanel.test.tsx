/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock } from 'bun:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { PANEL_COPY } from '../model/onboarding'

let pathname = '/onboarding/character'
mock.module('next/navigation', () => ({
  ...navigation,
  usePathname: () => pathname,
}))

const { OnboardingPanel } = await import('./OnboardingPanel')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

afterEach(cleanup)

function renderAt(path: string) {
  pathname = path
  return render(<OnboardingPanel />)
}

const steps = () =>
  within(screen.getByRole('list', { name: 'Your steps' })).getAllByRole('listitem')

it('on step 00 shows where she is: step 00 now, six short steps next', () => {
  renderAt('/onboarding/character')
  expect(screen.getByRole('heading', { level: 2, name: 'Before we start' })).toBeInTheDocument()
  expect(screen.getByText(PANEL_COPY[0].lead)).toBeInTheDocument()
  const items = steps()
  expect(items).toHaveLength(7)
  expect(items[0]).toHaveAttribute('aria-current', 'step')
  expect(items[0]).toHaveTextContent('00Your comic characterNow · optional')
  for (const item of items) expect(item).not.toHaveTextContent('Done')
  expect(screen.getByText('Step 0 of 6.')).toBeInTheDocument()
  expect(screen.getByText('Now: Your comic character · optional')).toBeInTheDocument()
  expect(screen.getByText('Next: Facts about you')).toBeInTheDocument()
  expect(screen.getByText('From off course to “Of Course!”')).toBeInTheDocument()
})

it('on step 01 marks step 00 done and counts the question she is on', () => {
  renderAt('/onboarding/facts/amount')
  expect(screen.getByRole('heading', { level: 2, name: 'Six short steps' })).toBeInTheDocument()
  const items = steps()
  expect(items[0]).toHaveTextContent('Done')
  expect(items[0]).not.toHaveAttribute('aria-current')
  expect(items[1]).toHaveAttribute('aria-current', 'step')
  expect(items[1]).toHaveTextContent('Now · 2/11')
  expect(screen.getByText('Step 1 of 6.')).toBeInTheDocument()
  expect(screen.getByText('Now: 01 Facts about you · 2 of 11')).toBeInTheDocument()
  expect(screen.getByText("Next: What you'd study")).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: 'Getting started' })).not.toHaveTextContent(
    'recommended',
  )
})

it('on step 01 with no question reads as the first', () => {
  renderAt('/onboarding/facts')
  expect(steps()[1]).toHaveTextContent('Now · 1/11')
})
