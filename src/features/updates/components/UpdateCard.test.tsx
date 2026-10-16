/// <reference lib="dom" />
// The update card both the admin preview and the student feed draw: its button is a link only when
// it is given somewhere to go.

import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { DEMO_DRAFT } from '../lib/update'
import { UpdateCard } from './UpdateCard'

afterEach(cleanup)

const BUTTON = 'See it on your roadmap →'

describe('UpdateCard', () => {
  it('links its button to the roadmap it is given', () => {
    render(<UpdateCard update={DEMO_DRAFT} badge="For you" why="Why" href="/roadmaps/r1" />)
    expect(screen.getByRole('link', { name: BUTTON }).getAttribute('href')).toBe('/roadmaps/r1')
  })

  it('draws its button, unpressable, without one', () => {
    render(<UpdateCard update={DEMO_DRAFT} badge="Matched student" why="Why" />)
    expect(screen.getAllByText(BUTTON).length).toBe(1)
    expect(screen.queryAllByRole('link').length).toBe(0)
  })
})
