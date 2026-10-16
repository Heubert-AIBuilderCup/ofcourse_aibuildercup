'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { formatWhen } from '@/shared/lib/site'
import type { Fact } from '../model/types'

type FactChipProps = {
  fact: Fact
  sourceTitle: string
  /** The site of the link the fact came from (lib/sites.ts paragraphSite, GD19): named in place of the title. */
  site?: string | null
  /** When the facts were checked: the facts record's createdAt. */
  checkedAt: string
}

const chip = 'w-fit max-w-full border px-2 py-0.5 text-caption text-muted-foreground wrap-anywhere'

/** formatWhen's date part, so the day is read in the admin's time zone like every other date. */
const dayOf = (checkedAt: string) => formatWhen(checkedAt).split(', ')[0]

/**
 * What a slot rests on, written out: "<fact> · <¶n> · <source> · checked <d Mon yyyy>" (criterion
 * 27), the source being the site of its link when the source was read from several (GD19).
 */
export function FactChip({ fact, sourceTitle, site, checkedAt }: FactChipProps) {
  return (
    <span className={chip}>
      {`${fact.text} · ${fact.ref} · ${site ?? sourceTitle} · checked ${dayOf(checkedAt)}`}
    </span>
  )
}

/**
 * A fact a slide rests on, shown once per slide as its number in the source (GD23): ¶3.1, or ¶3
 * for a fact from before sentence ids. A press opens the source sentence and "<source> · ¶n ·
 * checked <d Mon yyyy>".
 */
export function FactNumber({ fact, sourceTitle, site, checkedAt }: FactChipProps) {
  return (
    <Popover>
      <PopoverTrigger className="w-fit border px-2 py-0.5 font-heading text-caption text-muted-foreground hover:border-primary hover:text-foreground">
        {fact.sentenceId ?? fact.ref}
      </PopoverTrigger>
      <PopoverContent className="flex flex-col gap-2 rounded-none bg-background shadow-none">
        <p className="text-caption wrap-anywhere">{fact.quote ?? fact.text}</p>
        <p className="text-caption text-muted-foreground wrap-anywhere">
          {`${site ?? sourceTitle} · ${fact.ref} · checked ${dayOf(checkedAt)}`}
        </p>
      </PopoverContent>
    </Popover>
  )
}
