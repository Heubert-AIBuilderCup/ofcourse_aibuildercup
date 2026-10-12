/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, expect, it, mock } from 'bun:test'
import { cleanup, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { StoredAnswers } from '@/shared/types/student'
import { PANEL_COPY } from '../model/onboarding'
import { OnboardingAnswersProvider } from '../model/onboarding-answers'

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

function renderAt(path: string, answers: StoredAnswers = {}) {
  pathname = path
  return render(
    <OnboardingAnswersProvider answers={answers}>
      <OnboardingPanel />
    </OnboardingAnswersProvider>,
  )
}

const steps = () =>
  within(screen.getByRole('list', { name: 'Your steps' })).getAllByRole('listitem')

/** The band's six segments, and how many of them are lit (done or current). */
function segments(container: HTMLElement) {
  return {
    all: container.querySelectorAll('[data-lit]').length,
    lit: container.querySelectorAll('[data-lit="true"]').length,
  }
}

it('on the welcome lists every step, none current, step 00 optional, nothing lit', () => {
  const { container } = renderAt('/onboarding/welcome')
  expect(screen.getByRole('heading', { level: 2, name: 'Before we start' })).toBeInTheDocument()
  expect(
    screen.getByText("Here's the whole way through. Each step says why it asks."),
  ).toBeInTheDocument()
  const items = steps()
  expect(items).toHaveLength(6)
  for (const item of items) {
    expect(item).not.toHaveAttribute('aria-current')
    expect(item).not.toHaveTextContent('Done')
    expect(item).not.toHaveTextContent('Now')
  }
  expect(items[0]).toHaveTextContent('00Your comic characterOptional')
  expect(screen.getByText('Not started.')).toBeInTheDocument()
  expect(screen.getByText('Not started yet · about 6 min')).toBeInTheDocument()
  expect(screen.getByText('First: Your comic character')).toBeInTheDocument()
  expect(segments(container)).toEqual({ all: 6, lit: 0 })
})

it('lights the segments up to the current step', () => {
  expect(segments(renderAt('/onboarding/character').container)).toEqual({ all: 6, lit: 1 })
  cleanup()
  expect(segments(renderAt('/onboarding/facts/amount').container)).toEqual({ all: 6, lit: 2 })
})

it('on step 00 shows where she is: step 00 now, five short steps next', () => {
  renderAt('/onboarding/character')
  expect(screen.getByRole('heading', { level: 2, name: 'Five short steps' })).toBeInTheDocument()
  expect(screen.getByText(PANEL_COPY[0].lead)).toBeInTheDocument()
  const items = steps()
  expect(items).toHaveLength(6)
  expect(items[0]).toHaveAttribute('aria-current', 'step')
  expect(items[0]).toHaveTextContent('00Your comic characterNow · optional')
  for (const item of items) expect(item).not.toHaveTextContent('Done')
  expect(screen.getByText('Step 0 of 5.')).toBeInTheDocument()
  expect(screen.getByText('Now: Your comic character · optional')).toBeInTheDocument()
  expect(screen.getByText('Next: Facts about you')).toBeInTheDocument()
  expect(screen.getByText('From off course to “Of Course!”')).toBeInTheDocument()
})

it('on step 01 marks step 00 done and counts the question she is on', () => {
  renderAt('/onboarding/facts/amount')
  expect(screen.getByRole('heading', { level: 2, name: 'Five short steps' })).toBeInTheDocument()
  const items = steps()
  expect(items[0]).toHaveTextContent('Done')
  expect(items[0]).not.toHaveAttribute('aria-current')
  expect(items[1]).toHaveAttribute('aria-current', 'step')
  expect(items[1]).toHaveTextContent('Now · 2/11')
  expect(screen.getByText('Step 1 of 5.')).toBeInTheDocument()
  expect(screen.getByText('Now: 01 Facts about you · 2 of 11')).toBeInTheDocument()
  expect(screen.getByText("Next: What you'd study")).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: 'Getting started' })).not.toHaveTextContent(
    'recommended',
  )
})

it('stays light in a dark page: the panel is marked data-theme="light"', () => {
  renderAt('/onboarding/character')
  expect(screen.getByRole('complementary', { name: 'Getting started' })).toHaveAttribute(
    'data-theme',
    'light',
  )
})

it('on step 01 with no question reads as the first', () => {
  renderAt('/onboarding/facts')
  expect(steps()[1]).toHaveTextContent('Now · 1/11')
})

it('on step 02 marks steps 00 and 01 done and counts the question she is on', () => {
  const { container } = renderAt('/onboarding/study/know')
  expect(screen.getByRole('heading', { level: 2, name: 'Five short steps' })).toBeInTheDocument()
  const items = steps()
  expect(items[0]).toHaveTextContent('Done')
  expect(items[1]).toHaveTextContent('Done')
  expect(items[2]).toHaveAttribute('aria-current', 'step')
  expect(items[2]).toHaveTextContent('Now · 1/4')
  expect(screen.getByText('Step 2 of 5.')).toBeInTheDocument()
  expect(screen.getByText("Now: 02 What you'd study · 1 of 4")).toBeInTheDocument()
  expect(screen.getByText("Next: Where and how you'd live")).toBeInTheDocument()
  expect(segments(container)).toEqual({ all: 6, lit: 3 })
})

it('on step 02 counts the questions her first answer asks', () => {
  renderAt('/onboarding/study/areas', {
    know: { value: "A few areas I'm drawn to", state: 'stated' },
  })
  expect(steps()[2]).toHaveTextContent('Now · 2/5')
  expect(screen.getByText("Now: 02 What you'd study · 2 of 5")).toBeInTheDocument()
})

it('on step 03 marks steps 00 to 02 done and counts the question she is on', () => {
  const { container } = renderAt('/onboarding/living/know-anyone', {
    community: { value: 'Yes', state: 'stated' },
  })
  expect(screen.getByRole('heading', { level: 2, name: 'Five short steps' })).toBeInTheDocument()
  const items = steps()
  for (const done of items.slice(0, 3)) expect(done).toHaveTextContent('Done')
  expect(items[3]).toHaveAttribute('aria-current', 'step')
  expect(items[3]).toHaveTextContent('Now · 4/5')
  expect(screen.getByText('Step 3 of 5.')).toBeInTheDocument()
  expect(screen.getByText("Now: 03 Where and how you'd live · 4 of 5")).toBeInTheDocument()
  expect(screen.getByText('Next: After you graduate')).toBeInTheDocument()
  expect(segments(container)).toEqual({ all: 6, lit: 4 })
})

it('on step 04 marks steps 00 to 03 done and counts the question she is on', () => {
  const { container } = renderAt('/onboarding/after/focus')
  const items = steps()
  for (const done of items.slice(0, 4)) expect(done).toHaveTextContent('Done')
  expect(items[4]).toHaveAttribute('aria-current', 'step')
  expect(items[4]).toHaveTextContent('Now · 2/4')
  expect(screen.getByText('Step 4 of 5.')).toBeInTheDocument()
  expect(screen.getByText('Now: 04 After you graduate · 2 of 4')).toBeInTheDocument()
  expect(screen.getByText('Next: Your attention · optional')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Five short steps' })).toBeInTheDocument()
  expect(segments(container)).toEqual({ all: 6, lit: 5 })
})

for (const path of ['/onboarding/attention', '/onboarding/done']) {
  it(`at ${path} reads as the last step: 00 to 04 done, 05 now and optional, all lit`, () => {
    const { container } = renderAt(path)
    expect(screen.getByRole('heading', { level: 2, name: 'The last step' })).toBeInTheDocument()
    expect(screen.getByText(PANEL_COPY[5].lead)).toBeInTheDocument()
    const items = steps()
    expect(items).toHaveLength(6)
    for (const done of items.slice(0, 5)) expect(done).toHaveTextContent('Done')
    expect(items[5]).toHaveAttribute('aria-current', 'step')
    expect(items[5]).toHaveTextContent('05Your attentionNow · optional')
    expect(screen.getByText('Step 5 of 5.')).toBeInTheDocument()
    expect(screen.getByText('Now: 05 Your attention · optional')).toBeInTheDocument()
    expect(screen.getByText("Then: you're all set")).toBeInTheDocument()
    expect(segments(container)).toEqual({ all: 6, lit: 6 })
  })
}
