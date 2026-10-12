// Site constants: the name, the suspended contact and the admin time zone.
// Safe for client components: no secrets.

export const SITE_NAME = 'OfCourse'

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
