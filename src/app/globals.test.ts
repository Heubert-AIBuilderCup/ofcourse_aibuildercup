import { describe, expect, it } from 'bun:test'

const css = await Bun.file(new URL('./globals.css', import.meta.url)).text()

// Icons keep their pixel size while the root font-size scales the design from 1440 to 1920
// (DESIGN.md, Rules: Icons), so their size tokens are px on purpose, not rem.
describe('icon size tokens', () => {
  const tokens = {
    'icon-xs': '12px',
    'icon-sm': '14px',
    icon: '16px',
    'icon-md': '18px',
    'icon-lg': '20px',
  }

  for (const [name, value] of Object.entries(tokens)) {
    it(`--spacing-${name} is ${value}`, () => {
      const match = css.match(new RegExp(`--spacing-${name}:\\s*([^;]+);`))
      expect(match?.[1].trim()).toBe(value)
    })
  }
})
