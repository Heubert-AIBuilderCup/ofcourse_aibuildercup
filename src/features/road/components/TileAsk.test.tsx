/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  ASK_CAPPED,
  ASK_FAILED,
  type AskReply,
  NO_DATA,
  type TileAsk as Suggested,
} from '@/features/roads/client'
import type { ActionResult } from '@/shared/types/action-result'
import { TileAsk } from './TileAsk'

const COUNSELLOR = 'A registered migration agent or your counsellor can answer this.'

const ASKS: Suggested[] = [
  {
    question: 'How much does it cost to live in Perth?',
    answer: 'The catalogue puts living costs in Perth at about AUD 24k a year.',
    source: { title: 'Rental report', date: 'Sep 2026' },
  },
  {
    question: 'Does Perth count as regional for visas?',
    answer: 'Perth counts as regional for visas.',
    source: { title: 'Visa list', date: 'Aug 2026' },
  },
  {
    question: 'Where can I work part-time in Perth?',
    answer: 'The catalogue lists retail work in Perth.',
    source: { title: 'OfCourse mock catalogue · mock', date: 'Sep 2026' },
  },
]

type Act = (roadmapId: string, tileId: string, question: string) => Promise<ActionResult<AskReply>>
const replying = (result: ActionResult<AskReply>) => mock<Act>(async () => result)

afterEach(cleanup)

const ask = (action: Act) =>
  render(<TileAsk roadmapId="rm-1" tileId="perth" asks={ASKS} action={action} />)

const click = (el: HTMLElement) =>
  act(() => {
    fireEvent.click(el)
  })
const box = () => screen.getByRole('textbox', { name: /your own question/i }) as HTMLInputElement
const send = () => screen.getByRole('button', { name: 'Ask' })
const type = (text: string) =>
  act(() => {
    fireEvent.change(box(), { target: { value: text } })
  })
const submit = async () => {
  await act(async () => {
    fireEvent.click(send())
  })
}
const suggested = (question: string) => screen.getByRole('button', { name: question })

describe('the suggested questions', () => {
  it('offers each as a button; a tap shows its answer and source, marked mock, with no call', async () => {
    const action = replying({ ok: true, kind: 'answered', reply: 'x', cited: [] })
    ask(action)
    for (const a of ASKS) expect(suggested(a.question)).toBeInTheDocument()
    expect(screen.queryByText(ASKS[0].answer)).toBeNull()

    await click(suggested(ASKS[0].question))
    const answer = screen.getByText(ASKS[0].answer)
    const shown = answer.closest('[data-answer]') as HTMLElement
    expect(shown).toHaveTextContent('Rental report')
    expect(shown).toHaveTextContent('Sep 2026')
    expect(shown).toHaveTextContent(/mock/i)
    expect(suggested(ASKS[0].question)).toHaveAttribute('aria-expanded', 'true')
    expect(action).not.toHaveBeenCalled()
  })
})

describe('with the student AI off (no action, criterion 81)', () => {
  it('offers the suggested questions and their answers, and no box for her own', async () => {
    const { container } = render(<TileAsk roadmapId="rm-1" tileId="perth" asks={ASKS} />)
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent)
    expect(buttons).toEqual(ASKS.map((a) => a.question))

    await click(suggested(ASKS[1].question))
    expect(container.querySelector('[data-answer]')?.textContent).toContain(ASKS[1].answer)

    expect(container.querySelectorAll('form').length).toBe(0)
    expect(container.querySelectorAll('input').length).toBe(0)
    expect(screen.queryAllByLabelText(/your own question/i).length).toBe(0)
    expect(container.textContent).not.toContain('Your own question')
  })
})

describe('a typed question', () => {
  it('sends her words once and shows the reply with the rows it cited', async () => {
    const action = replying({
      ok: true,
      kind: 'answered',
      reply: 'Living costs in Perth are about AUD 24k a year.',
      cited: [{ id: 'city-living', text: 'Living costs in Perth about AUD 24k a year (mock)' }],
    })
    ask(action)
    await type('Is Perth expensive?')
    await submit()
    expect(action).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledWith('rm-1', 'perth', 'Is Perth expensive?')
    expect(screen.getByText('Living costs in Perth are about AUD 24k a year.')).toBeInTheDocument()
    expect(
      screen.getByText('Living costs in Perth about AUD 24k a year (mock)'),
    ).toBeInTheDocument()
  })

  it('at the cap, says the limit is reached, and the suggested questions still answer', async () => {
    const action = replying({ ok: true, kind: 'capped', reply: ASK_CAPPED, cited: [] })
    ask(action)
    await type('One more?')
    await submit()
    expect(
      screen.getByText(
        "You've reached today's limit of questions. The suggested ones above still work.",
      ),
    ).toBeInTheDocument()
    await click(suggested(ASKS[1].question))
    expect(screen.getByText(ASKS[1].answer)).toBeInTheDocument()
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('when the model failed, shows its reply and keeps the suggested questions', async () => {
    ask(replying({ ok: true, kind: 'failed', reply: ASK_FAILED, cited: [] }))
    await type('Is it safe?')
    await submit()
    expect(screen.getByText(ASK_FAILED)).toBeInTheDocument()
    for (const a of ASKS) expect(suggested(a.question)).toBeInTheDocument()
  })

  const replyRegion = (container: HTMLElement) =>
    container.querySelector('[aria-live]') as HTMLElement

  it('when it has no data, follows the refusal with the suggested questions (criterion 70)', async () => {
    const { container } = ask(
      replying({ ok: true, kind: 'refused', reply: NO_DATA, cited: [], counsellor: false }),
    )
    await type('What is the weather like?')
    await submit()
    const region = replyRegion(container)
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe(
      `${NO_DATA}Try one of these:${ASKS.map((a) => a.question).join('')}`,
    )
    expect(region.querySelectorAll('button').length).toBe(ASKS.length)
    expect(region.textContent).not.toContain(COUNSELLOR)
  })

  it('adds the counsellor line when the question needs one (criterion 70)', async () => {
    const { container } = ask(
      replying({ ok: true, kind: 'refused', reply: NO_DATA, cited: [], counsellor: true }),
    )
    await type('Will my visa be approved?')
    await submit()
    const region = replyRegion(container)
    expect(region.textContent).toBe(
      `${NO_DATA}${COUNSELLOR}Try one of these:${ASKS.map((a) => a.question).join('')}`,
    )
    expect(region.querySelectorAll('button').length).toBe(ASKS.length)
  })

  it('a suggested question after the refusal answers there, with no call', async () => {
    const action = replying({ ok: true, kind: 'refused', reply: NO_DATA, cited: [] })
    const { container } = ask(action)
    await type('Anything?')
    await submit()
    const region = replyRegion(container)
    const second = Array.from(region.querySelectorAll('button'))[1] as HTMLElement
    await click(second)
    expect(second.getAttribute('aria-expanded')).toBe('true')
    expect(region.querySelector('[data-answer]')?.textContent).toContain(ASKS[1].answer)
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('gives no follow-up to an answer or a failure', async () => {
    const { container } = ask(replying({ ok: true, kind: 'failed', reply: ASK_FAILED, cited: [] }))
    await type('Is it safe?')
    await submit()
    expect(replyRegion(container).textContent).toBe(ASK_FAILED)
    expect(replyRegion(container).querySelectorAll('button').length).toBe(0)
  })

  it('when the action refuses, shows the failed message', async () => {
    ask(replying({ ok: false, error: 'Not found' }))
    await type('Is it safe?')
    await submit()
    expect(screen.getByText(ASK_FAILED)).toBeInTheDocument()
    expect(screen.queryByText('Not found')).toBeNull()
  })
})

describe('the box', () => {
  it('holds at most 300 characters', () => {
    ask(replying({ ok: true, kind: 'answered', reply: 'x', cited: [] }))
    expect(box().maxLength).toBe(300)
  })

  it('cannot send when empty, or only spaces', async () => {
    ask(replying({ ok: true, kind: 'answered', reply: 'x', cited: [] }))
    expect(send()).toBeDisabled()
    await type('   ')
    expect(send()).toBeDisabled()
    await type('Rent?')
    expect(send()).toBeEnabled()
  })

  it('cannot send again while a question is in flight', async () => {
    let resolve: (r: ActionResult<AskReply>) => void = () => {}
    const action = mock<Act>(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    ask(action)
    await type('Rent?')
    await submit()
    expect(send()).toBeDisabled()
    await act(async () => {
      resolve({ ok: true, kind: 'answered', reply: 'About AUD 24k.', cited: [] })
    })
    await type('And food?')
    expect(send()).toBeEnabled()
    expect(action).toHaveBeenCalledTimes(1)
  })
})
