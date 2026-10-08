/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ComponentProps } from 'react'
import * as sonner from 'sonner'
import { ANJALI, buildFutures, PRIYA_ANSWERS } from '@/features/engine'
import type { ActionResult } from '@/shared/types/action-result'
import type { StoredAnswers } from '@/shared/types/student'

const saved = async (_: unknown): Promise<ActionResult> => ({ ok: true })
const saveAnswersAction = mock(saved)
const addReminderAction = mock(saved)

// Spies that still reach the real toaster: a module mock outlives this file, and later files
// render sonner's <Toaster /> and read what it shows.
const realToast = sonner.toast
const toast = Object.assign(
  mock((...args: Parameters<typeof realToast>) => realToast(...args)),
  realToast,
  { success: mock((...args: Parameters<typeof realToast.success>) => realToast.success(...args)) },
)
mock.module('sonner', () => ({ ...sonner, toast }))

// Sign out's router; there is no app router in a component test.
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

const { FuturesScreen } = await import('./FuturesScreen')

// next/image resolves its src against the page's URL in development; happy-dom starts on
// about:blank, which cannot be a base.
const dom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
const startUrl = location.href
beforeAll(() => dom.setURL('http://localhost:3000/'))
afterAll(() => dom.setURL(startUrl))

afterEach(() => {
  cleanup()
  for (const action of [saveAnswersAction, addReminderAction]) {
    action.mockReset()
    action.mockImplementation(saved)
  }
  toast.mockClear()
  toast.success.mockClear()
})

type Props = ComponentProps<typeof FuturesScreen>

const PRIYA = buildFutures({ answers: PRIYA_ANSWERS, relative: ANJALI })

function show(props: Partial<Props> = {}) {
  return render(
    <FuturesScreen
      initialAnswers={PRIYA_ANSWERS}
      relative={ANJALI}
      initial={PRIYA}
      coins={null}
      reminders={[]}
      returning={false}
      saveAnswersAction={saveAnswersAction}
      addReminderAction={addReminderAction}
      {...props}
    />,
  )
}

const press = (element: HTMLElement) =>
  act(async () => {
    fireEvent.click(element)
  })
const cards = () => screen.getAllByRole('article')
const ADELAIDE = 'Adelaide · Master of Cyber Security, UniSA · 491 regional visa, then PR'
const BUDGET_CHIP = 'Budget about AUD 30k a year'
const REDRAWN = 'Redrawn: budget about AUD 36k a year'

describe('the futures', () => {
  it('heads the screen and shows three futures, each built around one thing', () => {
    show()
    expect(screen.getByText('Step 5 of 6 · three futures, nothing ranked')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: "Here's what each would give you" }),
    ).toBeInTheDocument()
    for (const name of ['Built around cost', 'Built around staying', 'Built around career']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(cards()).toHaveLength(3)
    expect(screen.getByText(ADELAIDE)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Weighed from your answers, 0–3: Cost 2 · Time 2 · Work 2 · PR 3 · Location 3 · Career 3 · the heavier, the larger it’s drawn',
      ),
    ).toBeInTheDocument()
  })

  it('says it is home on a return visit', () => {
    show({ returning: true })
    expect(screen.getByText('Your three futures · nothing ranked')).toBeInTheDocument()
  })

  it('shows the six progress dots at step 5, first time and on a return visit (criterion 22)', () => {
    show()
    expect(screen.getByLabelText('Step 5 of 6')).toHaveAttribute('aria-valuenow', '5')
    cleanup()
    show({ returning: true })
    expect(screen.getByLabelText('Step 5 of 6')).toHaveAttribute('role', 'progressbar')
  })

  it('marks every line by shape and word', () => {
    show()
    expect(screen.getAllByText(/▲ Gives you/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/▼ Costs you/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/● Neutral/).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Strength 4 of 5').length).toBeGreaterThan(0)
  })

  it('says it is not sure about R1, once on each card that carries it', () => {
    show()
    if (PRIYA.kind !== 'futures') throw new Error('Expected futures')
    PRIYA.futures.forEach((future, i) => {
      const carries = future.lines.some((line) => line.claim.notSure)
      expect(within(cards()[i]).queryAllByText("We're not sure about this yet.")).toHaveLength(
        carries ? 1 : 0,
      )
    })
    expect(screen.getAllByText("We're not sure about this yet.")).toHaveLength(1)
  })

  it('shows how we know a claim: its detail, its source and its date', async () => {
    show()
    expect(screen.queryByText(/^Source: /)).not.toBeInTheDocument()
    const [first] = screen.getAllByRole('button', { name: 'How we know' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    await press(first)
    expect(screen.getByText('Source: UniSA 2027 fees page · mock · Sep 2026')).toBeInTheDocument()
    expect(screen.getByText('Tuition about AUD 27k a year in 2027')).toBeInTheDocument()
  })

  it('shows the distance from her person on each future', () => {
    show()
    expect(
      screen.getByText('Adelaide: a 3½-hour flight from Anjali in Perth · estimate'),
    ).toBeInTheDocument()
  })

  it('never ranks or recommends', () => {
    const { container } = show()
    expect(container.textContent).not.toMatch(/ranked 1st|\bbest\b|recommended/i)
    expect(
      screen.getByText(
        'Shown in no order. None of these is a ranking or a pick. Figures are mock.',
      ),
    ).toBeInTheDocument()
  })
})

describe('correcting a chip', () => {
  it('opens the question in place, redraws all three at once, saves, and undoes', async () => {
    saveAnswersAction.mockImplementation(() => new Promise<never>(() => {}))
    show()
    const [chip] = screen.getAllByRole('button', { name: BUDGET_CHIP })
    expect(screen.queryByText('Your budget per year. All three futures redraw.')).toBeNull()
    await press(chip)
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Your budget per year. All three futures redraw.')).toBeInTheDocument()

    // No reply from the server: the redraw is the browser's own.
    fireEvent.click(screen.getByRole('button', { name: 'AUD 36k' }))
    expect(
      screen.getByText('Fees about AUD 27k a year: within your budget, AUD 9k spare'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(REDRAWN)).toHaveLength(3)
    expect(screen.getAllByText('Changed with your answer').length).toBeGreaterThan(0)
    expect(screen.queryByText('Your budget per year. All three futures redraw.')).toBeNull()
    expect(saveAnswersAction).toHaveBeenCalledWith({ amount: 36 })

    const [message, options] = toast.mock.calls.at(-1) ?? []
    expect(message).toBe(REDRAWN)
    const action = options?.action as unknown as { label: string; onClick: () => void }
    expect(action.label).toBe('Undo')
    await act(async () => action.onClick())
    expect(
      screen.getByText('Fees about AUD 27k a year: within your budget, only AUD 3k spare'),
    ).toBeInTheDocument()
    expect(screen.queryByText(REDRAWN)).toBeNull()
    expect(saveAnswersAction).toHaveBeenLastCalledWith({
      amount: { value: 30, state: 'stated' },
    })
  })

  it('changes the field, saying she knows something particular', async () => {
    show()
    const [chip] = screen.getAllByRole('button', { name: 'Field: Cyber security' })
    await press(chip)
    expect(screen.getByText("What you'd study. All three futures redraw.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suggest me' })).toBeInTheDocument()
    await press(screen.getByRole('button', { name: 'Data science' }))
    expect(saveAnswersAction).toHaveBeenCalledWith({
      know: 'Something particular',
      field: 'Data science',
    })
    expect(screen.getAllByText('Redrawn: field: Data science').length).toBeGreaterThan(0)
  })

  it('shows a "Not sure" as an assumed chip on every future, and opens it in place', async () => {
    const answers: StoredAnswers = {
      ...PRIYA_ANSWERS,
      focus: { value: 'Career-focused', state: 'assumed' },
    }
    show({ initialAnswers: answers, initial: buildFutures({ answers, relative: ANJALI }) })
    for (const card of cards()) {
      expect(within(card).getByRole('button', { name: 'Assumed: Career-focused' })).toBeVisible()
    }
    await press(within(cards()[0]).getByRole('button', { name: 'Assumed: Career-focused' }))
    expect(
      screen.getByText('Career-focused or academic? All three futures redraw.'),
    ).toBeInTheDocument()
    expect(within(cards()[0]).getByRole('button', { name: 'Not sure' })).toBeInTheDocument()
    await press(within(cards()[0]).getByRole('button', { name: 'Academic' }))
    expect(saveAnswersAction).toHaveBeenCalledWith({ focus: 'Academic' })
  })

  it('shows no assumed chip for an answer she stated', () => {
    const answers: StoredAnswers = {
      ...PRIYA_ANSWERS,
      who: { value: 'Family', state: 'stated' },
      length: { value: 'As short as possible', state: 'stated' },
      dest: { value: 'Australia', state: 'stated' },
    }
    show({ initialAnswers: answers, initial: buildFutures({ answers, relative: ANJALI }) })
    expect(screen.queryByRole('button', { name: /^Assumed: / })).toBeNull()
  })

  it('says on each card that the field stands in for one the preview lacks, with its chip (criterion 44)', async () => {
    const answers: StoredAnswers = {
      ...PRIYA_ANSWERS,
      know: { value: "A few areas I'm drawn to", state: 'stated' },
      areas: { value: ['Health'], state: 'stated' },
      stay: { value: 'Not sure', state: 'stated' },
    }
    show({ initialAnswers: answers, initial: buildFutures({ answers, relative: ANJALI }) })
    const note = 'No health courses in this preview, so these use psychology.'
    expect(cards().length).toBeGreaterThan(0)
    for (const card of cards()) {
      expect(within(card).getByText(note)).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Areas: Health' })).toBeInTheDocument()
    }
    // Said on the cards, not again above them.
    expect(screen.getAllByText(note)).toHaveLength(cards().length)
    await press(within(cards()[0]).getByRole('button', { name: 'Areas: Health' }))
    expect(screen.getByText("What you'd study. All three futures redraw.")).toBeInTheDocument()
  })
  it('says the field note once above when no card shows', () => {
    const answers: StoredAnswers = {
      ...PRIYA_ANSWERS,
      know: { value: "A few areas I'm drawn to", state: 'stated' },
      areas: { value: ['Health'], state: 'stated' },
      stay: { value: 'Yes', state: 'stated' },
    }
    show({ initialAnswers: answers, initial: buildFutures({ answers, relative: ANJALI }) })
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    const note = screen.getByText('No health courses in this preview, so these use psychology.')
    expect(note.closest('[role="status"]')).not.toBeNull()
  })
})

describe('keeping options open', () => {
  it('saves a reminder for the future and its course, and says so', async () => {
    show()
    const [remind] = screen.getAllByRole('button', { name: 'Remind me' })
    await press(remind)
    expect(addReminderAction).toHaveBeenCalledWith({ futureId: 'cost', courseId: 'unisa-cyber' })
    expect(toast.success).toHaveBeenCalledWith(
      "Reminder saved. You'll see it in your feed once it's ready.",
    )
    const [set] = within(cards()[0]).getAllByRole('button', { name: 'Reminder set' })
    expect(set).toBeDisabled()
  })

  it('starts set when the reminder is already saved', () => {
    show({
      reminders: [
        {
          futureId: 'cost',
          courseId: 'unisa-cyber',
          text: 'Apply to two intakes (Feb and Jul 2027)',
          at: '2026-10-05T00:00:00.000Z',
        },
      ],
    })
    expect(within(cards()[0]).getByRole('button', { name: 'Reminder set' })).toBeDisabled()
    expect(within(cards()[1]).getByRole('button', { name: 'Remind me' })).toBeEnabled()
  })
})

describe('the weights plaque', () => {
  it('lists each weight with its reason', async () => {
    show()
    await press(screen.getByRole('button', { name: 'Your weights' }))
    const plaque = screen.getByRole('dialog', { name: 'Your weights' })
    expect(within(plaque).getByText("What you're weighing")).toBeInTheDocument()
    expect(
      within(plaque).getByText(
        'These shape what each future is drawn around. Nothing here says what to do.',
      ),
    ).toBeInTheDocument()
    expect(within(plaque).getByText('A rough budget: 2')).toBeInTheDocument()
    expect(
      within(plaque).getByText('Stay after: yes · 3 · routes with no PR path seal'),
    ).toBeInTheDocument()
  })
})

describe('sealed at a hard limit', () => {
  it('shows the nearest roads, drawn sealed, with how far over each is', () => {
    const answers: StoredAnswers = {
      ...PRIYA_ANSWERS,
      amount: { value: 24, state: 'stated' },
      hard: { value: 'Hard limit', state: 'stated' },
    }
    const { container } = show({
      initialAnswers: answers,
      initial: buildFutures({ answers, relative: ANJALI }),
    })
    expect(screen.getByText('Sealed at your hard limit')).toBeInTheDocument()
    expect(
      screen.getByText('Nothing in this preview fits AUD 24k a year. The nearest roads:'),
    ).toBeInTheDocument()
    expect(screen.getByText(ADELAIDE)).toBeInTheDocument()
    expect(screen.getByText('AUD 3k over your hard limit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Budget about AUD 24k a year' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A hard limit' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/ranked 1st|\bbest\b|recommended/i)
  })
})

describe('the way on', () => {
  it('goes back to screen 4 (criteria 30 and 62)', () => {
    show()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/onboarding/after')
  })

  it('offers the coins as optional before she has seen them', () => {
    show({ coins: null })
    expect(screen.getByRole('link', { name: 'Next: your attention · optional' })).toHaveAttribute(
      'href',
      '/attention',
    )
  })

  it('offers to spend the coins she put off', () => {
    show({ coins: { state: 'later' } })
    expect(screen.getByRole('link', { name: 'Spend your ten coins' })).toHaveAttribute(
      'href',
      '/attention',
    )
  })

  it('offers nothing once they are spent, and always lets her sign out', () => {
    show({ coins: { state: 'spent', piles: [2, 1, 1, 2, 1, 1, 1, 1], assumed: true } })
    expect(screen.queryByRole('link', { name: /attention|coins/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
