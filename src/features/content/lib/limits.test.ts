import { describe, expect, it } from 'bun:test'
import { failureReason } from './failure'
import { dailyLimitLine, stepLimitLine } from './limits'

describe('dailyLimitLine', () => {
  it('says what is used up, why, when it resets, and who to email when there is a support address', () => {
    expect(dailyLimitLine({ what: 'images', cap: 600, support: 'nikhil@heubert.com' })).toBe(
      "Today's limit of 600 images is used up. OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC). Need it sooner? Email nikhil@heubert.com.",
    )
  })

  it('without a support address, just says when it resets', () => {
    expect(dailyLimitLine({ what: 'Pro calls', cap: 150, support: null })).toBe(
      "Today's limit of 150 Pro calls is used up. OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC).",
    )
  })

  it('reads as the daily limit wherever a failed step names its reason', () => {
    const line = dailyLimitLine({ what: 'source searches', cap: 100, support: null })
    expect(failureReason(line)).toBe('daily_limit')
  })
})

describe('stepLimitLine', () => {
  it('says why and when for a failed step, with the address when there is one', () => {
    expect(stepLimitLine('nikhil@heubert.com')).toBe(
      "Today's limit for this paid AI step is used up. OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC). Need it sooner? Email nikhil@heubert.com.",
    )
    expect(stepLimitLine(null)).toBe(
      "Today's limit for this paid AI step is used up. OfCourse caps paid AI calls a day to keep costs down. It resets at 05:30 IST (midnight UTC).",
    )
  })
})
