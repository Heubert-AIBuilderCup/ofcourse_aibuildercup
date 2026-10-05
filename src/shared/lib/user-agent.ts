/** A browser and a device, named for the sessions list. */
export type DeviceInfo = { browser: string; device: string }

const UNKNOWN_BROWSER = 'Unknown browser'
const UNKNOWN_DEVICE = 'Unknown device'

// Checked in this order, because each later name also appears inside the earlier ones' strings:
// an Edge string says Chrome and Safari too, and a Chrome string says Safari.
function browserOf(ua: string): string {
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/')) return 'Opera'
  if (ua.includes('SamsungBrowser/')) return 'Samsung Internet'
  if (ua.includes('Chrome/') || ua.includes('CriOS/')) return 'Chrome'
  if (ua.includes('Firefox/') || ua.includes('FxiOS/')) return 'Firefox'
  if (ua.includes('Version/') && ua.includes('Safari/')) return 'Safari'
  return UNKNOWN_BROWSER
}

// An Android string says Linux too, so Android is checked first.
function deviceOf(ua: string): string {
  if (ua.includes('iPhone')) return 'iPhone'
  if (ua.includes('iPad')) return 'iPad'
  if (ua.includes('Android')) return ua.includes('Mobile') ? 'Android phone' : 'Android tablet'
  if (ua.includes('Windows')) return 'Windows computer'
  if (ua.includes('Macintosh')) return 'Mac'
  if (ua.includes('CrOS')) return 'ChromeOS'
  if (ua.includes('Linux')) return 'Linux computer'
  return UNKNOWN_DEVICE
}

/**
 * The browser and device named in a user agent string, the one Better Auth keeps on each session.
 * The string is whatever the client sent, so the answer is only ever one of the names above and
 * never any of its text.
 */
export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  const text = ua ?? ''
  return { browser: browserOf(text), device: deviceOf(text) }
}
