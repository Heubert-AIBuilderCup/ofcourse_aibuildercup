/// <reference lib="dom" />
/// <reference path="../../../../node_modules/@testing-library/jest-dom/types/bun.d.ts" />
import { afterEach, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Hero } from './Hero'

afterEach(cleanup)

it('stays steel in a dark page: the band is marked data-theme="light"', () => {
  render(<Hero overline="Getting started · step 2 of 6" title="What you'd study" />)
  expect(screen.getByRole('banner')).toHaveAttribute('data-theme', 'light')
})
