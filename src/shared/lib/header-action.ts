// Where the header's square action sits and how it reads on the band (the button itself is
// Button's `square` variant): the theme toggle on the sign-in pages and in the admin bar, and the
// onboarding menu's button.

/** Below @5xl the action sits in the band (blue in light, steel in dark), so it turns light on it. */
export const HEADER_ACTION_ON_STEEL =
  '@max-5xl:border-panel-foreground/45 @max-5xl:dark:border-panel-foreground/24 @max-5xl:text-panel-foreground @max-5xl:hover:border-panel-foreground/45 @max-5xl:hover:bg-panel-foreground/8 @max-5xl:focus-visible:ring-panel-accent'

/** Where the two sign-in pages put it: on the page side by side, in the steel band below. */
export const HEADER_ACTION_SIGNIN_SPOT = `split-corner absolute top-11 z-20 @max-5xl:top-9 @max-5xl:[--corner:3rem] @max-xl:top-5 @max-xl:[--corner:1.25rem] ${HEADER_ACTION_ON_STEEL}`
