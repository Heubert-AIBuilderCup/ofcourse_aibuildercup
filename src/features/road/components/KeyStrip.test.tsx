/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { KeyStrip } from './KeyStrip'

afterEach(cleanup)

describe('KeyStrip', () => {
  it('reads the map’s four kinds of tile, and Got it closes it', () => {
    const onClose = mock(() => {})
    render(<KeyStrip onClose={onClose} />)
    const strip = screen.getByRole('note', { name: 'How to read the map' })
    for (const line of [
      'On your roadmap',
      'Other options',
      'More to look at',
      'Ahead, not open yet',
    ])
      expect(within(strip).getByText(line)).toBeInTheDocument()
    fireEvent.click(within(strip).getByRole('button', { name: 'Got it' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
