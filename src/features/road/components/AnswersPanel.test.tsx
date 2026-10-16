/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Relative, StoredAnswers } from '@/shared/types/student'

mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}))
mock.module('@/shared/lib/theme-actions', () => ({ setThemeChoice: async () => {} }))

const { answerGroups } = await import('@/features/opening')
const { getRoad } = await import('../model/road-data')
const { AnswersPanel } = await import('./AnswersPanel')

const road = getRoad()
const CYBER = 'cyber-security-ecu-perth'
const SAVED: StoredAnswers = {
  amount: { value: 36, state: 'stated' },
  eng: { value: 'IELTS 7.0', state: 'stated' },
  community: { value: 'Yes', state: 'stated' },
  knows: { value: 'Yes', state: 'stated' },
}
const ANJALI: Relative = {
  placeId: 'cannington',
  place: 'Cannington, Perth',
  relationship: 'Cousin',
  name: 'Anjali',
}

const onPreview = mock((_prev: Record<string, string>) => {})
const onSave = mock((_answers: StoredAnswers) => {})
const onClose = mock(() => {})
const onCreate = mock((_answers: StoredAnswers) => {})
const onCancel = mock(() => {})

afterEach(() => {
  cleanup()
  for (const fn of [onPreview, onSave, onClose, onCreate, onCancel]) fn.mockClear()
})

const panel = () =>
  render(
    <AnswersPanel
      road={road}
      answers={SAVED}
      groupsFor={(a) => answerGroups(a, ANJALI)}
      onPreview={onPreview}
      onSave={onSave}
      onClose={onClose}
    />,
  )

const click = (el: HTMLElement) =>
  act(() => {
    fireEvent.click(el)
  })
/** A row's button, by the question it starts with. */
const rowButton = (question: string) =>
  screen.getByRole('button', { name: new RegExp(`^${question.replace(/[()?]/g, '\\$&')}`) })
const rowOf = (question: string) => rowButton(question).closest('li') as HTMLElement
const AMOUNT = 'Your budget per year · Amount'
const ENGLISH = 'Your qualifications and scores · English test'
const KNOW = 'Do you know what you want to study?'
const FIELD = 'Which field?'
const COMMUNITY = 'Does a community of similar culture, or relatives nearby, matter?'
const pick = (question: string, option: RegExp) =>
  click(
    within(screen.getByRole('radiogroup', { name: question })).getByRole('radio', {
      name: option,
    }),
  )

describe('the panel', () => {
  it('lists the four steps whose questions draw the board, each with its rows and their answers', () => {
    panel()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      '01Facts about you',
      "02What you'd study",
      "03Where and how you'd live",
      '04After you graduate',
    ])
    expect(rowButton(AMOUNT)).toHaveTextContent('AUD 36k')
    expect(rowButton(AMOUNT)).toHaveAttribute('aria-expanded', 'false')
  })

  it('Change opens a row’s options, named by its question, with her answer checked', async () => {
    panel()
    await click(rowButton(AMOUNT))
    expect(rowButton(AMOUNT)).toHaveAttribute('aria-expanded', 'true')
    const group = screen.getByRole('radiogroup', { name: AMOUNT })
    expect(within(group).getByRole('radio', { name: /^AUD 36k/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(group).getByRole('radio', { name: /^AUD 30k/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('a new pick is not saved: the row says so, the panel says what would move, the map previews it', async () => {
    panel()
    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    expect(within(rowOf(AMOUNT)).getByText('Not saved')).toBeInTheDocument()
    expect(screen.getByText('If you save, on your roadmap')).toBeInTheDocument()
    expect(screen.getByText('Perth is marked as a stretch on your budget.')).toBeInTheDocument()
    expect(screen.getByText('Cyber Security goes AUD 3.5k a year over it.')).toBeInTheDocument()
    expect(onPreview).toHaveBeenLastCalledWith({
      perth: 'A stretch on your budget',
      [CYBER]: 'AUD 3.5k a year over budget',
    })
    expect(screen.getByText('1 change not saved')).toBeInTheDocument()

    // Her answer again: nothing waits.
    await pick(AMOUNT, /^AUD 36k/)
    expect(within(rowOf(AMOUNT)).queryByText('Not saved')).not.toBeInTheDocument()
    expect(screen.queryByText('If you save, on your roadmap')).not.toBeInTheDocument()
    expect(screen.queryByText('1 change not saved')).not.toBeInTheDocument()
    expect(onPreview).toHaveBeenLastCalledWith({})
  })

  it('takes an exact score for the English test, waits unsaved, and refuses one out of range', async () => {
    panel()
    await click(rowButton(ENGLISH))
    await click(screen.getByRole('button', { name: 'Enter my exact score' }))
    act(() => {
      fireEvent.change(screen.getByLabelText('Test'), { target: { value: 'PTE' } })
      fireEvent.change(screen.getByLabelText('Score'), { target: { value: '95' } })
    })
    await click(screen.getByRole('button', { name: 'Use this score' }))
    expect(screen.getByRole('alert').textContent).toBe('Enter a PTE Academic score from 10 to 90.')
    expect(screen.queryByText('1 change not saved')).toBeNull()

    act(() => {
      fireEvent.change(screen.getByLabelText('Score'), { target: { value: '58' } })
    })
    await click(screen.getByRole('button', { name: 'Use this score' }))
    expect(rowOf(ENGLISH).textContent).toContain('PTE 58')
    await click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith({ ...SAVED, eng: { value: 'PTE 58', state: 'stated' } })
  })

  it('changes wait together, and Save sends her answers with them merged in', async () => {
    panel()
    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    await click(rowButton(ENGLISH))
    await pick(ENGLISH, /^Not taken yet/)
    expect(screen.getByText('2 changes not saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()

    await click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith({
      ...SAVED,
      amount: { value: 30, state: 'stated' },
      eng: { value: 'Not taken yet', state: 'stated' },
    })
    expect(within(rowOf(AMOUNT)).getByText('Changed just now')).toBeInTheDocument()
    expect(within(rowOf(ENGLISH)).getByText('Changed just now')).toBeInTheDocument()
    expect(screen.queryByText(/not saved$/)).not.toBeInTheDocument()
  })

  it('closing with a change asks first; Keep editing stays, Discard closes and clears', async () => {
    panel()
    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    await click(screen.getByRole('button', { name: 'Close' }))
    const ask = screen.getByRole('alertdialog', { name: 'Discard 1 change?' })
    expect(within(ask).getByText('Your answers and your roadmap stay as they are.')).toBeVisible()
    expect(onClose).not.toHaveBeenCalled()

    await click(within(ask).getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(within(rowOf(AMOUNT)).getByText('Not saved')).toBeInTheDocument()

    await click(screen.getByRole('button', { name: 'Close' }))
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPreview).toHaveBeenLastCalledWith({})
    expect(within(rowOf(AMOUNT)).queryByText('Not saved')).not.toBeInTheDocument()
  })

  it('closes at once with nothing changed', async () => {
    panel()
    await click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('a pick that no longer asks a question hides it, and Save drops its answer', async () => {
    panel()
    await click(rowButton(COMMUNITY))
    await pick(COMMUNITY, /^No$/)
    expect(screen.queryByRole('button', { name: /^Do you know anyone/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Who, and where?')).not.toBeInTheDocument()
    expect(screen.getByText('1 change not saved')).toBeInTheDocument()
    await click(screen.getByRole('button', { name: 'Save changes' }))
    const { knows: _, ...rest } = SAVED
    expect(onSave).toHaveBeenCalledWith({ ...rest, community: { value: 'No', state: 'stated' } })
  })

  it('a pick on a follow-up waits only while the pick that asks it does', async () => {
    panel()
    await click(rowButton(KNOW))
    await pick(KNOW, /^Something particular/)
    await click(rowButton(FIELD))
    await pick(FIELD, /^Cyber security/)
    expect(screen.getByText('2 changes not saved')).toBeInTheDocument()
    // Her answer again: the field is no longer asked, so its pick goes too.
    await click(rowButton(KNOW))
    await pick(KNOW, /^Not sure/)
    expect(screen.queryByText(/not saved$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Which field\?/ })).not.toBeInTheDocument()
  })

  it('asks a question with many options from a select, not cards', async () => {
    panel()
    const WHERE = 'Where are you right now?'
    await click(rowButton(WHERE))
    expect(screen.queryByRole('radiogroup', { name: WHERE })).not.toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: WHERE })
    expect(select).toHaveTextContent('Not sure')
    await click(select)
    await click(screen.getByRole('option', { name: 'India' }))
    expect(within(rowOf(WHERE)).getByText('Not saved')).toBeInTheDocument()
    await click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith({ ...SAVED, where: { value: 'India', state: 'stated' } })
  })

  it('shows her person without a Change', () => {
    panel()
    const row = screen.getByText('Who, and where?').closest('li') as HTMLElement
    expect(row).toHaveTextContent('Anjali, cousin · Cannington, Perth')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('the draft of a copy', () => {
  const draft = () =>
    render(
      <AnswersPanel
        mode="draft"
        copyOf="Cyber Security in Perth"
        road={road}
        answers={SAVED}
        groupsFor={(a) => answerGroups(a, ANJALI)}
        onPreview={onPreview}
        onCreate={onCreate}
        onCancel={onCancel}
      />,
    )
  const create = () => screen.getByRole('button', { name: 'Create roadmap' })
  const cancel = () => screen.getByRole('button', { name: 'Cancel' })

  it('is a new roadmap, a copy of its source, that starts with the same answers', () => {
    draft()
    expect(screen.getByText('New roadmap · a copy of Cyber Security in Perth')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Change any answers')
    expect(
      screen.getByText(
        'It starts with the same answers. Change one or more; the map shows what would be different before you create it.',
      ),
    ).toBeInTheDocument()
    expect(rowButton(AMOUNT)).toHaveTextContent('AUD 36k')
  })

  it('the bar is always there; Create waits for a change, then counts them', async () => {
    draft()
    expect(screen.getByText('Change at least one answer')).toBeInTheDocument()
    expect(cancel()).toBeInTheDocument()
    expect(create()).toHaveAttribute('aria-disabled', 'true')
    await click(create())
    expect(onCreate).not.toHaveBeenCalled()

    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    expect(screen.getByText('1 answer changed')).toBeInTheDocument()
    expect(create()).not.toHaveAttribute('aria-disabled', 'true')
    await click(rowButton(ENGLISH))
    await pick(ENGLISH, /^Not taken yet/)
    expect(screen.getByText('2 answers changed')).toBeInTheDocument()
  })

  it('Create sends the source’s answers with the changes merged in', async () => {
    draft()
    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    await click(create())
    expect(onCreate).toHaveBeenCalledWith({ ...SAVED, amount: { value: 30, state: 'stated' } })
  })

  it('a pick that asks a follow-up shows it at once, and Create sends both', async () => {
    draft()
    expect(screen.queryByRole('button', { name: /^Which field\?/ })).not.toBeInTheDocument()
    await click(rowButton(KNOW))
    await pick(KNOW, /^Something particular/)
    await click(rowButton(FIELD))
    await pick(FIELD, /^Cyber security/)
    expect(screen.getByText('2 answers changed')).toBeInTheDocument()
    await click(create())
    expect(onCreate).toHaveBeenCalledWith({
      ...SAVED,
      know: { value: 'Something particular', state: 'stated' },
      field: { value: 'Cyber security', state: 'stated' },
    })
  })

  it('with nothing changed, Close and Cancel leave at once', async () => {
    draft()
    await click(cancel())
    await click(screen.getByRole('button', { name: 'Close' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('Close or Cancel with a change asks first; Keep editing stays, Discard cancels', async () => {
    draft()
    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    await click(screen.getByRole('button', { name: 'Close' }))
    const ask = screen.getByRole('alertdialog', { name: 'Discard this new roadmap?' })
    expect(
      within(ask).getByText('Nothing is created. Your other roadmaps stay as they are.'),
    ).toBeVisible()
    await click(within(ask).getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()

    await click(cancel())
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('the draft from scratch', () => {
  const scratch = () =>
    render(
      <AnswersPanel
        mode="draft"
        copyOf={null}
        road={road}
        answers={{}}
        groupsFor={(a) => answerGroups(a, null)}
        onPreview={onPreview}
        onCreate={onCreate}
        onCancel={onCancel}
      />,
    )
  const create = () => screen.getByRole('button', { name: 'Create roadmap' })

  it('is a new roadmap with no answers, every question open to answer', () => {
    scratch()
    expect(screen.getByText('New roadmap · from scratch')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Answer the questions')
    expect(
      screen.getByText('Start with no answers. Each one you give draws more of the map.'),
    ).toBeInTheDocument()
    const questions = screen.getAllByRole('button', { expanded: false })
    expect(questions.length).toBeGreaterThan(5)
    for (const row of questions) expect(row).toHaveTextContent(/Answer now$/)
  })

  it('Create waits for one answer, then sends only what she answered', async () => {
    scratch()
    expect(screen.getByText('Answer at least one question')).toBeInTheDocument()
    expect(create()).toHaveAttribute('aria-disabled', 'true')
    await click(create())
    expect(onCreate).not.toHaveBeenCalled()

    await click(rowButton(AMOUNT))
    await pick(AMOUNT, /^AUD 30k/)
    expect(screen.getByText('1 answer given')).toBeInTheDocument()
    expect(create()).not.toHaveAttribute('aria-disabled', 'true')
    await click(create())
    expect(onCreate).toHaveBeenCalledWith({ amount: { value: 30, state: 'stated' } })
  })
})
