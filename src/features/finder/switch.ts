// The finder's switches, read on the server from the environment, each off unless set to "1", so a
// part can be turned off with no deploy. The finder is also off while the student AI is off
// (STUDENT_AI_OFF, src/features/roads/switch.ts): it cannot search without a model call. Pure.

import { studentAiOff } from '@/features/roads/switch'

type Env = Record<string, string | undefined>

/** The Find panel on the board (story 1). */
export const finderOn = (env: Env): boolean => env.FINDER_ON === '1' && !studentAiOff(env)

/** Related fields, jobs and sample job-market figures on course cards (story 2). */
export const courseDetailOn = (env: Env): boolean => env.COURSE_DETAIL_ON === '1'

/** "What changes" and "Start a new roadmap from it" (story 3). */
export const compareOn = (env: Env): boolean => env.COMPARE_ON === '1'
