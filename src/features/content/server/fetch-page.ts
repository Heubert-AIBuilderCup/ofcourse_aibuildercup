import 'server-only'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'

// A source given as a link, read on the server (criterion 94). Only https on the default port, no
// credentials in the link and none sent; the host resolved first and refused unless every address
// it has is public, and the connection pinned to the address that was checked, so a second lookup
// cannot swap in another; the same again after each redirect, at most MAX_REDIRECTS; only
// text/html; reading stops past MAX_BYTES; the whole read gives up after TIMEOUT_MS. The page is
// parsed here, never run: its title, and the paragraphs of its <article>, else <main>, else
// <body>, without nav, header, footer, script and style.

export const PAGE_ERROR = 'Could not read that page.'
export const MAX_BYTES = 2 * 1024 * 1024
export const MAX_REDIRECTS = 3
export const TIMEOUT_MS = 10_000
const USER_AGENT = 'OfCourse-source-reader/1.0'
const REDIRECTS = new Set([301, 302, 303, 307, 308])

export type Page = { title: string; paragraphs: string[]; url: string; site: string }
export type PageResult = { ok: true; page: Page } | { ok: false; error: string }

/** The network, injected so tests never touch it. */
export type PageDeps = {
  /** Every address the host resolves to. */
  resolve: (host: string) => Promise<string[]>
  /** A GET of `url` connected to `address` (the one checked), sending no cookie or credential. */
  get: (
    url: URL,
    address: string,
    signal: AbortSignal,
  ) => Promise<{
    status: number
    location: string | null
    contentType: string | null
    body: AsyncIterable<Uint8Array>
  }>
  timeoutMs?: number
}

// ── Addresses ───────────────────────────────────────────────────────────────────────────────

/** [prefix bytes, prefix length in bits]: IPv4 that is not on the public internet. */
const V4_REFUSED: [number[], number][] = [
  [[0], 8], // this network
  [[10], 8], // private
  [[100, 64], 10], // carrier-grade NAT (and the Alibaba metadata address)
  [[127], 8], // loopback
  [[169, 254], 16], // link-local, the cloud metadata address
  [[172, 16], 12], // private
  [[192, 0, 0], 24], // protocol assignments
  [[192, 0, 2], 24], // documentation
  [[192, 88, 99], 24], // 6to4 relay
  [[192, 168], 16], // private
  [[198, 18], 15], // benchmarking
  [[198, 51, 100], 24], // documentation
  [[203, 0, 113], 24], // documentation
  [[224], 4], // multicast
  [[240], 4], // reserved and broadcast
]

/** IPv6 inside 2000::/3 (global unicast) that is still not public. */
const V6_REFUSED: [number[], number][] = [
  [[0x20, 0x01, 0x00], 23], // protocol assignments, Teredo
  [[0x20, 0x01, 0x0d, 0xb8], 32], // documentation
  [[0x20, 0x02], 16], // 6to4, which carries an IPv4 address
  [[0x3f, 0xff, 0x00], 20], // documentation
]

function within(bytes: number[], [prefix, bits]: [number[], number]): boolean {
  for (let i = 0; i < prefix.length; i++) {
    const left = bits - i * 8
    if (left <= 0) break
    const mask = left >= 8 ? 0xff : (0xff << (8 - left)) & 0xff
    if ((bytes[i] & mask) !== (prefix[i] & mask)) return false
  }
  return true
}

function v4Bytes(text: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text)
  if (!m) return null
  const bytes = m.slice(1).map(Number)
  return bytes.every((b) => b <= 255) ? bytes : null
}

function v6Bytes(text: string): number[] | null {
  // A zone (fe80::1%eth0) is only ever local.
  if (text.includes('%')) return null
  let groups = text
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(groups)
  if (v4) {
    const b = v4Bytes(v4[1])
    if (!b) return null
    groups = `${groups.slice(0, v4.index)}${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`
  }
  const halves = groups.split('::')
  if (halves.length > 2) return null
  const part = (s: string) => (s === '' ? [] : s.split(':'))
  const head = part(halves[0])
  const tail = halves.length === 2 ? part(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (!all.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null
  return all.flatMap((g) => {
    const n = Number.parseInt(g, 16)
    return [n >> 8, n & 0xff]
  })
}

/** True only for an address on the public internet: never private, loopback, link-local, unique-local, metadata or reserved. */
export function isPublicAddress(address: string): boolean {
  const v4 = v4Bytes(address)
  if (v4) return !V4_REFUSED.some((range) => within(v4, range))
  const v6 = v6Bytes(address)
  if (!v6) return false
  const tail = v6.slice(12)
  // ::ffff:a.b.c.d and the NAT64 prefix carry an IPv4 address: that one decides.
  if (within(v6, [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff], 96]))
    return isPublicAddress(tail.join('.'))
  if (within(v6, [[0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0], 96])) {
    return isPublicAddress(tail.join('.'))
  }
  if (!within(v6, [[0x20], 3])) return false
  return !V6_REFUSED.some((range) => within(v6, range))
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────

/** Thrown to stop a read; its message is logged, never shown. */
class Refusal extends Error {}

/** An https link on the default port with no credentials in it, or a refusal. */
function linkOf(raw: string, base?: URL): URL {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    throw new Refusal('not a link')
  }
  if (url.protocol !== 'https:') throw new Refusal('not https')
  if (url.username !== '' || url.password !== '') throw new Refusal('credentials in the link')
  if (url.port !== '') throw new Refusal('not the https port')
  return url
}

/** The promise, or a rejection once the read's time is up. */
function inTime<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Refusal('timed out'))
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      signal.addEventListener('abort', () => reject(new Refusal('timed out')), { once: true }),
    ),
  ])
}

/** The address to connect to: the host's own when it is one, else the first it resolves to, every one of them public. */
async function addressOf(url: URL, deps: PageDeps, signal: AbortSignal): Promise<string> {
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1')
  const addresses = isIP(host) ? [host] : await inTime(deps.resolve(host), signal)
  if (addresses.length === 0) throw new Refusal('no address')
  if (!addresses.every(isPublicAddress)) throw new Refusal('not a public address')
  return addresses[0]
}

/** Stops reading a body; a stream ends its connection. */
function close(it: AsyncIterator<Uint8Array>): void {
  Promise.resolve(it.return?.()).catch(() => {})
}

async function readCapped(body: AsyncIterable<Uint8Array>, signal: AbortSignal) {
  const it = body[Symbol.asyncIterator]()
  const parts: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await inTime(it.next(), signal)
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) throw new Refusal('over 2 MB')
      parts.push(value)
    }
  } finally {
    close(it)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const p of parts) {
    bytes.set(p, at)
    at += p.byteLength
  }
  return bytes
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = /charset\s*=\s*"?([\w.:-]+)/i.exec(contentType)?.[1]
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

async function read(link: string, deps: PageDeps, signal: AbortSignal): Promise<Page> {
  let url = linkOf(link)
  for (let hop = 0; ; hop++) {
    const address = await addressOf(url, deps, signal)
    const reply = await inTime(deps.get(url, address, signal), signal)
    if (REDIRECTS.has(reply.status)) {
      close(reply.body[Symbol.asyncIterator]())
      if (hop === MAX_REDIRECTS) throw new Refusal('too many redirects')
      if (!reply.location) throw new Refusal('a redirect to nowhere')
      url = linkOf(reply.location, url)
      continue
    }
    const type = reply.contentType?.split(';')[0].trim().toLowerCase()
    if (reply.status < 200 || reply.status > 299 || type !== 'text/html') {
      close(reply.body[Symbol.asyncIterator]())
      throw new Refusal(`status ${reply.status}, ${type ?? 'no type'}`)
    }
    const bytes = await readCapped(reply.body, signal)
    const { title, paragraphs } = parsePage(decode(bytes, reply.contentType ?? ''))
    if (paragraphs.length === 0) throw new Refusal('no paragraphs')
    return { title, paragraphs, url: url.href, site: url.hostname.replace(/^www\./, '') }
  }
}

/** The page at an https link, read under every rule above, or PAGE_ERROR. Never throws. */
export async function fetchPage(link: string, deps: PageDeps = NETWORK): Promise<PageResult> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Refusal('timed out')),
    deps.timeoutMs ?? TIMEOUT_MS,
  )
  try {
    return { ok: true, page: await read(link, deps, controller.signal) }
  } catch (err) {
    // The reason only: the link may carry a token in its query.
    console.warn('[content.fetchPage]', err instanceof Refusal ? err.message : err)
    return { ok: false, error: PAGE_ERROR }
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

/** The network: Node's resolver, and https pinned to the checked address with no agent, cookie or credential. */
const NETWORK: PageDeps = {
  resolve: async (host) =>
    (await lookup(host, { all: true, verbatim: true })).map((a) => a.address),
  get: (url, address, signal) =>
    new Promise((resolve, reject) => {
      const family = isIP(address)
      // The connection goes to the address checked, whatever a second lookup would say.
      const pinned: LookupFunction = (_host, options, done) =>
        options.all ? done(null, [{ address, family }]) : done(null, address, family)
      const req = request(
        url,
        {
          method: 'GET',
          agent: false,
          signal,
          headers: { accept: 'text/html', 'accept-encoding': 'identity', 'user-agent': USER_AGENT },
          lookup: pinned,
        },
        (res) =>
          resolve({
            status: res.statusCode ?? 0,
            location: res.headers.location ?? null,
            contentType: res.headers['content-type'] ?? null,
            body: res,
          }),
      )
      req.on('error', reject)
      req.end()
    }),
}

// ── Parsing ─────────────────────────────────────────────────────────────────────────────────

type El = {
  name: string
  attrs: Record<string, string>
  children: (El | string)[]
  parent: El | null
}
type Token =
  | { kind: 'open'; name: string; attrs: Record<string, string> }
  | { kind: 'close'; name: string }
  | { kind: 'text'; text: string }

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])
/** Elements whose content is text up to their own end tag, never markup. */
const RAW = new Set([
  'script',
  'style',
  'title',
  'textarea',
  'noscript',
  'template',
  'xmp',
  'iframe',
])
const RAW_END = new Map([...RAW].map((name) => [name, new RegExp(`</${name}[\\s/>]`, 'gi')]))
/** Start tags that close an open <p>, as HTML does. */
const CLOSES_P = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])
/** Never part of the reading. */
const DROP = new Set(['nav', 'header', 'footer', 'script', 'style', 'noscript', 'template'])

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  middot: '·',
  bull: '•',
  deg: '°',
  times: '×',
  minus: '−',
  frac12: '½',
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi,
    (whole, ref: string) => {
      if (ref[0] !== '#') return ENTITIES[ref] ?? ENTITIES[ref.toLowerCase()] ?? whole
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? Number.parseInt(ref.slice(2), 16) : Number(ref.slice(1))
      const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
      return valid ? String.fromCodePoint(code) : '�'
    },
  )
}

function attrsOf(inner: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of inner.matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = m[1].toLowerCase()
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

/** The end of a tag starting at `from`: its `>`, past any quoted attribute value. */
function tagEnd(html: string, from: number): number {
  let quote: string | null = null
  let last = ''
  for (let i = from; i < html.length; i++) {
    const c = html[i]
    if (quote) {
      if (c === quote) quote = null
    } else if ((c === '"' || c === "'") && last === '=') quote = c
    else if (c === '>') return i
    if (!quote && !/\s/.test(c)) last = c
  }
  return html.length
}

function* tokens(html: string): Generator<Token> {
  const TAG = /<(\/?)([a-z][^\s/>]*)/iy
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      yield { kind: 'text', text: decodeEntities(html.slice(i)) }
      return
    }
    if (lt > i) yield { kind: 'text', text: decodeEntities(html.slice(i, lt)) }
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt)
      i = end === -1 ? html.length : end + 1
      continue
    }
    TAG.lastIndex = lt
    const m = TAG.exec(html)
    if (!m) {
      yield { kind: 'text', text: '<' }
      i = lt + 1
      continue
    }
    const name = m[2].toLowerCase()
    const end = tagEnd(html, lt + m[0].length)
    i = end + 1
    if (m[1]) {
      yield { kind: 'close', name }
      continue
    }
    yield { kind: 'open', name, attrs: attrsOf(html.slice(lt + m[0].length, end)) }
    const rawEnd = RAW_END.get(name)
    if (rawEnd) {
      rawEnd.lastIndex = i
      const close = rawEnd.exec(html)
      const stop = close ? close.index : html.length
      yield { kind: 'text', text: decodeEntities(html.slice(i, stop)) }
      yield { kind: 'close', name }
      i = close ? tagEnd(html, stop) + 1 : html.length
    }
  }
}

function treeOf(html: string): El {
  const root: El = { name: '#root', attrs: {}, children: [], parent: null }
  let at = root
  const nearest = (name: string) => {
    for (let e: El | null = at; e; e = e.parent) if (e.name === name) return e
    return null
  }
  for (const t of tokens(html)) {
    if (t.kind === 'text') at.children.push(t.text)
    else if (t.kind === 'close') {
      const open = nearest(t.name)
      if (open?.parent) at = open.parent
    } else {
      if (CLOSES_P.has(t.name)) {
        const p = nearest('p')
        if (p?.parent) at = p.parent
      }
      const el: El = { name: t.name, attrs: t.attrs, children: [], parent: at }
      at.children.push(el)
      if (!VOID.has(t.name)) at = el
    }
  }
  return root
}

function* walk(el: El, skip: (e: El) => boolean = () => false): Generator<El> {
  for (const child of el.children) {
    if (typeof child === 'string' || skip(child)) continue
    yield child
    yield* walk(child, skip)
  }
}

function textOf(el: El): string {
  const parts: string[] = []
  const add = (e: El) => {
    for (const c of e.children) {
      if (typeof c === 'string') parts.push(c)
      else if (c.name === 'br') parts.push(' ')
      else if (!DROP.has(c.name)) add(c)
    }
  }
  add(el)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

/** A page's title (og:title, else <title>) and the paragraphs of its main text. Never runs anything in it. */
export function parsePage(html: string): { title: string; paragraphs: string[] } {
  const root = treeOf(html)
  const all = [...walk(root)]
  const og = all.find(
    (e) => e.name === 'meta' && (e.attrs.property ?? e.attrs.name)?.toLowerCase() === 'og:title',
  )
  const titleEl = all.find((e) => e.name === 'title')
  const title = (og?.attrs.content ?? (titleEl ? textOf(titleEl) : '')).replace(/\s+/g, ' ').trim()
  const container =
    all.find((e) => e.name === 'article') ??
    all.find((e) => e.name === 'main') ??
    all.find((e) => e.name === 'body') ??
    root
  const paragraphs = [...walk(container, (e) => DROP.has(e.name))]
    .filter((e) => e.name === 'p')
    .map(textOf)
    .filter((p) => p !== '')
  return { title, paragraphs }
}
