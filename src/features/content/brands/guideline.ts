// The one brand guideline (GD17). guideline.json is the single source: the two presets
// (Pop, Subdued), the tints, and the sentences the image and copy calls are given all
// compile from it. The hex values are brand data drawn into posts, not interface colours.

import { z } from 'zod'
import { type Theme, ThemeSchema } from '../model/types'
import raw from './guideline.json'

export const PRESETS = ['pop', 'subdued'] as const
export type Preset = (typeof PRESETS)[number]

export const SURFACES = ['base', 'block', 'deep'] as const
export type Surface = (typeof SURFACES)[number]

const Hex = z.string().regex(/^#[0-9A-F]{6}$/i)
const Name = z.string().min(1)

/** A surface's colours; `highlightInk` the words on the highlight, when not the surface's ink. */
const SurfaceColoursSchema = z.object({
  bg: Name,
  ink: Name,
  highlight: Name,
  highlightInk: Name.optional(),
  muted: Name,
})
const PresetSchema = z.object({
  base: SurfaceColoursSchema,
  block: SurfaceColoursSchema,
  deep: SurfaceColoursSchema,
})

export const GuidelineSchema = z
  .object({
    palette: z.array(z.object({ name: Name, hex: Hex, role: z.string() })).min(1),
    presets: z.object({ pop: PresetSchema, subdued: PresetSchema }),
    /** Each preset's duotone: a picture's darks in `shadow`, its lights in `light`. */
    tint: z.object({
      pop: z.object({ shadow: Name, light: Name }),
      subdued: z.object({ shadow: Name, light: Name }),
    }),
    art: z.object({
      style: z.string(),
      dos: z.array(z.string()),
      donts: z.array(z.string()),
      neverShow: z.array(z.string()),
    }),
    voice: z.object({ rules: z.array(z.string()), readingLevel: z.string() }),
  })
  .superRefine((g, ctx) => {
    const names = new Set(g.palette.map((c) => c.name))
    const need = (name: string, path: (string | number)[]) => {
      if (!names.has(name)) {
        ctx.addIssue({ code: 'custom', path, message: `"${name}" is not in the palette` })
      }
    }
    for (const preset of PRESETS) {
      for (const surface of SURFACES) {
        for (const [slot, name] of Object.entries(g.presets[preset][surface])) {
          need(name, ['presets', preset, surface, slot])
        }
      }
    }
    for (const preset of PRESETS) {
      need(g.tint[preset].shadow, ['tint', preset, 'shadow'])
      need(g.tint[preset].light, ['tint', preset, 'light'])
    }
  })

export type Guideline = z.infer<typeof GuidelineSchema>

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Validates a guideline and derives everything that reads from it. Exported so tests can inject a changed one. */
export function compile(guideline: Guideline) {
  const g = GuidelineSchema.parse(guideline)
  const hexOf = (name: string): string => {
    const colour = g.palette.find((c) => c.name === name)
    if (!colour) throw new Error(`"${name}" is not in the palette`)
    return colour.hex
  }

  const palette = g.palette.map((c) => `${c.name} ${c.hex} (${c.role})`).join(' ')
  const list = (items: string[]) => items.join(' ')

  return {
    presetThemes(preset: Preset): Record<Surface, Theme> {
      const themes = {} as Record<Surface, Theme>
      for (const surface of SURFACES) {
        const s = g.presets[preset][surface]
        themes[surface] = ThemeSchema.parse({
          id: `${preset}-${surface}`,
          name: `${title(preset)} ${surface}`,
          bg: hexOf(s.bg),
          ink: hexOf(s.ink),
          highlight: hexOf(s.highlight),
          ...(s.highlightInk && { highlightInk: hexOf(s.highlightInk) }),
          muted: hexOf(s.muted),
        })
      }
      return themes
    },

    guidelineFor(use: 'image' | 'copy'): string {
      if (use === 'image') {
        return [
          `Palette: ${palette}`,
          `Style: ${g.art.style}`,
          `Do: ${list(g.art.dos)}`,
          `Do not: ${list(g.art.donts)}`,
          `Never show: ${g.art.neverShow.join('; ')}.`,
        ].join('\n')
      }
      return [`Voice: ${list(g.voice.rules)}`, `Reading level: ${g.voice.readingLevel}`].join('\n')
    },

    paletteHexes(): string[] {
      return g.palette.map((c) => c.hex)
    },
  }
}

export const GUIDELINE: Guideline = GuidelineSchema.parse(raw)

const compiled = compile(GUIDELINE)

export const presetThemes = compiled.presetThemes
export const guidelineFor = compiled.guidelineFor
export const paletteHexes = compiled.paletteHexes
