// The line a judge reads when a day's cap refuses a paid AI call: what is used up, why there is a
// cap, when it resets, and who to email for more. Pure and client-safe: the server's refusals
// (ai/client.ts) and the image "Limit" line on screen (components/parts.tsx) say the same.

/** What a cap counts, as the line names it. */
export type LimitedCalls = 'images' | 'Pro calls' | 'source searches'

const WHY_AND_WHEN =
  'OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC).'

/** The address to email for more, when there is one. */
const sooner = (support: string | null) => (support ? ` Need it sooner? Email ${support}.` : '')

/** A failed step's daily-limit line (components/parts.tsx FailedLine): why and when, and who to email. */
export function stepLimitLine(support: string | null): string {
  return `Today's limit for this paid AI step is used up. ${WHY_AND_WHEN}${sooner(support)}`
}

/** The day's cap for `what` is used up; `support`, when set, is the address to email for more. */
export function dailyLimitLine({
  what,
  cap,
  support,
}: {
  what: LimitedCalls
  cap: number
  support: string | null
}): string {
  return `Today's limit of ${cap} ${what} is used up. ${WHY_AND_WHEN}${sooner(support)}`
}
