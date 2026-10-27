'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Spin, Working } from '@/shared/components/Working'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { articleStart, paragraphSite } from '../../lib/sites'
import { postPath } from '../../lib/steps'
import { actionError, editWaitError, type PostAction } from '../../lib/workflow'
import type { Body } from '../../model/artifacts'
import type { CurrentPost } from '../../model/current'
import type { Fact, Span } from '../../model/types'
import { type SourceSentence, sourceSentences } from '../../text/sentences'
import { Control, movesWait, reasonText, tag } from '../parts'
import { usePostAction, usePressedAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'
import {
  linkLines,
  SourceFields,
  type SourceValues,
  sourceFieldsError,
  sourceKindLabel,
} from './SourceForm'

type SourcePaneProps = {
  /** The picked draft (pointers.picked): the paragraphs its bound facts rest on are highlighted (criterion 27). */
  view: Pick<
    WorkbenchView,
    'id' | 'version' | 'stage' | 'current' | 'pointers' | 'running' | 'progress'
  >
  viewer: Staff
  actions: Pick<
    WorkbenchActions,
    'addFactAction' | 'removeFactAction' | 'remakeAction' | 'continueWithSourceAction'
  >
}

const ALREADY_A_FACT = 'Already a fact.'
const HOW_TO_ADD = 'Select a sentence in the article to add it as a fact.'
const HEADLINE = 'Headline claim not in the article'

/** The text with each span wrapped in <mark>; spans are offsets into a paragraph the text starts at `offset` of. Overlaps merge. */
function marked(text: string, spans: Span[], offset = 0): ReactNode[] {
  const ranges = spans
    .map((s) => [Math.max(0, s.start - offset), Math.min(text.length, s.end - offset)] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [start, end] of ranges) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of merged) {
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      <mark
        key={start}
        className="bg-destructive/20 text-foreground underline decoration-destructive underline-offset-2"
      >
        {text.slice(start, end)}
      </mark>,
    )
    at = end
  }
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

/** The paragraph as its sentences, each drawn by `sentence`, with the text between them kept. */
function bySentence(
  paragraph: { ref: string; text: string },
  sentence: (s: SourceSentence) => ReactNode,
): ReactNode[] {
  const parts: ReactNode[] = []
  let at = 0
  for (const s of sourceSentences(paragraph)) {
    if (s.start > at) parts.push(paragraph.text.slice(at, s.start))
    parts.push(sentence(s))
    at = s.end
  }
  if (at < paragraph.text.length) parts.push(paragraph.text.slice(at))
  return parts
}

/** The refs of the paragraphs the picked draft's bound facts rest on. */
function usedRefs(current: CurrentPost, picked: number | null): Set<string> {
  const item = picked === null ? undefined : current.drafts?.body.items[picked]
  const facts = new Map((current.facts?.body.facts ?? []).map((f) => [f.id, f]))
  const refs = new Set<string>()
  for (const slide of item?.structure.slides ?? []) {
    for (const slot of Object.values(slide.slots)) {
      for (const id of slot.factIds) {
        const ref = facts.get(id)?.ref
        if (ref) refs.add(ref)
      }
    }
  }
  return refs
}

/**
 * The remake form's fields as the source holds them: its language, and every link read, else its
 * text (GD18, GD36).
 */
function savedValues(source: Body<'source'>): SourceValues {
  const links = source.parts?.map((p) => p.url) ?? (source.url ? [source.url] : [])
  return {
    language: source.language,
    links: links.join('\n'),
    framing: source.framing ?? '',
    notes: source.notes ?? '',
    text: links.length > 0 ? '' : source.text,
  }
}

/** The fields compared as "Make post" reads them: the language, links by line, the rest trimmed. */
function sameValues(a: SourceValues, b: SourceValues): boolean {
  return (
    a.language === b.language &&
    linkLines(a.links).join('\n') === linkLines(b.links).join('\n') &&
    a.text.trim() === b.text.trim() &&
    a.framing.trim() === b.framing.trim() &&
    a.notes.trim() === b.notes.trim()
  )
}

/**
 * The source step for an editor (criterion 113): the fields "Make post" takes (GD18), prefilled
 * from the source, and "Save and remake" once they differ; at the source, while the post still has
 * its facts, "Continue with this source" goes back to its versions unchanged, or drafts them.
 */
function SourceEdit({
  view,
  source,
  actions,
  canContinue,
  waiting = null,
}: {
  view: SourcePaneProps['view']
  source: Body<'source'>
  actions: SourcePaneProps['actions']
  canContinue: boolean
  /** Past the source, the running step in words: the change waits for it (criterion 122). */
  waiting?: string | null
}) {
  // Which of the two presses is running, so only it waits as "Running…".
  const { pending, run, pressed, current } = usePressedAction<'remake' | 'resume'>()
  const remaking = pressed('remake')
  const resuming = pressed('resume')
  const router = useRouter()
  // Past the source the post is at its ideas or its text: its own address opens the one (GD27).
  const onward = () => router.push(postPath(view.id))
  const saved = savedValues(source)
  const [values, setValues] = useState(saved)
  // A pasted source opens with its text; one read from links with them.
  const [pasting, setPasting] = useState(saved.text !== '')
  const links = linkLines(values.links)
  const text = pasting ? values.text : ''
  const ready =
    sourceFieldsError(values, pasting) === null &&
    (links.length > 0 || text.trim() !== '') &&
    !sameValues(values, saved)

  const remake = () => {
    run(
      () =>
        actions.remakeAction(view.id, view.version, {
          links,
          text,
          framing: values.framing,
          notes: values.notes,
          language: values.language,
        }),
      'Ideas extracted',
      { onDone: onward, press: 'remake' },
    )
  }
  const resume = () => {
    run(
      () => actions.continueWithSourceAction(view.id, view.version),
      'Back to the text versions',
      { onDone: onward, press: 'resume' },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SourceFields
        values={values}
        onChange={setValues}
        pasting={pasting}
        onPaste={() => setPasting(true)}
        failed={source.failed ?? []}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !ready || waiting !== null} onClick={remake}>
          {remaking && <Spin />}
          {remaking ? 'Running…' : 'Save and remake'}
        </Button>
        {canContinue && view.current.facts && (
          <Button variant="outline" disabled={pending} onClick={resume}>
            {resuming && <Spin />}
            {resuming ? 'Running…' : 'Continue with this source'}
          </Button>
        )}
      </div>
      {current !== null && <Working words="Remaking the facts and ideas…" />}
    </div>
  )
}

/**
 * The source as numbered paragraphs ¶1…¶n, folded to the first lines until "Show article" (GD26),
 * its key ideas, whole, and its facts as numbered rows. An unsupported fact says so, with why, in
 * the error colour, and its span is marked in its paragraph (criteria 22–24); a title sentence no
 * paragraph supports is a "Headline claim not in the article" (96). At structures an editor
 * selects a sentence to add it as a fact ("Add a fact from the article" opens the article), and
 * removes any fact (95). At the
 * source step an editor changes the source in place of the paragraphs (113); from the text
 * versions on, "Change the source" opens the same fields below them, and a changed source moves
 * the post back by itself, with no "Back to source" and no confirm (GD28). Past the source, every
 * edit waits disabled, with the running step in words, while a step of the post runs (122).
 */
export function SourcePane({ view, viewer, actions }: SourcePaneProps) {
  const { pending, run } = usePostAction()
  const [selected, setSelected] = useState<SourceSentence | null>(null)
  // The article folded to its first lines (GD26); "Add a fact from the article" opens it.
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  // A passed source step's fields, opened by "Change the source" (GD28).
  const [changing, setChanging] = useState(false)
  const ids = useId()
  const { current } = view
  const source = current.source?.body
  const facts = current.facts?.body
  if (!source) return <p className="text-muted-foreground">No source yet.</p>

  const canAdd = actionError('addFact', viewer, view.stage) === null
  const canRemove = actionError('removeFact', viewer, view.stage) === null
  const canRemake = actionError('remake', viewer, view.stage) === null
  // At the source its fields stand in place of the article; past it they open below it (GD28).
  const atSource = canRemake && view.stage === 'source'
  const canContinue = actionError('continueSource', viewer, view.stage) === null
  // Past the source every edit waits while any step of the post runs (criterion 122).
  const anyRunning = movesWait(view.running, view.progress)
  const waitOf = (action: PostAction) => editWaitError(action, viewer, view.stage, anyRunning)
  const addWait = canAdd ? waitOf('addFact') : null
  const removeWait = canRemove ? waitOf('removeFact') : null
  const remakeWait = canRemake ? waitOf('remake') : null
  const used = usedRefs(current, view.pointers.picked)
  const list: Fact[] = facts?.facts ?? []
  const unsupported = list.filter((f) => !f.supported && f.span)
  const isFact = (s: SourceSentence) => list.some((f) => f.sentenceId === s.id || f.text === s.text)

  const add = (s: SourceSentence) =>
    run(
      () => actions.addFactAction(view.id, view.version, s.id),
      'Fact added',
      () => setSelected(null),
    )
  const remove = (f: Fact) =>
    run(() => actions.removeFactAction(view.id, view.version, f.id), 'Fact removed')

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="source-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-overline uppercase text-muted-foreground">{sourceKindLabel(source)}</p>
          {/* The article's own title, not the step's name: shown, small. */}
          <h2 id="source-heading" className="text-h4 wrap-anywhere">
            {source.title}
          </h2>
        </div>
        {atSource ? (
          <SourceEdit view={view} source={source} actions={actions} canContinue={canContinue} />
        ) : (
          <div className="flex flex-col gap-2">
            {adding && open && <p className={reasonText}>{HOW_TO_ADD}</p>}
            <ol id={`${ids}-article`} className="flex flex-col gap-2">
              {(open ? source.paragraphs : source.paragraphs.slice(0, 1)).map((p) => {
                const spans = unsupported.flatMap((f) => (f.span?.ref === p.ref ? [f.span] : []))
                const chosen = selected?.ref === p.ref ? selected : null
                // Where each article of a source read from several links starts (GD19).
                const start = articleStart(source, p.ref)
                return (
                  <li
                    key={p.ref}
                    data-used={used.has(p.ref) || undefined}
                    className="flex gap-2 border border-transparent px-2 py-1 text-foreground data-used:border-border"
                  >
                    <span className="shrink-0 font-heading text-caption text-muted-foreground">
                      {p.ref}
                    </span>
                    <div className="flex min-w-0 flex-col gap-2">
                      {start && (
                        <p className="text-overline uppercase text-muted-foreground wrap-anywhere">
                          {start}
                        </p>
                      )}
                      <p
                        className={cn(
                          'text-caption text-foreground wrap-anywhere',
                          !open && 'line-clamp-4',
                        )}
                      >
                        {bySentence(p, (s) =>
                          canAdd ? (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={selected?.id === s.id}
                              onClick={() => setSelected(selected?.id === s.id ? null : s)}
                              className={cn(
                                'inline cursor-pointer text-left underline-offset-2 hover:underline hover:decoration-foreground/40',
                                selected?.id === s.id &&
                                  'underline decoration-primary decoration-2 hover:decoration-primary',
                              )}
                            >
                              {marked(s.text, spans, s.start)}
                            </button>
                          ) : (
                            <span key={s.id}>{marked(s.text, spans, s.start)}</span>
                          ),
                        )}
                      </p>
                      {chosen && (
                        <Control reason={isFact(chosen) ? ALREADY_A_FACT : null}>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={pending || isFact(chosen) || addWait !== null}
                            onClick={() => add(chosen)}
                          >
                            Add as fact
                          </Button>
                        </Control>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={open}
              aria-controls={`${ids}-article`}
              onClick={() => setOpen(!open)}
            >
              {open ? 'Hide article' : 'Show article'}
            </Button>
          </div>
        )}
        {canRemake && !atSource && (
          <div className="flex flex-col gap-4">
            <Control reason={remakeWait}>
              <Button
                variant="outline"
                size="sm"
                aria-expanded={changing}
                aria-controls={`${ids}-change`}
                disabled={remakeWait !== null}
                onClick={() => setChanging(!changing)}
              >
                Change the source
              </Button>
            </Control>
            {changing && (
              <div id={`${ids}-change`}>
                <SourceEdit
                  view={view}
                  source={source}
                  actions={actions}
                  canContinue={false}
                  waiting={remakeWait}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {facts && (
        <>
          <section aria-labelledby="ideas-heading" className="flex flex-col gap-2">
            <h3 id="ideas-heading" className="text-h4">
              Key ideas
            </h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-caption wrap-anywhere">
              {facts.keyIdeas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="facts-heading" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 id="facts-heading" className="text-h4">
                Facts
              </h3>
              {facts.replays.length > 0 && <span className={tag}>Replay</span>}
            </div>
            {(removeWait ?? addWait) && <p className={reasonText}>{removeWait ?? addWait}</p>}
            {/* Each fact numbered by the sentence it is, as its chip on a slide reads (GD23). */}
            <ol className="flex flex-col gap-3">
              {list.map((f) => {
                const site = paragraphSite(source, f.ref)
                return (
                  <li key={f.id} className="flex items-start gap-2 text-caption">
                    <span className="shrink-0 font-heading text-muted-foreground">
                      {f.headline ? 'Title' : (f.sentenceId ?? f.ref)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 wrap-anywhere">
                      <span>{f.text}</span>
                      {/* The link it came from, for a source read from several (GD19). */}
                      {site && <span className="text-muted-foreground">{site}</span>}
                      {!f.supported && (
                        <>
                          <span className="font-semibold text-destructive">
                            {f.headline ? HEADLINE : 'Not supported'}
                          </span>
                          {f.why && <span className="text-destructive">{f.why}</span>}
                        </>
                      )}
                    </div>
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={pending || removeWait !== null}
                        onClick={() => remove(f)}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                )
              })}
            </ol>
            {canAdd && !atSource && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={addWait !== null}
                onClick={() => {
                  setOpen(true)
                  setAdding(true)
                }}
              >
                Add a fact from the article
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  )
}
