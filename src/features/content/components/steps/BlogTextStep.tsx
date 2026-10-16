'use client'

import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { Staff } from '@/shared/lib/auth/access'
import { cn } from '@/shared/lib/utils'
import { BLOG_POINT_MAX, HEADING_MAX } from '../../lib/blog-outline'
import { blogAspect } from '../../lib/blog-pictures'
import {
  BLOG_ANSWER_MAX,
  BLOG_BODY_MAX,
  BLOG_TEXT_COUNTS,
  type BlogTextEdit,
} from '../../lib/blog-text'
import { paragraphSite } from '../../lib/sites'
import { stepPath } from '../../lib/steps'
import {
  ACTION_STAGES,
  actionError,
  approveBlogTextError,
  editWaitError,
  WORKFLOW_ERRORS,
} from '../../lib/workflow'
import type { BlogTarget } from '../../model/types'
import { FactNumber } from '../FactChip'
import { Control, movesWait, reasonText, StepAction, StepAreas, Working } from '../parts'
import { SlotField } from '../SlotField'
import { usePostAction } from '../usePostAction'
import type { WorkbenchActions, WorkbenchView } from '../Workbench'
import { countOf } from './text/shared'

export type BlogTextStepProps = {
  view: WorkbenchView
  viewer: Staff
  actions: Pick<WorkbenchActions, 'editBlogSectionAction' | 'approveBlogTextAction'>
}

/** The steps that change the text or read it (server/commands/blog.ts, check.ts). */
const BLOG_TEXT_STEP = 'blog_text'
const CHECK_STEP = 'source_check'

/** Where the admin reads a stored picture (src/app/admin/(console)/assets). */
const assetHref = (id: string) => `/admin/assets/${encodeURIComponent(id)}`

const sameTarget = (a: BlogTarget, b: BlogTarget) =>
  a === 'cover' ? b === 'cover' : b !== 'cover' && a.after === b.after

/**
 * A blog as it will read (BR3, BR4): the cover, the key takeaways, each section with its heading,
 * its body and what sits after it (its picture, or a linked post's slides in its place), then the
 * FAQ. With `onSelect`, each section offers "Edit section n", the selected one framed.
 */
export function BlogPreview({
  view,
  selected,
  onSelect,
}: {
  view: WorkbenchView
  selected?: number
  onSelect?: (index: number) => void
}) {
  const ids = useId()
  const text = view.current.blogText?.body ?? null
  if (!text) return <p className={reasonText}>No text yet.</p>
  const pictures = view.current.blogImages?.body ?? null
  const pictureAt = (target: BlogTarget) => {
    const p = pictures?.images.find((i) => sameTarget(i.target, target))
    const assetId = p?.tintedAssetId ?? p?.assetId ?? null
    return p && assetId ? { assetId, alt: p.scene, target: p.target } : null
  }
  const embedAfter = (n: number) => pictures?.embeds.find((e) => e.after === n) ?? null
  const postTitle = (id: string) =>
    view.blogPosts?.find((p) => p.id === id)?.title ?? 'A linked post'
  const cover = pictureAt('cover')

  const picture = (p: NonNullable<ReturnType<typeof pictureAt>>) => (
    // A stored PNG: nothing to optimise.
    // biome-ignore lint/performance/noImgElement: next/image would re-encode the stored picture.
    <img
      src={assetHref(p.assetId)}
      alt={p.alt}
      {...(blogAspect(p.target) === '16:9'
        ? { width: 1600, height: 900 }
        : { width: 1200, height: 900 })}
      className="block h-auto w-full border"
    />
  )

  return (
    <article aria-label={view.title} className="flex flex-col gap-section">
      {cover && picture(cover)}
      <section aria-labelledby={`${ids}-takeaways`} className="flex max-w-prose flex-col gap-2">
        <h3 id={`${ids}-takeaways`} className="text-h4">
          Key takeaways
        </h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {text.takeaways.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a takeaway is its place.
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>
      {text.sections.map((section, i) => {
        const after = pictureAt({ after: i + 1 })
        const embed = embedAfter(i + 1)
        return (
          <section
            // biome-ignore lint/suspicious/noArrayIndexKey: a section is its place in the blog.
            key={i}
            aria-labelledby={`${ids}-section-${i}`}
            className={cn(
              'flex flex-col gap-stack',
              onSelect && '-m-2 border border-transparent p-2',
              onSelect && selected === i && 'border-primary',
            )}
          >
            <div className="flex max-w-prose flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <h3 id={`${ids}-section-${i}`} className="text-h3">
                  {section.heading}
                </h3>
                {onSelect && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-pressed={selected === i}
                    aria-label={`Edit section ${i + 1}`}
                    onClick={() => onSelect(i)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-line">{section.body}</p>
            </div>
            {embed ? (
              <p className="border px-3 py-2 text-caption text-muted-foreground">
                {`Slides of “${postTitle(embed.postId)}” sit here`}
              </p>
            ) : (
              after && picture(after)
            )}
          </section>
        )
      })}
      <section aria-labelledby={`${ids}-faq`} className="flex max-w-prose flex-col gap-2">
        <h3 id={`${ids}-faq`} className="text-h4">
          FAQ
        </h3>
        <dl className="flex flex-col gap-stack">
          {text.faq.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a question is its place.
            <div key={i} className="flex flex-col gap-1">
              <dt className="font-heading">{f.q}</dt>
              <dd>{f.a || <span className={reasonText}>Not answered</span>}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  )
}

/** A section's heading or body counted as its limit counts it (C1). */
const charsOf = (max: number) => (text: string) => countOf(text, { unit: 'chars', min: 1, max })

/**
 * A blog's text (BR3), as GD30 lays a step out: the article on one side as it will read, and on
 * the other the selected section's heading and body, edited in place (saved when the field is
 * left changed) with live counts and a refusal under its field (C1), the facts it rests on as ¶
 * chips, and the sentences of it the source check could not find; then the takeaways and the FAQ, each edited in place, and a takeaway or question
 * removed while more than three are left; then "Approve text → Images", which waits with its
 * reason until every question is answered and the check of this text is clean. The check runs by
 * itself after each change and the step says so. Each edit asks editWaitError, so at a passed
 * step it waits while any step runs (criterion 122) and moves the blog back to its text (GD28); a
 * viewer who may not edit sees the article only.
 */
export function BlogTextStep({ view, viewer, actions }: BlogTextStepProps) {
  const { pending, run, error } = usePostAction()
  const router = useRouter()
  const ids = useId()
  const [selected, setSelected] = useState(0)
  // The section field the last save was for, where its refusal shows (C1); null for any other.
  const [actedOn, setActedOn] = useState<'heading' | 'body' | null>(null)
  const text = view.current.blogText?.body ?? null
  const facts = view.current.facts?.body.facts ?? []
  const source = view.current.source?.body ?? null
  const claims = view.current.sourceCheck?.body.claims ?? []
  const running = view.running.includes(BLOG_TEXT_STEP) || view.running.includes(CHECK_STEP)
  const waiting = running ? movesWait(view.running, view.progress) : null

  const editReason = editWaitError(
    'editBlogText',
    viewer,
    view.stage,
    movesWait(view.running, view.progress),
  )
  const editable = editReason !== WORKFLOW_ERRORS.notAuthorised
  const disabled = pending || view.running.includes(BLOG_TEXT_STEP) || editReason !== null
  const approveOffered =
    ACTION_STAGES.approveBlogText.includes(view.stage) &&
    actionError('approveBlogText', viewer, view.stage) !== WORKFLOW_ERRORS.notAuthorised
  const approveReason =
    actionError('approveBlogText', viewer, view.stage) ??
    approveBlogTextError(view.current) ??
    waiting

  const save = (edit: BlogTextEdit, done: string) => {
    setActedOn(edit.part === 'section' ? edit.field : null)
    run(() => actions.editBlogSectionAction(view.id, view.version, edit), done)
  }
  const fieldError = (field: 'heading' | 'body') => (actedOn === field ? error : null)
  const approve = () =>
    run(
      () => actions.approveBlogTextAction(view.id, view.version),
      'Text approved',
      () => router.push(stepPath(view.id, 'images')),
    )

  const at = text ? Math.min(selected, text.sections.length - 1) : 0
  const section = text?.sections[at] ?? null
  const sectionFacts = section ? facts.filter((f) => section.factIds.includes(f.id)) : []
  const notFound = claims.filter(
    (c) => c.slot === 'section' && c.slide === at + 1 && c.result === 'not_found',
  )

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-8">
      <h2 id={`${ids}-heading`} className="text-h3">
        Text
      </h2>
      <StepAreas
        slides={
          <BlogPreview
            view={view}
            selected={at}
            onSelect={editable && text ? setSelected : undefined}
          />
        }
        actions={
          editable &&
          text &&
          section && (
            <>
              {error && actedOn === null && <p className={reasonText}>{error}</p>}
              {editReason && <p className={reasonText}>{editReason}</p>}
              {waiting && <Working words={waiting} />}

              <section
                key={`section-${at}`}
                aria-labelledby={`${ids}-section`}
                className="flex flex-col gap-3"
              >
                <h3 id={`${ids}-section`} className="text-overline uppercase text-muted-foreground">
                  {`Section ${at + 1}`}
                </h3>
                <SlotField
                  label="Heading"
                  value={section.heading}
                  max={HEADING_MAX}
                  count={charsOf(HEADING_MAX)}
                  error={fieldError('heading')}
                  disabled={disabled}
                  onSave={(t) =>
                    save(
                      { part: 'section', index: at, field: 'heading', text: t },
                      `Section ${at + 1} heading saved`,
                    )
                  }
                />
                <SlotField
                  label="Body"
                  long
                  value={section.body}
                  max={BLOG_BODY_MAX}
                  count={charsOf(BLOG_BODY_MAX)}
                  error={fieldError('body')}
                  disabled={disabled}
                  onSave={(t) =>
                    save(
                      { part: 'section', index: at, field: 'body', text: t },
                      `Section ${at + 1} saved`,
                    )
                  }
                />
                {sectionFacts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sectionFacts.map((f) => (
                      <FactNumber
                        key={f.id}
                        fact={f}
                        sourceTitle={source?.title ?? ''}
                        site={source ? paragraphSite(source, f.ref) : null}
                        checkedAt={view.createdAt}
                      />
                    ))}
                  </div>
                )}
                {notFound.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {notFound.map((c) => (
                      <li key={c.text} className={reasonText}>
                        {`Not found in the source: “${c.text}”`}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby={`${ids}-takeaways`} className="flex flex-col gap-3">
                <h3 id={`${ids}-takeaways`} className="text-h4">
                  Key takeaways
                </h3>
                {text.takeaways.map((t, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: a takeaway is its place; every change keys the screen again.
                    key={i}
                    className="flex items-end gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <SlotField
                        label={`Takeaway ${i + 1}`}
                        value={t}
                        max={BLOG_POINT_MAX}
                        disabled={disabled}
                        onSave={(value) =>
                          save(
                            { part: 'takeaway', index: i, text: value },
                            `Takeaway ${i + 1} saved`,
                          )
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove takeaway ${i + 1}`}
                      disabled={disabled || text.takeaways.length <= BLOG_TEXT_COUNTS.takeaways.min}
                      onClick={() =>
                        save(
                          { part: 'takeaway', index: i, remove: true },
                          `Takeaway ${i + 1} removed`,
                        )
                      }
                    >
                      <X aria-hidden strokeWidth={1.5} className="size-icon" />
                    </Button>
                  </div>
                ))}
              </section>

              <section aria-labelledby={`${ids}-faq`} className="flex flex-col gap-4">
                <h3 id={`${ids}-faq`} className="text-h4">
                  FAQ
                </h3>
                {text.faq.map((f, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: a question is its place; every change keys the screen again.
                    key={i}
                    className="flex flex-col gap-2"
                  >
                    <SlotField
                      label={`Question ${i + 1}`}
                      value={f.q}
                      max={HEADING_MAX}
                      disabled={disabled}
                      onSave={(value) =>
                        save(
                          { part: 'faq', index: i, field: 'q', text: value },
                          `Question ${i + 1} saved`,
                        )
                      }
                    />
                    <SlotField
                      label={`Answer ${i + 1}`}
                      long
                      value={f.a}
                      max={BLOG_ANSWER_MAX}
                      disabled={disabled}
                      onSave={(value) =>
                        save(
                          { part: 'faq', index: i, field: 'a', text: value },
                          `Answer ${i + 1} saved`,
                        )
                      }
                    />
                    {f.a.trim() === '' && (
                      <p className={reasonText}>
                        The facts do not answer this. Answer it or remove it.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-start"
                      aria-label={`Remove question ${i + 1}`}
                      disabled={disabled || text.faq.length <= BLOG_TEXT_COUNTS.faq.min}
                      onClick={() =>
                        save({ part: 'faq', index: i, remove: true }, `Question ${i + 1} removed`)
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </section>

              {approveOffered && (
                <StepAction>
                  <Control reason={approveReason}>
                    <Button disabled={pending || approveReason !== null} onClick={approve}>
                      Approve text → Images
                    </Button>
                  </Control>
                </StepAction>
              )}
            </>
          )
        }
      />
    </section>
  )
}
