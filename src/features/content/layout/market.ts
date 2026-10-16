// The one layout of a market version: the approved revision with the reworded slots and the
// converted figures (lib/market.ts, from the market's rates) as slot overrides, laid out and
// checked by the same engine as the default version (AD-E5). The model's answer is checked with it
// (ai/market.ts) and the saved version is drawn from it (server/commands/market.ts), so the two can
// never disagree about what fits.

import type { LanguageId } from '../languages'
import { applyConversions } from '../lib/market'
import type { Body } from '../model/artifacts'
import type { Conversion, Fact, FitCheck, LaidSlide, SlotFit, Structure } from '../model/types'
import { layoutStructure } from './engine'
import { fitChecks } from './fit'
import { slideColours } from './svg'

export type Reworded = { slide: number; slot: string; text: string }

export function layoutMarket(input: {
  revision: Body<'revision'>
  slots: Reworded[]
  conversions: Conversion[]
  facts: Fact[]
  sourceTitle: string
  sourceSite?: string
  /** Each paragraph ref to its site, for a source read from several links (GD19). */
  sites?: Record<string, string>
  /** The post's language (GD39): the search line is written in it; English when absent. */
  language?: LanguageId
}): {
  slides: LaidSlide[]
  fits: SlotFit[]
  fitChecks: FitCheck[]
  /** The slots the conversions changed, keyed "<slide>:<slot>". */
  converted: Record<string, string>
} {
  const { revision, slots, conversions, facts, sourceTitle, sourceSite, sites, language } = input
  const { structure, template, brand, themeId } = revision
  // A look checks contrast on its preset's surfaces (GD9).
  const colours = slideColours({ template, brand, themeId })
  if (!colours) throw new Error(`Theme ${themeId} is not in the revision's brand`)
  const reworded = new Map(slots.map((s) => [`${s.slide}:${s.slot}`, s.text]))
  const framed: Structure = {
    ...structure,
    slides: structure.slides.map((slide, i) => ({
      ...slide,
      slots: Object.fromEntries(
        Object.entries(slide.slots).map(([key, slot]) => [
          key,
          { ...slot, text: reworded.get(`${i + 1}:${key}`) ?? slot.text },
        ]),
      ),
    })),
  }
  const converted = applyConversions(framed, conversions)
  const laid = layoutStructure({
    structure,
    template,
    brand,
    sourceTitle,
    sourceSite,
    sites,
    facts,
    slotOverrides: { ...Object.fromEntries(reworded), ...converted },
    language,
  })
  return {
    ...laid,
    fitChecks: fitChecks({
      structure,
      template,
      theme: colours.theme,
      surfaces: colours.surfaces,
      brand,
      layout: laid,
      // A converted figure counts as the figure it converts: what the conversion adds is not
      // counted against the slot's length (applyConversions writes it as " (≈ <to>)").
      uncounted: conversions.map((c) => ` (≈ ${c.to})`),
    }),
    converted,
  }
}
