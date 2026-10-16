// What Ask says and how long her question may be: one definition for the server, which writes
// these, and the card, which shows them. No imports, so the browser loads nothing else with it.

/** The longest question she may type, in characters. */
export const ASK_QUESTION_MAX = 300

/** The one refusal: what she reads when the rows do not answer her question (24). */
export const NO_DATA = "I don't have that in our data."
/** What she reads when the model failed or timed out (28). */
export const ASK_FAILED = "I couldn't answer that just now. Try one of the questions above."
/** What she reads at the daily cap (26). */
export const ASK_CAPPED =
  "You've reached today's limit of questions. The suggested ones above still work."

/** Words of a question about visas, the law or safety: a refusal of it names who can answer (70). */
const COUNSELLOR_WORDS =
  /\b(visas?|pr|permanent residen(cy|ce)|laws?|(un)?lawful|lawyers?|(il)?legal(ly)?|police|(un)?saf(e|ety|ely)|harass\w*)\b/i

/** Whether her question is one a migration agent or counsellor should answer (criterion 70). */
export const needsCounsellor = (question: string): boolean => COUNSELLOR_WORDS.test(question)

/**
 * What came back for her question: the reply she reads, the rows an answer cited, and for a
 * refusal whether the question needs a migration agent or counsellor.
 */
export type AskReply = {
  kind: 'answered' | 'refused' | 'failed' | 'capped'
  reply: string
  cited: { id: string; text: string }[]
  counsellor?: boolean
}
