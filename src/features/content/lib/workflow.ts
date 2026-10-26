// Who may do what, and at which stage. One pure module read by the commands, the buttons'
// disabled states and their reasons alike (as access.ts is read by commands.ts and the pages).
// Staleness has no rule here: current() already drops a source check or approval that names
// another revision or render, so a missing one means "not done for this version".

import { ACCESS_ERRORS, canEdit, canReview, type Staff } from '@/shared/lib/auth/access'
import type { Pointers } from '../model/artifacts'
import type { CurrentPost } from '../model/current'
import { STAGES, type Stage } from '../model/stages'
import type { Fact, FeedSettings, Structure } from '../model/types'
import { COMIC_TEMPLATE_ID } from '../templates'
import { charCount } from '../text/script'
import { unansweredQuestions } from './blog-text'
import { unboundSlots } from './claims'
import { comicCaptionError } from './comic-rules'
import { runningReason } from './running'
import { picturesDrawn } from './steps'

export const WORKFLOW_ERRORS = {
  notAuthorised: ACCESS_ERRORS.notAuthorised,
  movedOn: 'This post has moved on. Reload to see where it is.',
  running: 'Already running. Wait for it to finish.',
  ticks: 'Tick one to three templates.',
  noPick: 'Pick a structure first.',
  noTheme: 'Choose a theme first.',
  unbound: 'A claim has no source. Fix it before approving.',
  fitFailed: 'Fix the failing fit checks before rendering.',
  checkFirst: 'The source check has not finished on this version yet.',
  notFound: 'Remove each claim the source check could not find, or mark it as editorial opinion.',
  missingSetting: 'Choose the layer, audience and expiry before sending to review.',
  whyLine: 'Personal and matched posts always say why',
  featuredEveryone: 'Featured posts go to everyone',
  waitingForReviewer: 'Waiting for a reviewer',
  reasonRequired: 'Give a one-line reason.',
  notLive: 'Only a live feed post can be adapted.',
  captionCheck: 'Run the source check on the new wording before exporting.',
  coverIdea: 'A cover idea is at most 120 characters.',
  restoreGate: 'Approve a structure before restoring an approved version.',
  earlierFacts: 'Made from earlier facts.',
  page: 'Choose one of the pages, or None.',
  noPublished: 'This post has no published version.',
  changesStep: 'Choose the step that needs changes.',
  look: 'Choose Field Notes, Data Desk or Postcard.',
  preset: 'Choose Pop or Subdued.',
  ideas: 'Pick one idea, or up to four to combine.',
  nudge: 'Choose one of the text chips.',
  plentyIdeas: "That's plenty of ideas. Pick one, or go back to the source to start again.",
  planFirst: 'Plan the images first.',
  drawImages: 'Use Draw images for this post.',
  imageNudge: 'Choose one of the image chips.',
  scene: 'Write the scene in 1 to 200 characters.',
  format: 'Choose one of the formats.',
  angle: 'Pick one of the angles.',
  writeFirst: 'Write the blog first.',
  unanswered: 'Answer or remove each question the facts do not answer.',
  blogNotFound: 'Reword or remove each sentence the source check could not find.',
  blogNotLive: 'Publish the blog before making posts from it.',
  notABlog: 'Choose one of the blogs.',
  character: 'Approve the comic character first.',
  panels: 'Draw every panel first.',
} as const

export const EDITOR_ACTIONS = [
  // "Save and remake" and "Continue with this source": the moves forward from the source.
  'remake',
  'continueSource',
  'tick',
  'addFact',
  'removeFact',
  'draft',
  'pick',
  'theme',
  'fixUnbound',
  'editSlot',
  'redraftSlide',
  'nudgeSlide',
  'nudgeVersion',
  'editScene',
  'editPanels',
  'pickIdeas',
  'moreIdeas',
  'editOutline',
  'writeSlides',
  'pickBlogAngle',
  'editBlogOutline',
  'writeBlog',
  'editBlogText',
  'approveBlogText',
  'setSlideLayout',
  'setLook',
  'setPreset',
  'page',
  'sourceWording',
  'researchClaim',
  'addResearchSource',
  'approve',
  'backToSource',
  'backToStructures',
  'withdraw',
  'editLive',
  'discardChanges',
  'render',
  'retryArt',
  'sourceCheck',
  'markOpinion',
  'removeClaim',
  'settings',
  'sendToReview',
  'lightEdit',
  'makeCovers',
  'chooseCover',
  'planImages',
  'editImageScene',
  'drawImages',
  'skipPictures',
  'nudgeImage',
  'embedPostSlides',
  'makePostsFromBlog',
  'makeBlogFromPost',
  'linkToBlog',
  'restore',
  'market',
  'adapt',
  'share',
  'socialApproveLayout',
  'socialRender',
  'socialCaption',
  'socialCheck',
  'socialReset',
  'socialExport',
  'socialLink',
] as const
export const REVIEWER_ACTIONS = ['approvePublish', 'sendBack'] as const
export type PostAction = (typeof EDITOR_ACTIONS)[number] | (typeof REVIEWER_ACTIONS)[number]

/** The steps an editor goes back to (criterion 112): "Back to source", "Back to text". */
export const BACK_TO = ['source', 'structures'] as const
export type BackTo = (typeof BACK_TO)[number]

/** The stages at which a post is its published version: the board's "Live in feed · exported". */
export const LIVE_STAGES: readonly Stage[] = ['live', 'exported']

/**
 * A published post worked on again (criteria 116, 119): students still see what was published,
 * so the Board and the workbench say "Changed since published".
 */
export function changedSincePublished(stage: Stage, publishedApprovalId: string | null): boolean {
  return publishedApprovalId !== null && !LIVE_STAGES.includes(stage)
}

/** "Back to text versions" (criterion 112): from the render, review-ready and covers steps. */
const BACK_TO_STRUCTURES: readonly Stage[] = ['approved', 'rendered']

/**
 * The stages each action may run at. Nothing runs at in_review but the reviewer's actions and the
 * editor's own "Withdraw from review" and "Discard changes" (criteria 115, 119).
 */
export const ACTION_STAGES: Record<PostAction, readonly Stage[]> = {
  // A changed source remade, or the same one continued with (criterion 113); only a changed
  // source is an edit, which moves a post past the source back to it (GD28).
  remake: ['source'],
  continueSource: ['source'],
  tick: ['structures'],
  addFact: ['structures'],
  removeFact: ['structures'],
  draft: ['structures'],
  pick: ['structures'],
  theme: ['structures'],
  fixUnbound: ['structures'],
  editSlot: ['structures'],
  redraftSlide: ['structures'],
  // A text chip on one slide or a whole version (GD10).
  nudgeSlide: ['structures'],
  nudgeVersion: ['structures'],
  // A comic's planned scene, and a panel added, removed or moved, on its storyboard (RC3).
  editScene: ['structures'],
  editPanels: ['structures'],
  // An idea card outlined, or more cards (GD1–GD3, GD32): after the facts, before approval.
  pickIdeas: ['structures'],
  moreIdeas: ['structures'],
  // The picked idea's outline changed, and its slides written to it (GD32).
  editOutline: ['structures'],
  writeSlides: ['structures'],
  // A blog's angle outlined, and its outline changed (BR1, BR2): before its text is approved.
  pickBlogAngle: ['structures'],
  editBlogOutline: ['structures'],
  // A blog's text written from its outline, edited in place, and approved across the gate (BR3).
  writeBlog: ['structures'],
  editBlogText: ['structures'],
  approveBlogText: ['structures'],
  // A slide's layout, a version's look and the post's colour preset: laid out again by code (GD4, GD5, GD9).
  setSlideLayout: ['structures'],
  setLook: ['structures'],
  setPreset: ['structures'],
  // The post's page (criterion 105): it steers the drafts and covers made after, so not past the gate.
  page: ['structures'],
  // The picked version before approval, or the rendered post's revision (criterion 104).
  sourceWording: ['structures', 'rendered'],
  // "Research this" on a sentence the check did not find, where the check shows (BR14): a lookup
  // that saves nothing; a page it found added as a source, its sentence a fact, with the text.
  researchClaim: ['structures', 'rendered'],
  addResearchSource: ['structures'],
  approve: ['structures'],
  // The moves back (criteria 112, 115, 116): records stay, only the stage and pointers move.
  backToSource: ['structures', 'approved', 'rendered'],
  backToStructures: BACK_TO_STRUCTURES,
  withdraw: ['in_review'],
  editLive: ['live'],
  // A published post being worked on again, back to its live version (criterion 119); the command
  // refuses a post with no published version.
  discardChanges: ['source', 'structures', 'approved', 'rendered', 'in_review'],
  render: ['approved'],
  retryArt: ['rendered'],
  // The check runs by itself after each text change; this is its "Try again" where it shows.
  sourceCheck: ['structures', 'rendered'],
  // A sentence the check could not find marked opinion: in the Text step's Checks and at Settings.
  markOpinion: ['structures', 'rendered'],
  removeClaim: ['rendered'],
  settings: ['rendered'],
  sendToReview: ['rendered'],
  lightEdit: ['rendered'],
  makeCovers: ['rendered'],
  chooseCover: ['rendered'],
  // A look post's images (GD12–GD14): planned in words and drawn once the text is approved, the
  // missing ones drawn again after ("Draw remaining"), and one drawn image nudged.
  planImages: ['approved', 'rendered'],
  editImageScene: ['approved', 'rendered'],
  drawImages: ['approved', 'rendered'],
  // "Skip pictures": the slides saved as they look, without drawing, wherever Draw images runs.
  skipPictures: ['approved', 'rendered'],
  nudgeImage: ['rendered'],
  // A linked live post's slides after a blog's section, in place of a picture there (BR4).
  embedPostSlides: ['approved', 'rendered'],
  // Posts and blogs linked both ways (BR6–BR8), at any stage past the source but review: a
  // published blog's posts made from it, also while it is worked on again (the command refuses one
  // not live); a blog made from a post with its facts, and a post linked to a blog.
  makePostsFromBlog: ['structures', 'approved', 'rendered', 'live'],
  makeBlogFromPost: ['structures', 'approved', 'rendered', 'live', 'exported'],
  linkToBlog: ['structures', 'approved', 'rendered', 'live', 'exported'],
  // An earlier text version, wherever the text may still change (criterion 101).
  restore: ['structures', 'approved', 'rendered'],
  market: ['rendered'],
  approvePublish: ['in_review'],
  sendBack: ['in_review'],
  adapt: ['live'],
  // A live feed post shared to the pages' accounts (criteria 9–11): recorded, the stage kept.
  share: ['live', 'exported'],
  socialApproveLayout: ['structures'],
  socialRender: ['approved'],
  socialCaption: ['ready'],
  socialCheck: ['ready'],
  socialReset: ['ready'],
  socialExport: ['ready'],
  socialLink: ['exported'],
}

/**
 * Each edit's home (GD28): the stage it runs at. Made on a passed step of a feed post, the edit
 * moves the post back there first, in the same save (server/commands/shared.ts open): from review
 * it is withdrawn on the way, and a live post keeps its published version for students (criteria
 * 115, 116). A scene's home is the images, where it runs once drawn.
 */
const EDIT_HOMES: Partial<Record<PostAction, Stage>> = {
  remake: 'source',
  tick: 'structures',
  addFact: 'structures',
  removeFact: 'structures',
  draft: 'structures',
  pick: 'structures',
  theme: 'structures',
  fixUnbound: 'structures',
  editSlot: 'structures',
  // The source's wording is a text edit: from a passed step it moves back to the text, as editSlot does.
  sourceWording: 'structures',
  redraftSlide: 'structures',
  nudgeSlide: 'structures',
  nudgeVersion: 'structures',
  editScene: 'structures',
  editPanels: 'structures',
  pickIdeas: 'structures',
  moreIdeas: 'structures',
  editOutline: 'structures',
  writeSlides: 'structures',
  pickBlogAngle: 'structures',
  editBlogOutline: 'structures',
  writeBlog: 'structures',
  editBlogText: 'structures',
  setSlideLayout: 'structures',
  setLook: 'structures',
  setPreset: 'structures',
  page: 'structures',
  // A new source part changes the sources the slides list, so the text is laid out again (BR14).
  addResearchSource: 'structures',
  editImageScene: 'rendered',
}

/** The stages of a feed post an edit moves back from; a social version's never move (GD28). */
const MOVES_BACK_FROM: readonly Stage[] = [
  'structures',
  'approved',
  'rendered',
  'in_review',
  'live',
]

/**
 * The stage an edit made at `stage` first moves the post back to (GD28), or null when the action
 * runs where the post is, or not at all: not an edit, or the post not yet past the edit's home.
 */
export function editHome(action: PostAction, stage: Stage): Stage | null {
  const home = EDIT_HOMES[action]
  if (home === undefined || ACTION_STAGES[action].includes(stage)) return null
  const passed = STAGES.indexOf(stage) > STAGES.indexOf(home)
  return passed && MOVES_BACK_FROM.includes(stage) ? home : null
}

/**
 * The steps only a blog has: its angle, outline and text (BR1–BR3), its posts' slides (BR4), and
 * posts made from it (BR6).
 */
const BLOG_ACTIONS: readonly PostAction[] = [
  'pickBlogAngle',
  'editBlogOutline',
  'writeBlog',
  'editBlogText',
  'approveBlogText',
  'embedPostSlides',
  'makePostsFromBlog',
]

/** A feed post's links to a blog (BR8): a blog is not made from, or linked to, a blog. */
const POST_LINK_ACTIONS: readonly PostAction[] = ['makeBlogFromPost', 'linkToBlog']

/** A feed post's slide steps, which a blog's own steps take the place of. */
const SLIDE_ACTIONS: readonly PostAction[] = [
  'tick',
  'draft',
  'pick',
  'theme',
  'fixUnbound',
  'editSlot',
  'redraftSlide',
  'nudgeSlide',
  'nudgeVersion',
  'pickIdeas',
  'editOutline',
  'writeSlides',
  'setSlideLayout',
  'setLook',
  'approve',
  'skipPictures',
]

/**
 * Why a post of this kind does not run the action, or null: a blog has no slides, ideas outlined
 * slide by slide, chips or slide approval, nor links to a blog, and only a blog has an angle, an
 * outline of sections, text and posts made from it. What the two share (the source, more ideas, research, the moves) runs on either.
 */
export function kindError(action: PostAction, kind: string): string | null {
  const refused = kind === 'blog' ? [...SLIDE_ACTIONS, ...POST_LINK_ACTIONS] : BLOG_ACTIONS
  return refused.includes(action) ? WORKFLOW_ERRORS.movedOn : null
}

const isReviewerAction = (action: PostAction): boolean =>
  (REVIEWER_ACTIONS as readonly string[]).includes(action)

/**
 * Why the viewer may not run the action at this stage, or null. Who first, then where: at its
 * stages, or for an edit, at a passed step it moves the post back from (GD28).
 */
export function actionError(action: PostAction, viewer: Staff, stage: Stage): string | null {
  if (isReviewerAction(action)) {
    if (!canReview(viewer)) {
      return action === 'approvePublish' && canEdit(viewer)
        ? WORKFLOW_ERRORS.waitingForReviewer
        : WORKFLOW_ERRORS.notAuthorised
    }
  } else if (!canEdit(viewer)) {
    return WORKFLOW_ERRORS.notAuthorised
  }
  const runs = ACTION_STAGES[action].includes(stage) || editHome(action, stage) !== null
  return runs ? null : WORKFLOW_ERRORS.movedOn
}

/**
 * Why the viewer may not run the action now, as a control shows it: actionError, and for an edit
 * at a passed step, which the server refuses while any step of the post runs (server/commands/shared.ts open),
 * the running step in words (`waiting`, movesWait), so the control waits disabled (criterion 122).
 */
export function editWaitError(
  action: PostAction,
  viewer: Staff,
  stage: Stage,
  waiting: string | null,
): string | null {
  return actionError(action, viewer, stage) ?? (editHome(action, stage) === null ? null : waiting)
}

/**
 * Why a move back waits while a step of the post runs (criterion 118), in the words the disabled
 * moves show beside them (criterion 122): "Covers are being drawn. Wait for it to finish."
 */
export function stepRunningError(step: string): string {
  return `${runningReason([{ step }])}. Wait for it to finish.`
}

/** Featured goes to everyone; General for everyone carries no why line. */
export function normaliseSettings(s: FeedSettings): FeedSettings {
  const audience =
    s.layer === 'featured' || s.audience.mode === 'everyone'
      ? { mode: 'everyone' as const, rules: [] }
      : s.audience
  const whyLine = s.layer === 'general' && audience.mode === 'everyone' ? null : s.whyLine
  return { ...s, audience, whyLine }
}

/** The settings a post must have chosen before review, in the order the form asks for them. */
export const SETTING_NAMES = ['layer', 'audience', 'expiry'] as const
export type SettingName = (typeof SETTING_NAMES)[number]

/** "Choose the expiry before sending to review.": names exactly the settings missing (criterion 52). */
export function missingSettingError(missing: readonly SettingName[]): string {
  const names = SETTING_NAMES.filter((n) => missing.includes(n))
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  return `Choose the ${list} before sending to review.`
}

export function settingsError(s: FeedSettings | null): string | null {
  if (!s) return WORKFLOW_ERRORS.missingSetting
  if (s.layer === 'featured' && s.audience.mode === 'matched') {
    return WORKFLOW_ERRORS.featuredEveryone
  }
  const needsWhy = s.layer === 'personal' || s.audience.mode === 'matched'
  if (needsWhy && !s.whyLine?.trim()) return WORKFLOW_ERRORS.whyLine
  return null
}

export function approveStructureError(p: Pointers, c: CurrentPost): string | null {
  if (p.picked === null) return WORKFLOW_ERRORS.noPick
  // No theme (a post drafted before draftChoices) is the default one (themeOrDefault), never a refusal.
  const draft = c.drafts?.body.items[p.picked]
  if (!draft || !c.facts) return WORKFLOW_ERRORS.movedOn
  if (unboundSlots(draft.structure, draft.template, c.facts.body.facts).length > 0) {
    return WORKFLOW_ERRORS.unbound
  }
  return draft.template.id === COMIC_TEMPLATE_ID
    ? storyboardError(draft.structure, c.facts.body.facts)
    : null
}

/**
 * Why a comic's storyboard cannot be approved, or null (RC3–RC5), naming the first panel at fault:
 * a panel with no planned scene, no caption, or a caption the comic rules refuse.
 */
function storyboardError(structure: Structure, facts: Fact[]): string | null {
  for (const [i, slide] of structure.slides.entries()) {
    if (!slide.scene?.trim()) return `Plan the scene for panel ${i + 1}.`
    const text = slide.slots.caption?.text ?? ''
    if (!text.trim()) return `Write a caption for panel ${i + 1}.`
    const caption = comicCaptionError(text, facts)
    if (caption) return `Panel ${i + 1}: ${caption}`
  }
  return null
}

/**
 * Why a blog's text cannot be approved, or null (BR3, criterion 43): it is written, every FAQ
 * question has an answer, and the source check of this text has run with every sentence found
 * (or marked opinion). The check counts only for the text it read (model/current.ts).
 */
export function approveBlogTextError(c: CurrentPost): string | null {
  if (!c.blogText) return WORKFLOW_ERRORS.writeFirst
  if (unansweredQuestions(c.blogText.body).length > 0) return WORKFLOW_ERRORS.unanswered
  if (!c.sourceCheck) return WORKFLOW_ERRORS.checkFirst
  return c.sourceCheck.body.claims.some((claim) => claim.result === 'not_found')
    ? WORKFLOW_ERRORS.blogNotFound
    : null
}

export function renderError(c: CurrentPost): string | null {
  if (!c.layout) return WORKFLOW_ERRORS.movedOn
  return c.layout.body.fitChecks.every((check) => check.pass) ? null : WORKFLOW_ERRORS.fitFailed
}

/**
 * Settings, then the source check. No slide vision check gates review: code draws every word, and
 * only cover art is checked, as it arrives (criterion 103, amending 39). A comic has no factual
 * slots, its captions held to the path's facts as they are saved (RC4): every panel drawn instead.
 */
export function sendToReviewError(c: CurrentPost): string | null {
  const settings = settingsError(c.settings?.body ?? null)
  if (settings) return settings
  if (c.revision?.body.template.id === COMIC_TEMPLATE_ID) {
    return picturesDrawn(c) ? null : WORKFLOW_ERRORS.panels
  }
  if (!c.sourceCheck) return WORKFLOW_ERRORS.checkFirst
  if (c.sourceCheck.body.claims.some((claim) => claim.result === 'not_found')) {
    return WORKFLOW_ERRORS.notFound
  }
  return null
}

/** Only a reviewer publishes; nothing waits on a slide vision check (criterion 103). */
export function publishError(viewer: Staff): string | null {
  return canReview(viewer) ? null : WORKFLOW_ERRORS.waitingForReviewer
}

/** The longest cover idea an editor may give (criterion 102). */
export const COVER_IDEA_MAX = 120

/**
 * Null for no idea or one of up to 120 characters as a reader sees them; the art prompt guard is
 * the command's (ai/draft.ts).
 */
export function coverIdeaError(idea: string): string | null {
  return charCount(idea.trim()) > COVER_IDEA_MAX ? WORKFLOW_ERRORS.coverIdea : null
}

/** The kinds of record the history restores: a structure (drafts) before the gate, a revision past it. */
export type RestorableKind = 'drafts' | 'revision'

/**
 * Why a version of this kind cannot be restored at this stage, or null (criterion 101). A
 * structure is restored at any stage where restoring is allowed (past the gate it reopens the
 * structures); a revision only past the gate, since only "Approve structure" crosses it.
 */
export function restoreError(kind: RestorableKind, stage: Stage): string | null {
  return kind === 'revision' && stage === 'structures' ? WORKFLOW_ERRORS.restoreGate : null
}

export function sendBackError(reason: string): string | null {
  const length = charCount(reason.trim())
  return length === 0 || length > 200 ? WORKFLOW_ERRORS.reasonRequired : null
}

/** The caption checked on its wording (criterion 66). */
export function exportError(c: CurrentPost): string | null {
  return c.caption?.body.checked ? null : WORKFLOW_ERRORS.captionCheck
}
