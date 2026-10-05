import { expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'

const wanted = [
  'button',
  'card',
  'input',
  'label',
  'field',
  'avatar',
  'badge',
  'dialog',
  'sheet',
  'drawer',
  'popover',
  'command',
  'tabs',
  'tooltip',
  'sonner',
  'skeleton',
  'separator',
  'scroll-area',
  'switch',
  'select',
  'checkbox',
  'table',
  'progress',
  'spinner',
  'empty',
]

test('the shadcn components the starter ships are installed', () => {
  const files = readdirSync(new URL('.', import.meta.url)).map((f) => f.replace(/\.tsx$/, ''))
  for (const name of wanted) expect(files).toContain(name)
})
