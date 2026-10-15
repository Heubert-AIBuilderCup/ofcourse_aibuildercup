// Site constants: the name, the public origin and the suspended contact.
// Safe for client components: no secrets, and the origin falls back to the public URL only.

export const SITE_NAME = 'OfCourse'

/** Canonical public origin for absolute links. Server-side it also reads BETTER_AUTH_URL. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'

/** Who a suspended user is told to contact on /suspended; empty names the site instead. */
export const SUSPENDED_CONTACT: string = ''

/** The time zone admin pages show dates in, so server and browser render the same text. */
export const APP_TIME_ZONE = 'UTC'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const WHEN = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * A date and time for the admin pages, e.g. "4 Oct 2026, 09:12". Built from parts, because
 * engines differ in how they join the date and time and in month names and the text must match on hydration.
 */
export function formatWhen(at: Date | string | number): string {
  const part = Object.fromEntries(
    WHEN.formatToParts(new Date(at)).map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return `${Number(part.day)} ${MONTHS[Number(part.month) - 1]} ${part.year}, ${part.hour}:${part.minute}`
}
