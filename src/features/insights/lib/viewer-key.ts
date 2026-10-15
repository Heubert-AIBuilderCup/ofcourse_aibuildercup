// A student's key for one day (RC12): an HMAC of the day and her id under the server's secret, cut
// to 32 hex characters. The key changes every day, so her days cannot be linked; without the
// secret, the key cannot be traced back to her; her id itself is never stored.

import { createHmac } from 'node:crypto'

export function viewerKey(userId: string, day: string, secret: string): string {
  return createHmac('sha256', secret).update(`${day}:${userId}`).digest('hex').slice(0, 32)
}
