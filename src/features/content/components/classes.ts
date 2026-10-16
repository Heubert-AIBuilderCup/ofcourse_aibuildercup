// The class strings the content screens share, in a module with no client directive, so a server
// component (the Board) reads the strings themselves; parts.tsx re-exports them for the steps.

/** The one tag style, shared with the admin's other screens (src/shared/components/classes.ts). */
export { tag } from '@/shared/components/classes'
export const reasonText = 'text-caption text-muted-foreground'
