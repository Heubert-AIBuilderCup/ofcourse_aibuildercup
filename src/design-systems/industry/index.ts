import { Barlow, Barlow_Condensed } from 'next/font/google'
import './theme.css'
import type { DesignSystem } from '../types'

// Self-hosted by next/font; theme.css reads them through these variables.
// Body weights match the utilities in use: font-medium and font-semibold, never font-bold.
const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-industry-body',
  display: 'swap',
})
const heading = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-industry-heading',
  display: 'swap',
})

export const industry: DesignSystem = {
  name: 'Industry',
  fontClassName: `${body.variable} ${heading.variable}`,
}
