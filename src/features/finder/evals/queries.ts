// The finder's eval queries (criteria 12, 13, 14 and 15), run against the real embedding model by
// scripts/finder-eval.ts. Client-safe: data only.

/** A search and the graph fields (FIELDS ids) one of whose courses should be in its top three. */
export type FinderQuery = { text: string; expect: string[] }

/** A search whose top three must hold no course of these graph fields. */
export type NegativeQuery = { text: string; notInTop3: string[] }

/** The demo queries (criterion 12). */
export const DEMO_QUERIES: readonly FinderQuery[] = [
  {
    text: "I like understanding why people do things, and I'm good with computers",
    expect: ['cyber-psychology'],
  },
  // Q2 replaced 17 Oct 2026 by Nikhil's decision: the isolated niche proposal produced no
  // behavioural-economics field.
  {
    text: "I'm good at numbers and I like working out the chances of bad things happening and what they would cost",
    expect: ['actuarial-studies'],
  },
  {
    text: 'I like drawing and I want to make apps people enjoy using',
    expect: ['hci'],
  },
]

/** The negative cases (criterion 13). */
export const NEGATIVE_QUERIES: readonly NegativeQuery[] = [
  { text: 'I want to build bridges', notInTop3: ['cyber-psychology'] },
  // Was "I love cooking" until 17 Oct 2026: two content words, so it stopped at the word-count
  // gate and never reached the model.
  { text: 'I love cooking big family dinners on weekends', notInTop3: ['cyber-psychology'] },
]

/**
 * The held-out queries (criterion 14), pasted verbatim. They were written by an isolated agent that
 * read only src/features/roads/data/fields.ts: not the catalogue, not the demo queries, not the
 * intent. Its brief: 20 sentences a 17–25-year-old might type about what they enjoy and are good at,
 * each pointing to one or two FIELDS ids, without the field's name or its definition's words.
 */
export const HELD_OUT_QUERIES: readonly FinderQuery[] = [
  {
    text: "I'm the one everyone calls when the wifi drops or the printer stops working, and honestly I like sorting it out.",
    expect: ['it'],
  },
  {
    text: "I love capture-the-flag challenges and figuring out how to get into stuff that's supposed to be locked down.",
    expect: ['cyber'],
  },
  {
    text: 'At my part-time job I made a spreadsheet dashboard showing what sells on which days, so the owner could figure out what to order.',
    expect: ['business-analytics'],
  },
  {
    text: "I volunteer at an aged-care home and I'm good at calming residents down when they're anxious or upset.",
    expect: ['health', 'psych'],
  },
  {
    text: 'I taught myself Python and made a Discord bot for my friends. Hunting down bugs is weirdly satisfying.',
    expect: ['software'],
  },
  {
    text: "My mates and I host our own Minecraft server and I'm obsessed with keeping the lag low and making sure it never crashes.",
    expect: ['networks'],
  },
  {
    text: "I've been training a model to tell my cat from my dog in photos, and it's kind of magic when it gets it right.",
    expect: ['ai-ml'],
  },
  {
    text: 'During COVID I was glued to the case-count charts and wanted to know whether the vaccine trials actually proved anything.',
    expect: ['biostatistics'],
  },
  {
    text: "I binge detective podcasts and I'm weirdly good at piecing together what happened from deleted texts and phone logs.",
    expect: ['digital-forensics'],
  },
  {
    text: 'It fascinates me why my nan clicks on every scam text, and I want to work out how to stop people getting fooled like that.',
    expect: ['cyber-psychology'],
  },
  {
    text: 'In science I loved chromosomes and mutations, and in my spare time I write Python scripts. Something that mixes both would be ideal.',
    expect: ['bioinformatics'],
  },
  {
    text: 'I could scroll around Google Earth for hours, and I like working out where new bus stops or parks should go.',
    expect: ['spatial-data-science'],
  },
  {
    text: 'Probability is my favourite topic, and I like working out the odds of things going wrong and putting a dollar figure on it.',
    expect: ['actuarial-studies'],
  },
  {
    text: "I'm into crypto and always trying the newest ways to split bills and send cash to friends. I'd love to make something like that.",
    expect: ['fintech'],
  },
  {
    text: "I sketch characters all the time and I've built whole worlds with boss fights in Roblox Studio.",
    expect: ['game-development', 'design'],
  },
  {
    text: 'As shift lead at my café I loved figuring out who works well together on the roster and keeping the crew happy.',
    expect: ['organisational-psychology'],
  },
  {
    text: 'Climate change keeps me up at night and physics is my best subject. I want to help get us off coal.',
    expect: ['renewable-energy-engineering'],
  },
  {
    text: 'I tinker with Arduino kits, and after seeing a video of a bionic hand I want to make stuff like that for amputees.',
    expect: ['biomedical-engineering', 'robotics'],
  },
  {
    text: 'I notice every annoying thing on websites, like buttons in weird spots, and I like watching my friends try them to see where they get confused.',
    expect: ['hci'],
  },
  {
    text: "I follow every story about one nation hacking another's elections, and I'm on the debating team and love politics.",
    expect: ['cyber-strategy'],
  },
]
