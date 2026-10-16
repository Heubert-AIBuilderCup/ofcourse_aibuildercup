/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, within } from '@testing-library/react'
import type { FeedSettings } from '../model/types'
import { PhoneFeedCard } from './PhoneFeedCard'

afterEach(cleanup)

const settings = (over: Partial<FeedSettings>): FeedSettings => ({
  layer: 'general',
  audience: { mode: 'everyone', rules: [] },
  whyLine: null,
  expiry: { kind: 'none' },
  studioLink: null,
  tags: [],
  sourcesAt: 'caption',
  ...over,
})

const card = (s: FeedSettings | null) =>
  render(
    <PhoneFeedCard
      coverSrc="/admin/assets/png1"
      title="Paid work in Australia"
      excerpt="What the rules let you earn."
      settings={s}
      sourceLine="Source: Work rights guide · ¶2"
    />,
  )

const frame = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector<HTMLElement>('.w-90')
  if (!el) throw new Error('no w-90 frame')
  return el
}

describe('PhoneFeedCard', () => {
  it('shows a Personal post with its tag, why line, Studio call to action and source line in the frame', () => {
    const { container } = card(
      settings({
        layer: 'personal',
        audience: { mode: 'matched', rules: [] },
        whyLine: 'You weighted work rights highly.',
        studioLink: 'Work rights weight',
      }),
    )
    const phone = within(frame(container))
    expect(phone.getByText('For you')).toBeInTheDocument()
    expect(phone.getByText('You weighted work rights highly.')).toBeInTheDocument()
    expect(phone.getByText('Open your Studio · Work rights weighted')).toBeInTheDocument()
    expect(phone.getByText('Source: Work rights guide · ¶2')).toBeInTheDocument()
    expect(phone.getByText('Paid work in Australia')).toBeInTheDocument()
    expect(phone.getByText('What the rules let you earn.')).toBeInTheDocument()
    expect(phone.getByRole('img')).toHaveAttribute('src', '/admin/assets/png1')
  })

  it('shows no tag for General', () => {
    const { container } = card(settings({ layer: 'general' }))
    const phone = within(frame(container))
    expect(phone.queryByText('For you')).toBeNull()
    expect(phone.queryByText('Featured')).toBeNull()
    expect(phone.queryByText(/Studio|ranked routes/)).toBeNull()
  })

  it('tags a Featured post and offers the Compare call to action', () => {
    const { container } = card(settings({ layer: 'featured', studioLink: 'Compare view' }))
    const phone = within(frame(container))
    expect(phone.getByText('Featured')).toBeInTheDocument()
    expect(phone.getByText('Compare your ranked routes')).toBeInTheDocument()
  })

  it('makes the title a link when given an href, and plain text otherwise', () => {
    const { container, unmount } = render(
      <PhoneFeedCard
        coverSrc="/feed/assets/png1"
        href="/feed/p1?home=NP"
        title="Paid work in Australia"
        excerpt=""
        settings={null}
        sourceLine={null}
      />,
    )
    const phone = within(frame(container))
    expect(phone.getByRole('link', { name: 'Paid work in Australia' })).toHaveAttribute(
      'href',
      '/feed/p1?home=NP',
    )
    unmount()
    const plain = card(null)
    expect(within(frame(plain.container)).queryByRole('link')).toBeNull()
  })

  it('labels a Nepali post with its language’s own name, and an English one with none (GD40)', () => {
    const { container, unmount } = render(
      <PhoneFeedCard
        coverSrc="/feed/assets/png1"
        title="काम र पढाइ"
        excerpt=""
        settings={null}
        sourceLine={null}
        language="ne"
      />,
    )
    expect(within(frame(container)).getByText('नेपाली')).toHaveAttribute('lang', 'ne')
    unmount()
    const english = render(
      <PhoneFeedCard
        coverSrc="/feed/assets/png1"
        title="Paid work in Australia"
        excerpt=""
        settings={null}
        sourceLine={null}
        language="en"
      />,
    )
    expect(within(frame(english.container)).queryByText('English')).toBeNull()
  })

  it('shows only the post when there are no settings yet', () => {
    const { container } = card(null)
    const phone = within(frame(container))
    expect(phone.getByText('Paid work in Australia')).toBeInTheDocument()
    expect(phone.queryByText('For you')).toBeNull()
  })
})
