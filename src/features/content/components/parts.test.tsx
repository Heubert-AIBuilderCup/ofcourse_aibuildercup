/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />

import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Move } from './parts'

afterEach(cleanup)

const CONFIRM = { question: 'Go back to source?', body: <p>Kept</p>, go: 'Go back' }

describe('Move with a confirm', () => {
  it('moves focus to "Stay" when the confirm opens, and back to the trigger when Stay closes it', () => {
    const onGo = mock(() => {})
    render(
      <Move label="Back to source" waiting={null} pending={false} onGo={onGo} confirm={CONFIRM} />,
    )
    const trigger = screen.getByRole('button', { name: 'Back to source' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(screen.queryByRole('button', { name: 'Stay' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back to source' }))
    expect(onGo).not.toHaveBeenCalled()
  })
})
