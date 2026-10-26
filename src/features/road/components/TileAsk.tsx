'use client'

import { type FormEvent, useState } from 'react'
import {
  ASK_FAILED,
  ASK_QUESTION_MAX,
  type AskReply,
  type TileAsk as Suggested,
} from '@/features/roads/client'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { MockTag } from './MockTag'

/** askTileAction: her typed question about a tile on her roadmap, answered from its rows. */
export type AskAction = (
  roadmapId: string,
  tileId: string,
  question: string,
) => Promise<ActionResult<AskReply>>

const OVERLINE = 'text-overline text-muted-foreground uppercase'

/** What follows a refusal, written here, never by the model (criterion 70). */
const TRY_THESE = 'Try one of these:'
const COUNSELLOR = 'A registered migration agent or your counsellor can answer this.'

/** The tile's suggested questions, each answered at a tap from its pre-written answer and source. */
function SuggestedAsks({ asks }: { asks: Suggested[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {asks.map((a, i) => {
        const isOpen = open === i
        return (
          <li key={a.question} className="flex flex-col gap-1">
            <Button
              type="button"
              variant="square"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="h-auto min-h-11 w-full justify-start px-3 py-2 text-left font-sans font-normal whitespace-normal aria-expanded:border-accent-700 aria-expanded:bg-accent-100"
            >
              {a.question}
            </Button>
            {isOpen ? (
              <div data-answer className="flex flex-col gap-1 px-3 py-1">
                <p className="m-0">{a.answer}</p>
                <p className="m-0 flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
                  Source: {a.source.title}, {a.source.date} ·
                  <MockTag />
                </p>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Ask on a city or course card (criteria 21–28, 70): the tile's suggested questions, each answered
 * at a tap with no call; then her own question, sent once to `action`, and its reply: the answer
 * with the rows it cited, the no-data refusal, the daily limit or the failure, each as the server
 * wrote it. A refusal is followed by the suggested questions again, and by the counsellor line when
 * the server says the question needs one. The suggested questions keep answering whatever the
 * reply. Without `action` (the student AI is off) there is no box for her own.
 */
export function TileAsk({
  roadmapId,
  tileId,
  asks,
  action,
}: {
  roadmapId: string
  tileId: string
  asks: Suggested[]
  action?: AskAction
}) {
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [reply, setReply] = useState<AskReply | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const asked = question.trim()
    if (asked === '' || sending || !action) return
    setSending(true)
    try {
      const result = await action(roadmapId, tileId, asked)
      setReply(
        result.ok
          ? {
              kind: result.kind,
              reply: result.reply,
              cited: result.cited,
              counsellor: result.counsellor,
            }
          : { kind: 'failed', reply: ASK_FAILED, cited: [] },
      )
    } catch {
      setReply({ kind: 'failed', reply: ASK_FAILED, cited: [] })
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-label="Ask about it" className="flex flex-col gap-2 border-t pt-3">
      <span className={OVERLINE}>Ask about it</span>
      <SuggestedAsks asks={asks} />

      {action ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-1.5 pt-1">
          <label htmlFor={`ask-${tileId}`} className="text-caption text-muted-foreground">
            Your own question
          </label>
          <div className="flex gap-2">
            <Input
              id={`ask-${tileId}`}
              value={question}
              maxLength={ASK_QUESTION_MAX}
              autoComplete="off"
              placeholder="e.g. Can I afford this?"
              onChange={(e) => setQuestion(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-none"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={sending || question.trim() === ''}
              className="h-11 shrink-0 px-4"
            >
              Ask
            </Button>
          </div>
        </form>
      ) : null}

      <div aria-live="polite" aria-busy={sending} className="flex flex-col gap-1">
        {reply ? (
          <>
            <p className={cn('m-0', reply.kind !== 'answered' && 'text-muted-foreground')}>
              {reply.reply}
            </p>
            {reply.kind === 'answered' ? (
              <div className="flex flex-col gap-1 text-caption text-muted-foreground">
                <span className="flex items-center gap-1">
                  Answered from these facts ·
                  <MockTag />
                </span>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {reply.cited.map((row) => (
                    <li key={row.id}>{row.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {reply.kind === 'refused' ? (
              <>
                {reply.counsellor ? <p className="m-0">{COUNSELLOR}</p> : null}
                <span className="pt-1 text-caption text-muted-foreground">{TRY_THESE}</span>
                <SuggestedAsks asks={asks} />
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
