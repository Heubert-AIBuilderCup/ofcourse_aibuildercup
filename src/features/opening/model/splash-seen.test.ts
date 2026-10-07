/// <reference lib="dom" />
import { expect, it } from 'bun:test'
import { buildSplashSeenScript, SPLASH_SEEN_KEY, SPLASH_SEEN_SCRIPT } from './splash-seen'

// The script is the page's own inline code, so it runs here as the browser would: against a
// stand-in document and sessionStorage handed in as the globals it reads.
function run(script: string, storage: Pick<Storage, 'getItem'>) {
  const documentElement = { dataset: {} as Record<string, string> }
  new Function('sessionStorage', 'document', script)(storage, { documentElement })
  return documentElement.dataset
}

it('marks the page when this tab has already seen the splash', () => {
  const stored: Record<string, string> = { [SPLASH_SEEN_KEY]: 'seen' }
  expect(run(SPLASH_SEEN_SCRIPT, { getItem: (key) => stored[key] ?? null })).toEqual({
    splash: 'seen',
  })
})

it('leaves the page alone when the tab has not seen it', () => {
  expect(run(SPLASH_SEEN_SCRIPT, { getItem: () => null })).toEqual({})
})

it('survives sessionStorage refusing', () => {
  const refuses = {
    getItem: () => {
      throw new DOMException('denied', 'SecurityError')
    },
  }
  expect(run(SPLASH_SEEN_SCRIPT, refuses)).toEqual({})
})

it('reads the key it is given, and only that one', () => {
  const asked: string[] = []
  run(buildSplashSeenScript('some:key'), {
    getItem: (key) => {
      asked.push(key)
      return null
    },
  })
  expect(asked).toEqual(['some:key'])
})
