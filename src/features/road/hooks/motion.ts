/** She asked for reduced motion: the road's camera cuts and its tiles jump instead of moving. */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** The root font-size over 16px: 1 up to 1440, growing to 4/3 at 1920 as the design scales. */
export const rootScale = (): number =>
  (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16
