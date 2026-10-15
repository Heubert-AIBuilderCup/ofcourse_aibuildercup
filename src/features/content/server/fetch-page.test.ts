import { describe, expect, mock, test } from 'bun:test'

// A link read on the server (criterion 94), with the resolver and the connection injected, so no
// test touches the network: what is refused before connecting, after each redirect, by type,
// size and time, and what a page is cleaned to.

mock.module('server-only', () => ({}))

const { fetchPage, PAGE_ERROR, parsePage, MAX_BYTES } = await import('./fetch-page')
type Deps = import('./fetch-page').PageDeps
type Reply = Awaited<ReturnType<Deps['get']>>

const PUBLIC = '93.184.215.14'
const enc = new TextEncoder()
const REFUSED = { ok: false as const, error: PAGE_ERROR }

async function* chunks(...parts: string[]) {
  for (const p of parts) yield enc.encode(p)
}

const html = (body: string, contentType: string | null = 'text/html; charset=utf-8'): Reply => ({
  status: 200,
  location: null,
  contentType,
  body: chunks(body),
})
const redirect = (location: string, status = 302): Reply => ({
  status,
  location,
  contentType: null,
  body: chunks(),
})

const PAGE = `<!doctype html><html><head><title>Paid work | Campus Times</title></head>
<body><article><p>Most students work.</p></article></body></html>`

/** A resolver answering from a table, and a connection answering in turn, both recorded. */
function deps(
  hosts: Record<string, string[]>,
  replies: Reply[],
  timeoutMs?: number,
): Deps & { resolved: string[]; gets: { url: string; address: string }[] } {
  const resolved: string[] = []
  const gets: { url: string; address: string }[] = []
  return {
    resolved,
    gets,
    timeoutMs,
    resolve: async (host) => {
      resolved.push(host)
      return hosts[host] ?? []
    },
    get: async (url, address) => {
      gets.push({ url: url.href, address })
      const reply = replies.shift()
      if (!reply) throw new Error('no reply')
      return reply
    },
  }
}

describe('what is refused before connecting', () => {
  test('a link that is not https, or carries credentials, is refused unresolved', async () => {
    for (const link of [
      'http://example.com/a',
      'ftp://example.com/a',
      'https://user:pw@example.com/a',
      'https://example.com:8443/a',
      'not a link',
    ]) {
      const d = deps({ 'example.com': [PUBLIC] }, [html(PAGE)])
      expect(await fetchPage(link, d)).toEqual(REFUSED)
      expect(d.gets).toEqual([])
    }
  })

  test('a host resolving to a private, loopback, link-local, unique-local or metadata address is refused', async () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.5.4',
      '192.168.1.1',
      '169.254.169.254',
      '100.100.100.200',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'fd00:ec2::254',
      '::ffff:127.0.0.1',
      '::ffff:a9fe:a9fe',
      '64:ff9b::a00:1',
      '2002:a00:1::1',
      'ff02::1',
    ]) {
      const d = deps({ 'example.com': [address] }, [html(PAGE)])
      expect(await fetchPage('https://example.com/a', d), address).toEqual(REFUSED)
      expect(d.gets).toEqual([])
    }
  })

  test('a host with one private address among public ones, or none, is refused', async () => {
    for (const answer of [[PUBLIC, '10.0.0.1'], [PUBLIC, 'fd12::1'], []]) {
      const d = deps({ 'example.com': answer }, [html(PAGE)])
      expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
      expect(d.gets).toEqual([])
    }
  })

  test('an address written as the host is checked without resolving', async () => {
    for (const link of [
      'https://127.0.0.1/',
      'https://2130706433/',
      'https://0x7f.1/',
      'https://[::1]/',
      'https://[::ffff:169.254.169.254]/',
    ]) {
      const d = deps({}, [html(PAGE)])
      expect(await fetchPage(link, d), link).toEqual(REFUSED)
      expect(d.gets).toEqual([])
    }
  })

  test('a public host is connected to at the address that was checked', async () => {
    const d = deps({ 'www.example.com': [PUBLIC, '2606:2800:21f:cb07:6820:80da:af6b:8b2c'] }, [
      html(PAGE),
    ])
    const result = await fetchPage('https://www.example.com/news/paid-work', d)
    expect(result.ok).toBe(true)
    expect(d.gets).toEqual([{ url: 'https://www.example.com/news/paid-work', address: PUBLIC }])
  })
})

describe('redirects', () => {
  test('each redirect is checked again: one to a private address is refused', async () => {
    const d = deps({ 'example.com': [PUBLIC], 'inside.example.com': ['10.0.0.7'] }, [
      redirect('https://inside.example.com/admin'),
      html(PAGE),
    ])
    expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
    expect(d.resolved).toEqual(['example.com', 'inside.example.com'])
    expect(d.gets).toHaveLength(1)
  })

  test('a redirect to http is refused', async () => {
    const d = deps({ 'example.com': [PUBLIC] }, [redirect('http://example.com/b'), html(PAGE)])
    expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
    expect(d.gets).toHaveLength(1)
  })

  test('three redirects are followed, a fourth is refused', async () => {
    const hosts = { 'example.com': [PUBLIC] }
    const three = deps(hosts, [
      redirect('/b', 301),
      redirect('/c', 307),
      redirect('https://example.com/d', 308),
      html(PAGE),
    ])
    const followed = await fetchPage('https://example.com/a', three)
    expect(followed).toMatchObject({ ok: true, page: { url: 'https://example.com/d' } })
    expect(three.gets.map((g) => g.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/d',
    ])

    const four = deps(hosts, [redirect('/b'), redirect('/c'), redirect('/d'), redirect('/e')])
    expect(await fetchPage('https://example.com/a', four)).toEqual(REFUSED)
    expect(four.gets).toHaveLength(4)
  })
})

describe('what is refused once connected', () => {
  test('a page that is not HTML, or not there, is refused', async () => {
    for (const reply of [
      html('%PDF-1.7', 'application/pdf'),
      html('{}', 'application/json'),
      html(PAGE, null),
      { ...html(PAGE), status: 404 },
      { ...html(PAGE), status: 500 },
      redirect(''),
    ]) {
      const d = deps({ 'example.com': [PUBLIC] }, [reply])
      expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
    }
  })

  test('reading stops past 2 MB and the page is refused', async () => {
    let pulled = 0
    async function* big() {
      const mb = enc.encode(`<p>${'x'.repeat(1024 * 1024 - 7)}</p>`)
      for (let i = 0; i < 10; i++) {
        pulled++
        yield mb
      }
    }
    const d = deps({ 'example.com': [PUBLIC] }, [{ ...html(''), body: big() }])
    expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
    expect(pulled).toBe(3)
    expect(MAX_BYTES).toBe(2 * 1024 * 1024)
  })

  test('a page that does not answer in time is refused', async () => {
    const d = deps({ 'example.com': [PUBLIC] }, [], 20)
    d.get = (_url, _address, signal) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
    expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
  })

  test('a resolver that does not answer in time is refused', async () => {
    const d = deps({}, [html(PAGE)], 20)
    d.resolve = () => new Promise(() => {})
    expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
    expect(d.gets).toEqual([])
  })

  test('a page with no paragraphs is refused', async () => {
    const d = deps({ 'example.com': [PUBLIC] }, [html('<title>Empty</title><p> </p>')])
    expect(await fetchPage('https://example.com/a', d)).toEqual(REFUSED)
  })
})

describe('a page read', () => {
  test('gives its title, its paragraphs, its address and its site', async () => {
    const d = deps({ 'www.campustimes.example': [PUBLIC] }, [html(PAGE)])
    expect(await fetchPage('https://www.campustimes.example/news/paid-work', d)).toEqual({
      ok: true,
      page: {
        title: 'Paid work | Campus Times',
        paragraphs: ['Most students work.'],
        url: 'https://www.campustimes.example/news/paid-work',
        site: 'campustimes.example',
      },
    })
  })

  test("the article's paragraphs, without nav, header, footer, script or style, and og:title first", () => {
    const page = `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <title>Ignored when og:title is there</title>
  <meta property="og:title" content="Students &amp; paid work: the numbers">
  <style>p { color: red }</style>
  <script>document.write('<p>injected</p>')</script>
</head>
<body>
  <header><p>Site banner</p></header>
  <nav><p>Home · News</p></nav>
  <p>Outside the article.</p>
  <article>
    <header><h1>Students and paid work</h1><p>By a reporter</p></header>
    <p>A survey of 3,100 students   found that
       most work during term.</p>
    <!-- <p>a comment</p> -->
    <p>Those working more than 15 hours &mdash; about 1 in 5 &#8212; saw grades fall&#x2026;</p>
    <script>var s = "<p>not text</p>"</script>
    <p>Second <em>year</em> students<br>worked most.
    <div><p>A quote, nested in a div.</p></div>
    <nav><p>Related stories</p></nav>
    <footer><p>© Campus Times</p></footer>
  </article>
  <footer><p>Footer</p></footer>
</body></html>`
    expect(parsePage(page)).toEqual({
      title: 'Students & paid work: the numbers',
      paragraphs: [
        'A survey of 3,100 students found that most work during term.',
        'Those working more than 15 hours — about 1 in 5 — saw grades fall…',
        'Second year students worked most.',
        'A quote, nested in a div.',
      ],
    })
  })

  test('<title> without og:title; <main> without <article>; <body> without either', () => {
    expect(
      parsePage('<title> The   title </title><body><p>Out.</p><main><p>In main.</p></main></body>'),
    ).toEqual({ title: 'The title', paragraphs: ['In main.'] })
    expect(
      parsePage('<TITLE>T</TITLE><BODY><Header><P>Top</P></Header><P>One.<P>Two.</BODY>'),
    ).toEqual({ title: 'T', paragraphs: ['One.', 'Two.'] })
  })

  test('markup in attributes and stray brackets do not break the reading', () => {
    expect(
      parsePage(
        `<body><p title="a > b" data-x='<p>'>x < y and y > z.</p><p><img alt="<script>">Fine.</p></body>`,
      ),
    ).toEqual({ title: '', paragraphs: ['x < y and y > z.', 'Fine.'] })
  })
})
