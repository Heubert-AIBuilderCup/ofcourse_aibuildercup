import { expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..', '..')
const INLINE_BLOCK = /(^|[\s'"`])inline-block($|[\s'"`])/m

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

it('uses no inline-block class', () => {
  const offenders = sourceFiles(SRC).filter((file) => INLINE_BLOCK.test(readFileSync(file, 'utf8')))
  expect(
    offenders,
    'Tailwind 4 turns `inline-block` into display:inline-block AND inline-size:var(--ds-space-block), ' +
      'because globals.css defines --spacing-block (the logical-width `inline-*` utility). The element ' +
      'collapses to about 2.5rem wide. Use `w-fit` (with `max-w-full`) or `inline-flex` instead.',
  ).toEqual([])
})
