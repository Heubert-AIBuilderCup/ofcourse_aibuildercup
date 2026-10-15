import { expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// src/shared sits under every feature: a feature may import shared code, never the other way
// round (CLAUDE.md, Folders). One such import makes every importer of the shared file pull in
// the feature.

const SRC = join(import.meta.dir, '..', '..')
const SHARED = join(SRC, 'shared')
const FEATURE_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](@\/features\/[^'"]*|(?:\.\.\/)+features\/[^'"]*)['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

it('no file under src/shared imports from src/features', () => {
  const offenders = sourceFiles(SHARED)
    .filter((file) => FEATURE_IMPORT.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).replaceAll('\\', '/'))
  expect(offenders).toEqual([])
})
