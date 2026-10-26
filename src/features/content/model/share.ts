// Sharing a live feed post to the pages' accounts (criteria 9–11). Nothing is sent to Instagram
// or LinkedIn: a share is recorded (ADR-033), and these are the accounts it may name, the
// choices it takes, and how it reads in its toast and in the post's list.

import { PAGE_BRANDS } from '../brands'
import type { Body } from './artifacts'

export type ShareAccount = { id: string; label: string }
/** The accounts of one share, by id, per network. */
export type ShareAccounts = { instagram: string[]; linkedin: string[] }

/** Every page's Instagram account by its handle; on LinkedIn, the main page only. */
export const SHARE_ACCOUNTS: { instagram: ShareAccount[]; linkedin: ShareAccount[] } = {
  instagram: PAGE_BRANDS.flatMap((b) =>
    b.instagram ? [{ id: b.id, label: `@${b.instagram.handle}` }] : [],
  ),
  linkedin: [{ id: 'main', label: 'OfCourse' }],
}

export const SHARE_ERRORS = {
  none: 'Tick at least one account.',
  unknown: 'Choose from the accounts listed.',
} as const

type Network = keyof ShareAccounts

const NETWORKS: Network[] = ['instagram', 'linkedin']

/** The ids ticked of a network's accounts, in the order listed, each once; null when one is not listed. */
function listed(network: Network, ids: string[]): string[] | null {
  const known = SHARE_ACCOUNTS[network].map((a) => a.id)
  if (ids.some((id) => !known.includes(id))) return null
  return known.filter((id) => ids.includes(id))
}

/** The accounts a share goes to: only listed ones, at least one, in the order listed. */
export function shareChoice(
  input: ShareAccounts,
): { ok: true; accounts: ShareAccounts } | { ok: false; error: string } {
  const instagram = listed('instagram', input.instagram)
  const linkedin = listed('linkedin', input.linkedin)
  if (!instagram || !linkedin) return { ok: false, error: SHARE_ERRORS.unknown }
  if (instagram.length + linkedin.length === 0) return { ok: false, error: SHARE_ERRORS.none }
  return { ok: true, accounts: { instagram, linkedin } }
}

/** An account's label, or its id when it is no longer listed, so an old share still reads. */
const labels = (network: Network, ids: string[]): string =>
  ids.map((id) => SHARE_ACCOUNTS[network].find((a) => a.id === id)?.label ?? id).join(', ')

/** What the toast says (criterion 10): "Shared to Instagram: @a, @b", "Shared to LinkedIn", or both. */
export function sharedMessage(accounts: ShareAccounts): string {
  const parts = [
    accounts.instagram.length > 0 && `Instagram: ${labels('instagram', accounts.instagram)}`,
    accounts.linkedin.length > 0 && 'LinkedIn',
  ].filter(Boolean)
  return `Shared to ${parts.join(' · ')}`
}

/** A share in the post's list: "Shared to Instagram: @a, @b · LinkedIn: OfCourse · by Name". */
export function shareLine(body: Body<'share'>): string {
  const parts = NETWORKS.filter((n) => body[n].length > 0).map(
    (n) => `${n === 'instagram' ? 'Instagram' : 'LinkedIn'}: ${labels(n, body[n])}`,
  )
  return `Shared to ${parts.join(' · ')} · by ${body.by.name}`
}

/** The Instagram accounts a post was shared to, by label, in the order listed; one no longer listed by its id, after. */
export function instagramLabels(ids: readonly string[]): string[] {
  const listed = SHARE_ACCOUNTS.instagram.filter((a) => ids.includes(a.id)).map((a) => a.label)
  const gone = ids.filter((id) => !SHARE_ACCOUNTS.instagram.some((a) => a.id === id))
  return [...listed, ...gone]
}
