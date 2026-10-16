// What reaches the board's browser bundle: the roads' client-safe entry loads the roads' keys and
// never their copy (data/roads.ts, every card of six roads), and the opening's model, and the
// onboarding question screens that read it, load nothing of the roads. Walks the runtime imports (type-only ones are erased) inside src.

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const transpiler = new Bun.Transpiler({ loader: 'tsx' })
const SRC = join(import.meta.dir, '..', '..')

/** Every source file a module loads at run time, itself included. */
function importGraph(entry: string): string[] {
  const seen = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const { path } of transpiler.scanImports(readFileSync(file, 'utf8'))) {
      const resolved = Bun.resolveSync(path, dirname(file))
      if (resolved.startsWith(SRC) && /\.tsx?$/.test(resolved)) visit(resolved)
    }
  }
  visit(entry)
  return [...seen].map((f) => f.replaceAll('\\', '/'))
}

describe('the roads in the browser', () => {
  it('the client entry loads the road keys, never the roads’ copy', () => {
    const graph = importGraph(join(import.meta.dir, 'client.ts'))
    expect(graph.some((f) => f.endsWith('/roads/data/road-keys.ts'))).toBe(true)
    expect(graph.filter((f) => f.endsWith('/roads/data/roads.ts'))).toEqual([])
  })

  it('the client entry may load the candidate roads, still never the roads’ copy', () => {
    const graph = importGraph(join(import.meta.dir, 'client.ts'))
    expect(graph.some((f) => f.endsWith('/roads/data/candidates.ts'))).toBe(true)
    expect(graph.filter((f) => f.endsWith('/roads/data/roads.ts'))).toEqual([])
  })

  it('the opening’s model, and the question screens that read it, load nothing of the roads', () => {
    const model = join(SRC, 'features', 'opening', 'model')
    const entries = [
      ...readdirSync(model)
        .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
        .map((f) => join(model, f)),
      join(SRC, 'features', 'opening', 'components', 'QuestionScreen.tsx'),
    ]
    expect(entries.some((f) => f.endsWith('impact.ts'))).toBe(true)
    expect(entries.some((f) => f.endsWith('answers-panel.ts'))).toBe(true)
    for (const entry of entries) {
      const roads = importGraph(entry).filter((f) => f.includes('/features/roads/'))
      expect([entry, roads]).toEqual([entry, []])
    }
  })
})
