// Sample figures for the demo, not from any provider; shown under "Job market (sample data)".
// Written by hand, one row per occupation per finder city. The shape of it: Sydney and Melbourne
// have the most openings, then Perth and Adelaide, then Geelong and Hobart; security and data
// pay above general IT; Diploma-level occupations sit lower. A row names no employer.

import type { JobMarketRow } from './types'

export const JOB_MARKET: readonly JobMarketRow[] = [
  // Security
  { code: '262112', cityId: 'sydney', openings: 620, payLowK: 104, payHighK: 142 },
  { code: '262112', cityId: 'melbourne', openings: 570, payLowK: 102, payHighK: 140 },
  { code: '262112', cityId: 'perth', openings: 310, payLowK: 103, payHighK: 141 },
  { code: '262112', cityId: 'adelaide', openings: 248, payLowK: 100, payHighK: 138 },
  { code: '262112', cityId: 'geelong', openings: 105, payLowK: 98, payHighK: 136 },
  { code: '262112', cityId: 'hobart', openings: 74, payLowK: 97, payHighK: 135 },
  // Software
  { code: '261313', cityId: 'sydney', openings: 900, payLowK: 92, payHighK: 132 },
  { code: '261313', cityId: 'melbourne', openings: 828, payLowK: 90, payHighK: 130 },
  { code: '261313', cityId: 'perth', openings: 450, payLowK: 91, payHighK: 131 },
  { code: '261313', cityId: 'adelaide', openings: 360, payLowK: 88, payHighK: 128 },
  { code: '261313', cityId: 'geelong', openings: 153, payLowK: 86, payHighK: 126 },
  { code: '261313', cityId: 'hobart', openings: 108, payLowK: 85, payHighK: 125 },
  // Sys analyst
  { code: '261112', cityId: 'sydney', openings: 380, payLowK: 86, payHighK: 120 },
  { code: '261112', cityId: 'melbourne', openings: 350, payLowK: 84, payHighK: 118 },
  { code: '261112', cityId: 'perth', openings: 190, payLowK: 85, payHighK: 119 },
  { code: '261112', cityId: 'adelaide', openings: 152, payLowK: 82, payHighK: 116 },
  { code: '261112', cityId: 'geelong', openings: 65, payLowK: 80, payHighK: 114 },
  { code: '261112', cityId: 'hobart', openings: 46, payLowK: 79, payHighK: 113 },
  // Data
  { code: '224115', cityId: 'sydney', openings: 540, payLowK: 102, payHighK: 144 },
  { code: '224115', cityId: 'melbourne', openings: 497, payLowK: 100, payHighK: 142 },
  { code: '224115', cityId: 'perth', openings: 270, payLowK: 101, payHighK: 143 },
  { code: '224115', cityId: 'adelaide', openings: 216, payLowK: 98, payHighK: 140 },
  { code: '224115', cityId: 'geelong', openings: 92, payLowK: 96, payHighK: 138 },
  { code: '224115', cityId: 'hobart', openings: 65, payLowK: 95, payHighK: 137 },
  // BA
  { code: '224999', cityId: 'sydney', openings: 700, payLowK: 88, payHighK: 124 },
  { code: '224999', cityId: 'melbourne', openings: 644, payLowK: 86, payHighK: 122 },
  { code: '224999', cityId: 'perth', openings: 350, payLowK: 87, payHighK: 123 },
  { code: '224999', cityId: 'adelaide', openings: 280, payLowK: 84, payHighK: 120 },
  { code: '224999', cityId: 'geelong', openings: 119, payLowK: 82, payHighK: 118 },
  { code: '224999', cityId: 'hobart', openings: 84, payLowK: 81, payHighK: 117 },
  // Psych
  { code: '272399', cityId: 'sydney', openings: 260, payLowK: 82, payHighK: 116 },
  { code: '272399', cityId: 'melbourne', openings: 239, payLowK: 80, payHighK: 114 },
  { code: '272399', cityId: 'perth', openings: 130, payLowK: 81, payHighK: 115 },
  { code: '272399', cityId: 'adelaide', openings: 104, payLowK: 78, payHighK: 112 },
  { code: '272399', cityId: 'geelong', openings: 44, payLowK: 76, payHighK: 110 },
  { code: '272399', cityId: 'hobart', openings: 31, payLowK: 75, payHighK: 109 },
  // Nurse
  { code: '254499', cityId: 'sydney', openings: 1100, payLowK: 76, payHighK: 106 },
  { code: '254499', cityId: 'melbourne', openings: 1012, payLowK: 74, payHighK: 104 },
  { code: '254499', cityId: 'perth', openings: 550, payLowK: 75, payHighK: 105 },
  { code: '254499', cityId: 'adelaide', openings: 440, payLowK: 72, payHighK: 102 },
  { code: '254499', cityId: 'geelong', openings: 187, payLowK: 70, payHighK: 100 },
  { code: '254499', cityId: 'hobart', openings: 132, payLowK: 69, payHighK: 99 },
  // HPO
  { code: '251911', cityId: 'sydney', openings: 140, payLowK: 74, payHighK: 102 },
  { code: '251911', cityId: 'melbourne', openings: 129, payLowK: 72, payHighK: 100 },
  { code: '251911', cityId: 'perth', openings: 70, payLowK: 73, payHighK: 101 },
  { code: '251911', cityId: 'adelaide', openings: 56, payLowK: 70, payHighK: 98 },
  { code: '251911', cityId: 'geelong', openings: 24, payLowK: 68, payHighK: 96 },
  { code: '251911', cityId: 'hobart', openings: 17, payLowK: 67, payHighK: 95 },
  // Community
  { code: '411611', cityId: 'sydney', openings: 420, payLowK: 56, payHighK: 74 },
  { code: '411611', cityId: 'melbourne', openings: 386, payLowK: 54, payHighK: 72 },
  { code: '411611', cityId: 'perth', openings: 210, payLowK: 55, payHighK: 73 },
  { code: '411611', cityId: 'adelaide', openings: 168, payLowK: 52, payHighK: 70 },
  { code: '411611', cityId: 'geelong', openings: 71, payLowK: 50, payHighK: 68 },
  { code: '411611', cityId: 'hobart', openings: 50, payLowK: 49, payHighK: 67 },
  // Civil
  { code: '233211', cityId: 'sydney', openings: 480, payLowK: 84, payHighK: 120 },
  { code: '233211', cityId: 'melbourne', openings: 442, payLowK: 82, payHighK: 118 },
  { code: '233211', cityId: 'perth', openings: 240, payLowK: 83, payHighK: 119 },
  { code: '233211', cityId: 'adelaide', openings: 192, payLowK: 80, payHighK: 116 },
  { code: '233211', cityId: 'geelong', openings: 82, payLowK: 78, payHighK: 114 },
  { code: '233211', cityId: 'hobart', openings: 58, payLowK: 77, payHighK: 113 },
  // UX
  { code: '232411', cityId: 'sydney', openings: 210, payLowK: 86, payHighK: 122 },
  { code: '232411', cityId: 'melbourne', openings: 193, payLowK: 84, payHighK: 120 },
  { code: '232411', cityId: 'perth', openings: 105, payLowK: 85, payHighK: 121 },
  { code: '232411', cityId: 'adelaide', openings: 84, payLowK: 82, payHighK: 118 },
  { code: '232411', cityId: 'geelong', openings: 36, payLowK: 80, payHighK: 116 },
  { code: '232411', cityId: 'hobart', openings: 25, payLowK: 79, payHighK: 115 },
  // ICT support
  { code: '313212', cityId: 'sydney', openings: 520, payLowK: 54, payHighK: 72 },
  { code: '313212', cityId: 'melbourne', openings: 478, payLowK: 52, payHighK: 70 },
  { code: '313212', cityId: 'perth', openings: 260, payLowK: 53, payHighK: 71 },
  { code: '313212', cityId: 'adelaide', openings: 208, payLowK: 50, payHighK: 68 },
  { code: '313212', cityId: 'geelong', openings: 88, payLowK: 48, payHighK: 66 },
  { code: '313212', cityId: 'hobart', openings: 62, payLowK: 47, payHighK: 65 },
  // Prog admin
  { code: '511112', cityId: 'sydney', openings: 300, payLowK: 58, payHighK: 76 },
  { code: '511112', cityId: 'melbourne', openings: 276, payLowK: 56, payHighK: 74 },
  { code: '511112', cityId: 'perth', openings: 150, payLowK: 57, payHighK: 75 },
  { code: '511112', cityId: 'adelaide', openings: 120, payLowK: 54, payHighK: 72 },
  { code: '511112', cityId: 'geelong', openings: 51, payLowK: 52, payHighK: 70 },
  { code: '511112', cityId: 'hobart', openings: 36, payLowK: 51, payHighK: 69 },
  // Accountant
  { code: '221111', cityId: 'sydney', openings: 760, payLowK: 80, payHighK: 114 },
  { code: '221111', cityId: 'melbourne', openings: 699, payLowK: 78, payHighK: 112 },
  { code: '221111', cityId: 'perth', openings: 380, payLowK: 79, payHighK: 113 },
  { code: '221111', cityId: 'adelaide', openings: 304, payLowK: 76, payHighK: 110 },
  { code: '221111', cityId: 'geelong', openings: 129, payLowK: 74, payHighK: 108 },
  { code: '221111', cityId: 'hobart', openings: 91, payLowK: 73, payHighK: 107 },
  // Structural
  { code: '233214', cityId: 'sydney', openings: 170, payLowK: 84, payHighK: 120 },
  { code: '233214', cityId: 'melbourne', openings: 156, payLowK: 82, payHighK: 118 },
  { code: '233214', cityId: 'perth', openings: 85, payLowK: 83, payHighK: 119 },
  { code: '233214', cityId: 'adelaide', openings: 68, payLowK: 80, payHighK: 116 },
  { code: '233214', cityId: 'geelong', openings: 29, payLowK: 78, payHighK: 114 },
  { code: '233214', cityId: 'hobart', openings: 20, payLowK: 77, payHighK: 113 },
  // Engineering manager
  { code: '133211', cityId: 'sydney', openings: 140, payLowK: 112, payHighK: 148 },
  { code: '133211', cityId: 'melbourne', openings: 129, payLowK: 110, payHighK: 146 },
  { code: '133211', cityId: 'perth', openings: 70, payLowK: 111, payHighK: 147 },
  { code: '133211', cityId: 'adelaide', openings: 56, payLowK: 108, payHighK: 144 },
  { code: '133211', cityId: 'geelong', openings: 24, payLowK: 106, payHighK: 142 },
  { code: '133211', cityId: 'hobart', openings: 17, payLowK: 105, payHighK: 141 },
  // Mechanical
  { code: '233512', cityId: 'sydney', openings: 260, payLowK: 82, payHighK: 118 },
  { code: '233512', cityId: 'melbourne', openings: 239, payLowK: 80, payHighK: 116 },
  { code: '233512', cityId: 'perth', openings: 130, payLowK: 81, payHighK: 117 },
  { code: '233512', cityId: 'adelaide', openings: 104, payLowK: 78, payHighK: 114 },
  { code: '233512', cityId: 'geelong', openings: 44, payLowK: 76, payHighK: 112 },
  { code: '233512', cityId: 'hobart', openings: 31, payLowK: 75, payHighK: 111 },
  // Electrical
  { code: '233311', cityId: 'sydney', openings: 300, payLowK: 84, payHighK: 120 },
  { code: '233311', cityId: 'melbourne', openings: 276, payLowK: 82, payHighK: 118 },
  { code: '233311', cityId: 'perth', openings: 150, payLowK: 83, payHighK: 119 },
  { code: '233311', cityId: 'adelaide', openings: 120, payLowK: 80, payHighK: 116 },
  { code: '233311', cityId: 'geelong', openings: 51, payLowK: 78, payHighK: 114 },
  { code: '233311', cityId: 'hobart', openings: 36, payLowK: 77, payHighK: 113 },
  // Health and welfare manager
  { code: '134299', cityId: 'sydney', openings: 180, payLowK: 100, payHighK: 136 },
  { code: '134299', cityId: 'melbourne', openings: 166, payLowK: 98, payHighK: 134 },
  { code: '134299', cityId: 'perth', openings: 90, payLowK: 99, payHighK: 135 },
  { code: '134299', cityId: 'adelaide', openings: 72, payLowK: 96, payHighK: 132 },
  { code: '134299', cityId: 'geelong', openings: 31, payLowK: 94, payHighK: 130 },
  { code: '134299', cityId: 'hobart', openings: 22, payLowK: 93, payHighK: 129 },
  // Health information manager
  { code: '224213', cityId: 'sydney', openings: 90, payLowK: 80, payHighK: 112 },
  { code: '224213', cityId: 'melbourne', openings: 83, payLowK: 78, payHighK: 110 },
  { code: '224213', cityId: 'perth', openings: 45, payLowK: 79, payHighK: 111 },
  { code: '224213', cityId: 'adelaide', openings: 36, payLowK: 76, payHighK: 108 },
  { code: '224213', cityId: 'geelong', openings: 15, payLowK: 74, payHighK: 106 },
  { code: '224213', cityId: 'hobart', openings: 11, payLowK: 73, payHighK: 105 },
  // Organisational psych
  { code: '272313', cityId: 'sydney', openings: 120, payLowK: 86, payHighK: 120 },
  { code: '272313', cityId: 'melbourne', openings: 110, payLowK: 84, payHighK: 118 },
  { code: '272313', cityId: 'perth', openings: 60, payLowK: 85, payHighK: 119 },
  { code: '272313', cityId: 'adelaide', openings: 48, payLowK: 82, payHighK: 116 },
  { code: '272313', cityId: 'geelong', openings: 20, payLowK: 80, payHighK: 114 },
  { code: '272313', cityId: 'hobart', openings: 14, payLowK: 79, payHighK: 113 },
  // Multimedia
  { code: '232413', cityId: 'sydney', openings: 160, payLowK: 76, payHighK: 108 },
  { code: '232413', cityId: 'melbourne', openings: 147, payLowK: 74, payHighK: 106 },
  { code: '232413', cityId: 'perth', openings: 80, payLowK: 75, payHighK: 107 },
  { code: '232413', cityId: 'adelaide', openings: 64, payLowK: 72, payHighK: 104 },
  { code: '232413', cityId: 'geelong', openings: 27, payLowK: 70, payHighK: 102 },
  { code: '232413', cityId: 'hobart', openings: 19, payLowK: 69, payHighK: 101 },
  // Supply and distribution manager
  { code: '133611', cityId: 'sydney', openings: 280, payLowK: 98, payHighK: 134 },
  { code: '133611', cityId: 'melbourne', openings: 258, payLowK: 96, payHighK: 132 },
  { code: '133611', cityId: 'perth', openings: 140, payLowK: 97, payHighK: 133 },
  { code: '133611', cityId: 'adelaide', openings: 112, payLowK: 94, payHighK: 130 },
  { code: '133611', cityId: 'geelong', openings: 48, payLowK: 92, payHighK: 128 },
  { code: '133611', cityId: 'hobart', openings: 34, payLowK: 91, payHighK: 127 },
]

const BY_KEY = new Map(JOB_MARKET.map((r) => [`${r.code}:${r.cityId}`, r]))

/** The sample row for an occupation in a city, or null when there is none. */
export function jobMarketFor(code: string, cityId: string): JobMarketRow | null {
  return BY_KEY.get(`${code}:${cityId}`) ?? null
}
