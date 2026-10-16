/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it, mock, spyOn } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as navigation from 'next/navigation'
import { toast } from 'sonner'
import type { Saved } from '../server/commands'

const refresh = mock(() => {})
mock.module('next/navigation', () => ({
  ...navigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh }),
}))

const { usePostAction } = await import('./usePostAction')

const success = spyOn(toast, 'success')
const error = spyOn(toast, 'error')

function Harness(props: { action: () => Promise<Saved>; onDone: (r: unknown) => void }) {
  const { pending, run, error } = usePostAction()
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(props.action, 'Done', props.onDone)}
      >
        Go
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

afterEach(() => {
  cleanup()
  refresh.mockClear()
  success.mockClear()
  error.mockClear()
})

it('confirms a saved change, hands back the new version and refreshes', async () => {
  const onDone = mock((_: unknown) => {})
  render(<Harness action={async () => ({ ok: true, id: 'p1', version: 3 })} onDone={onDone} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  })
  expect(success).toHaveBeenCalledWith('Done')
  expect(onDone).toHaveBeenCalledWith({ id: 'p1', version: 3 })
  expect(refresh).toHaveBeenCalledTimes(1)
})

it('shows a refusal and still refreshes, so the latest version loads', async () => {
  const onDone = mock((_: unknown) => {})
  render(
    <Harness
      action={async () => ({ ok: false, error: 'Changed by Maya R. just now' })}
      onDone={onDone}
    />,
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  })
  expect(error).toHaveBeenCalledWith('Changed by Maya R. just now')
  expect(onDone).not.toHaveBeenCalled()
  expect(refresh).toHaveBeenCalledTimes(1)
})

it('keeps the refusal for the control that ran it to show beside itself, until the next run', async () => {
  let result: Saved = { ok: false, error: 'Slide 2 · 26 words (15–25) · Over' }
  render(<Harness action={async () => result} onDone={() => {}} />)
  expect(screen.queryByRole('alert')).toBeNull()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  })
  expect(screen.getByRole('alert')).toHaveTextContent('Slide 2 · 26 words (15–25) · Over')
  result = { ok: true, id: 'p1', version: 4 }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  })
  expect(screen.queryByRole('alert')).toBeNull()
})
