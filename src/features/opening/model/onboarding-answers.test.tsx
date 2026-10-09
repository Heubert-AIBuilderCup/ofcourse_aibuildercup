/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { StoredAnswers } from '@/shared/types/student'
import { OnboardingAnswersProvider, useOnboardingAnswers } from './onboarding-answers'

afterEach(cleanup)

const stated: StoredAnswers = { know: { value: "A few areas I'm drawn to", state: 'stated' } }

/** Shows the answered keys under a name, so two consumers can be told apart. */
function Reader({ name }: { name: string }) {
  const [answers] = useOnboardingAnswers()
  return <p data-testid={name}>{Object.keys(answers).join(',') || 'none'}</p>
}

function Setter() {
  const [, setAnswers] = useOnboardingAnswers()
  return (
    <button
      type="button"
      onClick={() => setAnswers((prev) => ({ ...prev, amount: { value: 36, state: 'stated' } }))}
    >
      tap
    </button>
  )
}

describe('OnboardingAnswersProvider', () => {
  it('gives a consumer the answers it was given', () => {
    render(
      <OnboardingAnswersProvider answers={stated}>
        <Reader name="panel" />
      </OnboardingAnswersProvider>,
    )
    expect(screen.getByTestId('panel')).toHaveTextContent('know')
  })

  it('re-renders a second consumer when the first sets the answers', () => {
    render(
      <OnboardingAnswersProvider answers={{}}>
        <Reader name="panel" />
        <Setter />
      </OnboardingAnswersProvider>,
    )
    expect(screen.getByTestId('panel')).toHaveTextContent('none')
    act(() => screen.getByRole('button', { name: 'tap' }).click())
    expect(screen.getByTestId('panel')).toHaveTextContent('amount')
  })

  it('keeps what she has tapped when the layout feeds it new answers', () => {
    const view = render(
      <OnboardingAnswersProvider answers={{}}>
        <Reader name="panel" />
        <Setter />
      </OnboardingAnswersProvider>,
    )
    act(() => screen.getByRole('button', { name: 'tap' }).click())
    view.rerender(
      <OnboardingAnswersProvider answers={stated}>
        <Reader name="panel" />
        <Setter />
      </OnboardingAnswersProvider>,
    )
    expect(screen.getByTestId('panel')).toHaveTextContent('amount')
    expect(screen.getByTestId('panel')).not.toHaveTextContent('know')
  })
})

describe('useOnboardingAnswers', () => {
  it('throws outside an OnboardingAnswersProvider', () => {
    // React logs the error it rethrows; keep the test output clean.
    const log = spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Reader name="panel" />)).toThrow(/OnboardingAnswersProvider/)
    log.mockRestore()
  })
})
