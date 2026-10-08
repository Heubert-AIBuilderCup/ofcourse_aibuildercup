// The header's one square action (the design's `.hdr-btn`): the theme toggle on the sign-in pages
// and in the admin bar, and the onboarding menu's button. One definition, so the three never drift.

/** The 44px square button. */
export const HEADER_ACTION =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center border border-border bg-transparent p-0 text-foreground hover:border-foreground/40 hover:bg-foreground/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors motion-safe:duration-200'

/** Below @5xl the action sits in the steel band, so it turns light on steel. */
export const HEADER_ACTION_ON_STEEL =
  '@max-5xl:border-panel-foreground/24 @max-5xl:text-panel-foreground @max-5xl:hover:border-panel-foreground/45 @max-5xl:hover:bg-panel-foreground/8 @max-5xl:focus-visible:outline-panel-accent'

/** Where the two sign-in pages put it: on the page side by side, in the steel band below. */
export const HEADER_ACTION_SIGNIN_SPOT = `split-corner absolute top-11 z-20 @max-5xl:top-9 @max-5xl:[--corner:3rem] @max-xl:top-5 @max-xl:[--corner:1.25rem] ${HEADER_ACTION_ON_STEEL}`
