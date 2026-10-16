// The student side's switches, each with no deploy (a Cloud Run env var change). Pure.
// STUDENT_ROADS_OFF=1 puts every board back on Priya's road and turns the why text and Ask off.
// STUDENT_AI_OFF=1 keeps her matched road but makes no student model call: the why keeps its
// template and Ask its suggested questions only (criterion 81).

type Env = Record<string, string | undefined>

export function studentRoadsOff(env: Env): boolean {
  return env.STUDENT_ROADS_OFF === '1'
}

export function studentAiOff(env: Env): boolean {
  return env.STUDENT_AI_OFF === '1'
}
