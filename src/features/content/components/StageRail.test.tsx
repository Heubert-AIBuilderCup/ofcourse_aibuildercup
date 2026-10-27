/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { stepsFor } from '../lib/steps'
import type { Stage } from '../model/stages'
import { StageRail } from './StageRail'

afterEach(cleanup)

const rail = (stage: Stage, open: Parameters<typeof StageRail>[0]['open'], ideas = false) =>
  render(
    <StageRail
      postId="p1"
      steps={stepsFor({
        stage,
        ideas,
        atIdeas: false,
        pictures: false,
        outline: false,
        atOutline: false,
        blog: false,
      })}
      open={open}
      from="filter=social&lang=ne"
    />,
  )
const links = () =>
  screen.queryAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])

it('numbers the steps in plain words, ticks the done ones, marks the current one, and no gate (GD25)', () => {
  rail('structures', 'text')
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Source',
    '2Text',
    '3Images',
    '4Settings',
    '5Review',
    '6Live',
  ])
  expect(screen.getByText('Text').closest('li')).toHaveAttribute('aria-current', 'step')
  for (const gone of ['Structures', 'Render gate', 'Gate locked', 'Gate open']) {
    expect(screen.queryByText(gone)).toBeNull()
  }
})

it('links only the done and current steps to their screens, keeping every board filter (GD27)', () => {
  rail('rendered', 'text', true)
  expect(links()).toEqual([
    ['Source', '/admin/posts/p1/source?from=filter%3Dsocial%26lang%3Dne'],
    ['Ideas', '/admin/posts/p1/ideas?from=filter%3Dsocial%26lang%3Dne'],
    ['Text', '/admin/posts/p1/text?from=filter%3Dsocial%26lang%3Dne'],
    ['4Images', '/admin/posts/p1/images?from=filter%3Dsocial%26lang%3Dne'],
  ])
  expect(screen.getByText('Review').closest('a')).toBeNull()
  expect(screen.getByText('Live').closest('a')).toBeNull()
})

it('says which screen is open', () => {
  rail('rendered', 'text')
  expect(screen.getByRole('link', { name: 'Text' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Images' })).not.toHaveAttribute('aria-current')
})
