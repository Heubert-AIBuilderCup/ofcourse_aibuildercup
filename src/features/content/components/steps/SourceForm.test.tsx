/// <reference lib="dom" />
/// <reference path="../../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { Made, Suggested } from '../../server/commands'
import { nativeOf } from '../../text/native-fixtures'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { SourceForm } = await import('./SourceForm')

const makePostAction = mock(
  async (_input: unknown): Promise<Made> => ({ ok: true, id: 'p1', version: 1 }),
)

const source = (n: number, official: boolean) => ({
  url: `https://site${n}.example/page`,
  title: `Page ${n}`,
  site: `site${n}.example`,
  why: `Why page ${n} fits.`,
  official,
})
const ENTRY_POINT = '<div class="chips"><a href="https://www.google.com/search?q=x">x</a></div>'
let suggested: Suggested = { ok: true, sources: [], entryPoint: null }
const suggestSourcesAction = mock(async (_input: unknown): Promise<Suggested> => suggested)

const view = () => render(<SourceForm actions={{ makePostAction, suggestSourcesAction }} />)

afterEach(() => {
  cleanup()
  push.mockClear()
  makePostAction.mockClear()
  suggestSourcesAction.mockClear()
})

const LINKS = 'Links'
const FRAMING = 'What do you want this post to say?'
const NOTES = 'Your own notes'
const paste = () => fireEvent.click(screen.getByRole('button', { name: 'Paste text instead' }))
const fill = (title: string, text: string) => {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } })
  fireEvent.change(screen.getByLabelText('Source'), { target: { value: text } })
}
const links = (value: string) =>
  fireEvent.change(screen.getByLabelText(LINKS), { target: { value } })
const make = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Make post' }))
  })

it('shows each field with its placeholder and its help text (GD18)', () => {
  view()
  const fields = [
    [
      LINKS,
      'https://… one link per line, up to five',
      'We read each article and pull out its points.',
    ],
    [
      FRAMING,
      'e.g. Show first-year students why 20 hours is the limit',
      'Tell Gemini the story you want to tell. Optional.',
    ],
    [NOTES, 'Your own view or experience', 'Kept as your opinion, never used as a fact. Optional.'],
  ]
  for (const [label, placeholder, help] of fields) {
    const field = screen.getByLabelText(label)
    expect(field).toHaveAttribute('placeholder', placeholder)
    expect(field).toHaveAccessibleDescription(help)
  }
})

it('starts with the language, English chosen, each language by its own name, and sends it (GD36, GD29)', async () => {
  view()
  const language = screen.getByLabelText('Language') as HTMLSelectElement
  expect(screen.getAllByRole('combobox')[0]).toBe(language)
  expect(language).toHaveValue('en')
  expect([...language.options].map((o) => [o.value, o.textContent])).toEqual([
    ['en', 'English'],
    ['ne', 'नेपाली · Nepali'],
    ['hi', 'हिन्दी · Hindi'],
    ['th', 'ไทย · Thai'],
  ])
  links('https://example.com/a')
  await make()
  expect(makePostAction.mock.calls[0][0]).toMatchObject({ language: 'en' })

  fireEvent.change(language, { target: { value: 'ne' } })
  await make()
  expect(makePostAction.mock.calls[1][0]).toMatchObject({ language: 'ne' })
})

it('opens the text box with its title on "Paste text instead"', () => {
  view()
  expect(screen.queryByLabelText('Source')).toBeNull()
  expect(screen.queryByLabelText('Title')).toBeNull()
  paste()
  expect(screen.getByLabelText('Source')).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toBeInTheDocument()
  expect(screen.getByLabelText('Kind')).toHaveValue('research summary')
})

it('says "Up to five links." and disables "Make post" on a sixth link line (GD18)', () => {
  view()
  const five = Array.from({ length: 5 }, (_, i) => `https://example.com/${i}`)
  links([...five, '', '  '].join('\n'))
  expect(screen.queryByText('Up to five links.')).toBeNull()
  expect(screen.getByRole('button', { name: 'Make post' })).toBeEnabled()
  links([...five, 'https://example.com/5'].join('\n'))
  expect(screen.getByText('Up to five links.')).toBeInTheDocument()
  // Announced with the field: in its description, not only beside it.
  expect(screen.getByLabelText(LINKS)).toHaveAccessibleDescription(/Up to five links\./)
  expect(screen.getByRole('button', { name: 'Make post' })).toBeDisabled()
})

it('says "Use either links or pasted text." and disables "Make post" when both are given', () => {
  view()
  links('https://example.com/a')
  paste()
  fill('Paid work', 'A survey of 3,100 students.')
  expect(screen.getByLabelText(LINKS)).toHaveAccessibleDescription(
    /Use either links or pasted text\./,
  )
  expect(screen.getByRole('button', { name: 'Make post' })).toBeDisabled()
  links('')
  expect(screen.queryByText('Use either links or pasted text.')).toBeNull()
  expect(screen.getByRole('button', { name: 'Make post' })).toBeEnabled()
})

it('keeps "Make post" disabled until a link, or pasted text with its title, is given', () => {
  view()
  const button = screen.getByRole('button', { name: 'Make post' })
  expect(button).toBeDisabled()
  links('https://example.com/a')
  expect(button).toBeEnabled()
  links('')
  paste()
  fill('Paid work', '')
  expect(button).toBeDisabled()
  fill('', 'A survey of 3,100 students.')
  expect(button).toBeDisabled()
  fill('Paid work', 'A survey of 3,100 students.')
  expect(button).toBeEnabled()
})

it('sends the links one per line, the framing line and the notes, for the server to read (94, GD18)', async () => {
  view()
  links(' https://example.com/paid-work \n\nhttps://example.com/rights')
  fireEvent.change(screen.getByLabelText(FRAMING), { target: { value: 'Why 20 hours' } })
  fireEvent.change(screen.getByLabelText(NOTES), { target: { value: 'I worked 25.' } })
  await make()
  expect(makePostAction.mock.calls[0][0]).toMatchObject({
    title: '',
    kind: 'research summary',
    text: '',
    links: ['https://example.com/paid-work', 'https://example.com/rights'],
    framing: 'Why 20 hours',
    notes: 'I worked 25.',
  })
  expect(push).toHaveBeenCalledWith('/admin/posts/p1')
})

it('holds the framing line, notes and title to their characters as a reader sees them, Nepali, Hindi and Thai whole (GD37)', () => {
  view()
  const framing = screen.getByLabelText(FRAMING)
  fireEvent.change(framing, { target: { value: `${nativeOf('ne', 200)}।` } })
  expect(framing).toHaveValue(nativeOf('ne', 200))
  const notes = screen.getByLabelText(NOTES)
  fireEvent.change(notes, { target: { value: `${nativeOf('hi', 2000)}।` } })
  expect(notes).toHaveValue(nativeOf('hi', 2000))
  paste()
  const title = screen.getByLabelText('Title')
  fireEvent.change(title, { target: { value: `${nativeOf('th', 200)}ก` } })
  expect(title).toHaveValue(nativeOf('th', 200))
})

it('when no link can be read, lists each under the field and keeps them (GD19)', async () => {
  const error = 'Could not read that page.'
  makePostAction.mockImplementationOnce(async () => ({
    ok: false,
    error,
    failed: [
      { url: 'https://example.com/a', error },
      { url: 'https://example.com/b', error },
    ],
  }))
  view()
  links('https://example.com/a\nhttps://example.com/b')
  await make()
  expect(screen.getByRole('alert')).toHaveTextContent(error)
  const failed = screen.getByRole('list', { name: 'Links not read' })
  expect(failed).toHaveTextContent('https://example.com/a')
  expect(failed).toHaveTextContent('https://example.com/b')
  expect(failed).toHaveTextContent('https://example.com/a: Could not read this page')
  expect(screen.getByLabelText(LINKS)).toHaveValue('https://example.com/a\nhttps://example.com/b')
  expect(push).not.toHaveBeenCalled()
})

it('shows a failure and "Try again", keeping every field', async () => {
  makePostAction.mockImplementationOnce(async () => ({
    ok: false,
    error: 'The model could not answer. Try again.',
  }))
  view()
  paste()
  fill('Paid work', 'A survey of 3,100 students.')
  await make()
  expect(screen.getByRole('alert')).toHaveTextContent('The model could not answer. Try again.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  expect(screen.getByLabelText('Source')).toHaveValue('A survey of 3,100 students.')
  expect(screen.getByLabelText('Title')).toHaveValue('Paid work')
  expect(push).not.toHaveBeenCalled()
})

it('sends the same request id on two quick submits', async () => {
  view()
  paste()
  fill('Paid work', 'A survey of 3,100 students.')
  const form = screen.getByRole('form', { name: 'New feed post' })
  await act(async () => {
    fireEvent.submit(form)
    fireEvent.submit(form)
  })
  expect(makePostAction).toHaveBeenCalledTimes(2)
  const [first, second] = makePostAction.mock.calls.map(
    ([input]) => (input as { requestId: string }).requestId,
  )
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(second).toBe(first)
  expect(makePostAction.mock.calls[0][0]).toMatchObject({
    title: 'Paid work',
    kind: 'research summary',
    text: 'A survey of 3,100 students.',
  })
})

it('sends the page chosen for the post, and None as null (105)', async () => {
  view()
  links('https://example.com/a')
  expect(screen.getByLabelText('Page')).toHaveValue('')
  // A feed post never goes on the Comics page, which takes only comics (RC7).
  expect(
    [...(screen.getByLabelText('Page') as HTMLSelectElement).options].map((o) => o.value),
  ).toEqual(['', 'main', 'cerebral', 'infographics'])
  await make()
  expect(makePostAction.mock.calls[0][0]).toMatchObject({ pageBrandId: null })

  fireEvent.change(screen.getByLabelText('Page'), { target: { value: 'cerebral' } })
  await make()
  expect(makePostAction.mock.calls[1][0]).toMatchObject({ pageBrandId: 'cerebral' })
})

it('makes a feed post unless it is the blog form, whose button makes a blog (BR1)', async () => {
  view()
  links('https://example.com/a')
  await make()
  expect(makePostAction.mock.calls[0][0]).toMatchObject({ postKind: 'feed' })
  cleanup()

  render(<SourceForm actions={{ makePostAction, suggestSourcesAction }} postKind="blog" />)
  links('https://example.com/a')
  expect(screen.queryByRole('button', { name: 'Make post' })).toBeNull()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Make blog' }))
  })
  expect(makePostAction.mock.calls[1][0]).toMatchObject({
    postKind: 'blog',
    links: ['https://example.com/a'],
  })
})

describe('"Start from an idea" (BR12, BR13)', () => {
  const IDEA = 'Your idea'
  const startFromIdea = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Start from an idea' }))
  const find = (idea: string) =>
    act(async () => {
      fireEvent.change(screen.getByLabelText(IDEA), { target: { value: idea } })
      fireEvent.click(screen.getByRole('button', { name: 'Find sources' }))
    })
  const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }))
  const useThese = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use these' }))
    })

  it('opens the idea field with its placeholder and help text, and sends the idea on "Find sources"', async () => {
    view()
    expect(screen.queryByLabelText(IDEA)).toBeNull()
    startFromIdea()
    const field = screen.getByLabelText(IDEA)
    expect(field).toHaveAttribute('placeholder')
    // Held to 200 characters as a reader sees them: a Nepali idea of 200 whole (GD37).
    fireEvent.change(field, { target: { value: `${nativeOf('ne', 200)}।` } })
    expect(field).toHaveValue(nativeOf('ne', 200))
    expect(field).toHaveAccessibleDescription(/Gemini searches Google/)
    await find('Working while you study in Australia')
    expect(suggestSourcesAction.mock.calls[0][0]).toEqual({
      idea: 'Working while you study in Australia',
    })
  })

  it('lists each source with its title, site and why, the official ones of the top three ticked (GD29)', async () => {
    suggested = {
      ok: true,
      sources: [source(1, true), source(2, true), source(3, false), source(4, false)],
      entryPoint: null,
    }
    view()
    startFromIdea()
    await find('Working while you study')
    const list = screen.getByRole('list', { name: 'Suggested sources' })
    expect(list).toHaveTextContent('Page 1')
    expect(list).toHaveTextContent('site1.example')
    expect(list).toHaveTextContent('Why page 1 fits.')
    const ticked = screen
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-checked') === 'true')
    expect(ticked).toEqual([true, true, false, false])

    suggested = { ok: true, sources: [1, 2, 3, 4].map((n) => source(n, true)), entryPoint: null }
    await find('Working while you study in Australia')
    expect(
      screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-checked') === 'true'),
    ).toEqual([true, true, true, false])
  })

  it('"Use these" fills the Links field with the ticked pages and runs "Make post" with them (BR13)', async () => {
    suggested = {
      ok: true,
      sources: [source(1, true), source(2, true), source(3, false)],
      entryPoint: null,
    }
    view()
    startFromIdea()
    await find('Working while you study')
    tick('Page 1')
    tick('Page 3')
    await useThese()
    const links = ['https://site2.example/page', 'https://site3.example/page']
    expect(makePostAction).toHaveBeenCalledTimes(1)
    expect(makePostAction.mock.calls[0][0]).toMatchObject({ links, text: '' })
    expect(screen.getByLabelText(LINKS)).toHaveValue(links.join('\n'))
    expect(push).toHaveBeenCalledWith('/admin/posts/p1')
  })

  it('keeps "Use these" disabled with no page ticked, or more than five (GD18)', async () => {
    suggested = {
      ok: true,
      sources: [1, 2, 3, 4, 5, 6].map((n) => source(n, n <= 3)),
      entryPoint: null,
    }
    view()
    startFromIdea()
    await find('Working while you study')
    for (const n of [4, 5, 6]) tick(`Page ${n}`)
    expect(screen.getByRole('button', { name: 'Use these' })).toBeDisabled()
    expect(screen.getByText('Up to five links.')).toBeInTheDocument()
    for (const n of [1, 2, 3, 4, 5, 6]) tick(`Page ${n}`)
    expect(screen.getByRole('button', { name: 'Use these' })).toBeDisabled()
    expect(makePostAction).not.toHaveBeenCalled()
  })

  it("renders Google's search entry point in a sandboxed iframe, never in the page", async () => {
    suggested = { ok: true, sources: [source(1, true)], entryPoint: ENTRY_POINT }
    view()
    startFromIdea()
    await find('Working while you study')
    const frame = screen.getByTitle('Google Search suggestions')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('sandbox')
    expect(frame.getAttribute('sandbox')).not.toMatch(/allow-scripts|allow-same-origin/)
    expect(frame.getAttribute('srcdoc')).toContain(ENTRY_POINT)
    expect(document.querySelector('.chips')).toBeNull()
  })

  it('opens on the idea it was started from, and the post it makes carries the queue idea (Ideas queue)', async () => {
    suggested = { ok: true, sources: [source(1, true)], entryPoint: null }
    render(
      <SourceForm
        actions={{ makePostAction, suggestSourcesAction }}
        idea={{ text: 'Perth on a student budget', ideaId: 'perth-budget' }}
      />,
    )
    expect(screen.queryAllByRole('button', { name: 'Start from an idea' }).length).toBe(0)
    expect(screen.getByLabelText(IDEA)).toHaveValue('Perth on a student budget')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Find sources' }))
    })
    expect(suggestSourcesAction.mock.calls[0][0]).toEqual({ idea: 'Perth on a student budget' })
    await useThese()
    expect(makePostAction.mock.calls[0][0]).toMatchObject({
      links: ['https://site1.example/page'],
      ideaId: 'perth-budget',
    })
  })

  it('says why no source was found, and keeps the idea', async () => {
    suggested = { ok: false, error: 'Try a more specific idea.' }
    view()
    startFromIdea()
    await find('Study')
    expect(screen.getByRole('alert')).toHaveTextContent('Try a more specific idea.')
    expect(screen.getByLabelText(IDEA)).toHaveValue('Study')
    expect(screen.queryByRole('list', { name: 'Suggested sources' })).toBeNull()
  })
})
