// The student's paths that more than one feature links to (opening, road and roadmaps): where
// onboarding begins, her roadmaps, one roadmap's board, a copy's draft and the old board. A
// feature's own paths stay in it (onboarding's steps in features/opening/model/onboarding.ts).

/** Step 00, the picture: where onboarding begins, and where Start from scratch sends her. */
export const PICTURE_PATH = '/onboarding/character'
/** "Your roadmaps": the list a finished student lands on. */
export const ROADMAPS_PATH = '/roadmaps'
/** One of her roadmaps' boards. */
export const roadmapPath = (id: string) => `${ROADMAPS_PATH}/${id}`
/** A new roadmap's draft: a copy of this one, or from scratch without one. */
export const newRoadmapPath = (from?: string) =>
  from ? `${ROADMAPS_PATH}/new?from=${encodeURIComponent(from)}` : `${ROADMAPS_PATH}/new`
/** The old board: now only a redirect to her last opened roadmap. */
export const ROAD_PATH = '/road'
