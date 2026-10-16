// A look post for the layout tests (fit.test.ts, svg.test.ts): one slide per layout, every slot
// inside its limit.

import type { LayoutId, Slide, Structure } from '../model/types'

const BODY =
  'Students working up to 20 hours a week had grades similar to students who did not work. Above 20 hours a week, pass rates fell by 11 percentage points.'

const firstWords = (n: number) => BODY.split(' ').slice(0, n).join(' ')

/** A look post with one slide per layout, every slot inside its limit. */
export function lookStructure(templateId: string): Structure {
  const slot = (text: string, factual = false) => ({ text, factIds: [], factual })
  const slide = (layout: LayoutId, slots: Record<string, ReturnType<typeof slot>>): Slide => ({
    kind: layout === 'cover' ? 'cover' : layout === 'takeaway' ? 'take' : 'body',
    layout,
    slots,
  })
  return {
    templateId,
    artPrompt: 'An open notebook beside a small desk clock.',
    slides: [
      slide('cover', {
        kicker: slot('Research, briefly'),
        heading: slot('Work less than 20 hours'),
      }),
      slide('picture', { heading: slot('Hours and grades'), body: slot(firstWords(20), true) }),
      slide('number', {
        number: slot('11'),
        label: slot('points lower pass rates'),
        body: slot(firstWords(18), true),
      }),
      slide('bars', {
        heading: slot('Pass rates by hours'),
        labelA: slot('Up to 20 hours'),
        valueA: slot('78%'),
        labelB: slot('Over 20 hours'),
        valueB: slot('67%'),
      }),
      slide('quote', {
        quote: slot('Above 20 hours a week, pass rates fell by 11 percentage points.', true),
        credit: slot('Survey of first-year students'),
      }),
      slide('checklist', {
        heading: slot('Before you take a shift'),
        items: slot('Check your visa hours\nAsk about exam weeks\nKeep one free day'),
      }),
      slide('takeaway', {
        heading: slot('Keep paid work under 20 hours'),
        body: slot(
          'Your first year sets the pace for the years after it, so protect your study time.',
        ),
      }),
    ],
  }
}
