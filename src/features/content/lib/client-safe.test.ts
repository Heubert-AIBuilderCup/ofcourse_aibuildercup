import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The workbench's client components import these modules, so none of them may reach the layout
// engine (opentype and node:fs), a node built-in or a server-only module: one such import puts
// node:fs in the browser bundle and the build fails. Every module of lib/ and model/ (kept
// client-safe by rule), and every other module a 'use client' file imports by value.

const CONTENT = join(import.meta.dir, '..')

/** Every module in a folder of the feature, tests aside. */
const modulesIn = (folder: string) =>
  readdirSync(join(CONTENT, folder))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `${folder}/${f}`)

const CLIENT_SAFE = [
  ...modulesIn('lib'),
  ...modulesIn('model'),
  'markets/index.ts',
  'tags/index.ts',
  'pages/index.ts',
  'emotions/index.ts',
  'brands/index.ts',
  'templates/index.ts',
  'layout/relayout.ts',
  'nudges/index.ts',
  'assets/library/index.ts',
  'text/contrast.ts',
  'text/sentences.ts',
  'text/verbatim.ts',
]

const FORBIDDEN = [/^\.\.\/layout\/(engine|measure|png|fit)$/, /^node:/, /^server-only$/]

/** Every module a file imports: `from '…'`, `import '…'` and `import('…')`. */
function importsOf(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) {
    found.push(m[1])
  }
  return found
}

describe('modules the workbench imports in the browser', () => {
  it('lists the files it checks', () => {
    expect(CLIENT_SAFE).toContain('model/current.ts')
    expect(CLIENT_SAFE).toContain('model/types.ts')
    expect(CLIENT_SAFE).toContain('lib/profile-contract.ts')
  })

  for (const file of CLIENT_SAFE) {
    it(`${file} imports nothing server-only`, () => {
      const imports = importsOf(readFileSync(join(CONTENT, file), 'utf8'))
      const bad = imports.filter((spec) => FORBIDDEN.some((re) => re.test(spec)))
      expect(bad).toEqual([])
    })
  }
})
