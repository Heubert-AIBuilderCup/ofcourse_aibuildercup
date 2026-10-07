// The splash's "already played in this tab" mark, in one place for the splash (which writes and
// reads it) and the root layout's inline script (which reads it before the first paint).

/** Marks the splash as played in this tab (sessionStorage: one browser tab, until it closes). */
export const SPLASH_SEEN_KEY = 'ofcourse:splash'

/**
 * The inline script for the root layout's <head>: it runs before the first paint and, when this
 * tab has already seen the splash, sets data-splash="seen" on <html>, which splash.module.css
 * answers by never painting the server-rendered overlay. Storage refused: it does nothing, and
 * the splash decides once it hydrates, as it always did. The key is JSON-encoded, so it reads as
 * the string it is whatever it holds.
 */
export function buildSplashSeenScript(key: string): string {
  return `try{if(sessionStorage.getItem(${JSON.stringify(key)})!==null)document.documentElement.dataset.splash='seen'}catch(e){}`
}

export const SPLASH_SEEN_SCRIPT = buildSplashSeenScript(SPLASH_SEEN_KEY)
