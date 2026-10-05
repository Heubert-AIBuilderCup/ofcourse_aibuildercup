import { describe, expect, it } from 'bun:test'
import { describeUserAgent } from './user-agent'

// One real user agent string per row, as Better Auth keeps it on the session. The first eight are
// the table in the plan; the rest reach every other name in the plan's list of browsers and devices.
const ROWS: readonly { name: string; ua: string; browser: string; device: string }[] = [
  {
    name: 'Chrome on an Android phone',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    browser: 'Chrome',
    device: 'Android phone',
  },
  {
    name: 'Samsung Internet on an Android phone, though its string also says Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    browser: 'Samsung Internet',
    device: 'Android phone',
  },
  {
    name: 'Chrome on an Android tablet, which has no Mobile in its string',
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    browser: 'Chrome',
    device: 'Android tablet',
  },
  {
    name: 'Safari on an iPhone, whose string also says Mac OS X',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    browser: 'Safari',
    device: 'iPhone',
  },
  {
    name: 'Chrome on an iPhone, which says CriOS',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
    browser: 'Chrome',
    device: 'iPhone',
  },
  {
    name: 'Edge on Windows, though its string also says Chrome and Safari',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
    browser: 'Edge',
    device: 'Windows computer',
  },
  {
    name: 'Firefox on a Mac',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
    browser: 'Firefox',
    device: 'Mac',
  },
  {
    name: 'curl, which is no browser and no device',
    ua: 'curl/8.5.0',
    browser: 'Unknown browser',
    device: 'Unknown device',
  },
  {
    name: 'Opera on Windows, though its string also says Chrome and Safari',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0',
    browser: 'Opera',
    device: 'Windows computer',
  },
  {
    name: 'Firefox on an iPhone, which says FxiOS',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15',
    browser: 'Firefox',
    device: 'iPhone',
  },
  {
    name: 'Safari on an iPad',
    ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    browser: 'Safari',
    device: 'iPad',
  },
  {
    name: 'Safari on a Mac',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    browser: 'Safari',
    device: 'Mac',
  },
  {
    name: 'Chrome on ChromeOS',
    ua: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    browser: 'Chrome',
    device: 'ChromeOS',
  },
  {
    name: 'Firefox on Linux',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    browser: 'Firefox',
    device: 'Linux computer',
  },
  {
    name: 'no browser for an iPhone web view that says Safari/ but not Version/',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1',
    browser: 'Unknown browser',
    device: 'iPhone',
  },
  {
    name: 'no browser for an old Opera that says Version/ but not Safari/',
    ua: 'Opera/9.80 (Windows NT 6.1; WOW64) Presto/2.12.388 Version/12.16',
    browser: 'Unknown browser',
    device: 'Windows computer',
  },
]

describe('describeUserAgent', () => {
  for (const { name, ua, browser, device } of ROWS) {
    it(`names ${name}`, () => {
      expect(describeUserAgent(ua)).toEqual({ browser, device })
    })
  }

  // A session row has no user agent when the client sent none.
  for (const [name, ua] of [
    ['an empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ] as const) {
    it(`names neither browser nor device for ${name}`, () => {
      expect(describeUserAgent(ua)).toEqual({
        browser: 'Unknown browser',
        device: 'Unknown device',
      })
    })
  }
})
