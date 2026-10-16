// The figures the roads' copy states, read from the catalogue each time, so a catalogue edit
// changes the cards with it: a course's fees, a city's living costs and whether it is regional.

import { cityById } from '@/features/engine/catalogue'
import { courseById } from './courses'

/** "AUD 33k a year in fees". */
export function feesOf(courseId: string): string {
  const course = courseById(courseId)
  if (!course) throw new Error(`No course "${courseId}"`)
  return `AUD ${course.feeK}k a year in fees`
}

/** "AUD 21k a year to live". */
export const livingOf = (cityId: string): string =>
  `AUD ${cityById(cityId).livingK}k a year to live`

/** "Counts as regional · about AUD 21k a year to live", or "Not regional · …". */
export const citySub = (cityId: string): string =>
  `${cityById(cityId).regional ? 'Counts as regional' : 'Not regional'} · about ${livingOf(cityId)}`
