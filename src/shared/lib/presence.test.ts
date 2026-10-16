import { describe, expect, it } from 'bun:test'
import { LAST_SEEN_THROTTLE_MS, lastSeenLabel, ONLINE_WINDOW_MS } from './presence'

const NOW = new Date('2026-10-26T12:00:00.000Z').getTime()
const agoMs = (ms: number) => NOW - ms
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('the windows', () => {
  it('counts anyone who loaded a page in the last three minutes as online', () => {
    expect(ONLINE_WINDOW_MS).toBe(3 * MIN)
  })

  it('rewrites the last-seen time more often than the online window, so an active user never ages out', () => {
    expect(LAST_SEEN_THROTTLE_MS).toBe(2 * MIN)
    expect(LAST_SEEN_THROTTLE_MS).toBeLessThan(ONLINE_WINDOW_MS)
  })
})

describe('lastSeenLabel', () => {
  it('says Never for someone who has never been seen', () =>
    expect(lastSeenLabel(null, NOW)).toBe('Never'))

  it('says Online for a load this moment', () => expect(lastSeenLabel(NOW, NOW)).toBe('Online'))

  it('says Online just under three minutes', () =>
    expect(lastSeenLabel(agoMs(3 * MIN - 1), NOW)).toBe('Online'))

  it('says 3m ago at three minutes', () =>
    expect(lastSeenLabel(agoMs(3 * MIN), NOW)).toBe('3m ago'))

  it('counts whole minutes', () => {
    expect(lastSeenLabel(agoMs(20 * MIN), NOW)).toBe('20m ago')
    expect(lastSeenLabel(agoMs(20 * MIN + 59_999), NOW)).toBe('20m ago')
  })

  it('says 59m ago, then 1h ago at sixty minutes', () => {
    expect(lastSeenLabel(agoMs(59 * MIN), NOW)).toBe('59m ago')
    expect(lastSeenLabel(agoMs(HOUR - 1), NOW)).toBe('59m ago')
    expect(lastSeenLabel(agoMs(HOUR), NOW)).toBe('1h ago')
  })

  it('counts whole hours', () => expect(lastSeenLabel(agoMs(3 * HOUR), NOW)).toBe('3h ago'))

  it('says 23h ago, then 1d ago at twenty-four hours', () => {
    expect(lastSeenLabel(agoMs(DAY - 1), NOW)).toBe('23h ago')
    expect(lastSeenLabel(agoMs(DAY), NOW)).toBe('1d ago')
  })

  it('counts whole days', () => expect(lastSeenLabel(agoMs(2 * DAY), NOW)).toBe('2d ago'))

  it('reads a time a little ahead of now, the database clock running fast, as Online', () => {
    expect(lastSeenLabel(NOW + 5_000, NOW)).toBe('Online')
  })
})
