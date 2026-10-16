/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import type { ActionResult } from '@/shared/types/action-result'
import { EMOTIONS } from '../emotions'
import type { Path } from '../lib/path-facts'
import { nativeOf } from '../text/native-fixtures'

const push = mock((_: string) => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push, replace: () => {}, refresh: () => {} }),
}))

const { NewComicForm } = await import('./NewComicForm')

const PATHS: Path[] = [
  {
    id: 'perth-cyber',
    label: 'Perth · Master of Cyber Security, ECU',
    city: 'Perth',
    course: 'Master of Cyber Security',
    university: 'ECU',
  },
  {
    id: 'hobart-nursing',
    label: 'Hobart · Bachelor of Nursing, UTAS',
    city: 'Hobart',
    course: 'Bachelor of Nursing',
    university: 'UTAS',
  },
]

const makeComicAction = mock(
  async (_input: unknown): Promise<ActionResult<{ id: string }>> => ({ ok: true, id: 'c1' }),
)

const view = (path?: string) =>
  render(
    <NewComicForm
      paths={PATHS}
      emotions={EMOTIONS}
      path={path}
      makeComicAction={makeComicAction}
    />,
  )
const button = () => screen.getByRole('button', { name: 'Make storyboard' })
const pathField = () => screen.getByLabelText('Path') as HTMLSelectElement

afterEach(() => {
  cleanup()
  push.mockClear()
  makeComicAction.mockClear()
})

describe('NewComicForm', () => {
  it('keeps "Make storyboard" unavailable until a path is chosen', () => {
    view()
    expect(button()).toBeDisabled()
    fireEvent.change(pathField(), { target: { value: 'hobart-nursing' } })
    expect(button()).toBeEnabled()
  })

  it('preselects the path the address names, and only a known one', () => {
    view('hobart-nursing')
    expect(pathField().value).toBe('hobart-nursing')
    expect(button()).toBeEnabled()
    cleanup()
    view('no-such-course')
    expect(pathField().value).toBe('')
    expect(button()).toBeDisabled()
  })

  it('shows a premise over 120 characters over the limit, and will not send it', () => {
    view('perth-cyber')
    fireEvent.change(screen.getByLabelText('Premise'), { target: { value: 'a'.repeat(121) } })
    expect(screen.getByText('121/120')).toHaveAttribute('data-over', 'true')
    expect(button()).toBeDisabled()
  })

  it('counts a Nepali premise as a reader sees it, and sends it with a Thai word of 30 characters as its emotion (GD37)', async () => {
    view('perth-cyber')
    const premise = nativeOf('ne', 120)
    const word = nativeOf('th', 30)
    fireEvent.change(screen.getByLabelText('Premise'), { target: { value: premise } })
    expect(screen.getByText('120/120')).toHaveAttribute('data-over', 'false')
    fireEvent.change(screen.getByLabelText('Your own word'), { target: { value: `${word}ก` } })
    expect(screen.getByLabelText('Your own word')).toHaveValue(word)
    await act(async () => {
      fireEvent.click(button())
    })
    expect(makeComicAction.mock.calls[0][0]).toMatchObject({ premise, emotion: word })
  })

  it('sends the path, premise and emotion, then opens the new comic', async () => {
    view('perth-cyber')
    fireEvent.change(screen.getByLabelText('Premise'), { target: { value: 'Moving for tech' } })
    fireEvent.click(screen.getByRole('button', { name: EMOTIONS[0].label }))
    await act(async () => {
      fireEvent.click(button())
    })
    expect(makeComicAction).toHaveBeenCalledTimes(1)
    expect(makeComicAction.mock.calls[0][0]).toMatchObject({
      courseId: 'perth-cyber',
      premise: 'Moving for tech',
      emotion: EMOTIONS[0].id,
    })
    expect(push).toHaveBeenCalledWith('/admin/posts/c1')
  })
})
