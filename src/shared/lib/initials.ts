const FIRST_LETTER = /[\p{L}\p{N}]/u

/** Up to two uppercased initials for the avatar: the first letter of the first two words. */
export function initialsOf(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .map((word) => word.match(FIRST_LETTER)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
