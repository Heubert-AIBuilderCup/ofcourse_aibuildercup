// The admin's sections, left to right in the section nav, and who sees each. Add a section here
// and a page under src/app/admin/(console)/<section>.

import { canSeeBoard, canUseAdmin, type Staff } from '@/shared/lib/auth/access'

export const ADMIN_SECTIONS = [
  { href: '/admin/board', label: 'Board', show: (s: Staff) => canSeeBoard(s) },
  { href: '/admin/comic-gaps', label: 'Comic gaps', show: (s: Staff) => canSeeBoard(s) },
  { href: '/admin/updates', label: 'Updates', show: (s: Staff) => canSeeBoard(s) },
  { href: '/admin/ideas', label: 'Ideas', show: (s: Staff) => canSeeBoard(s) },
  { href: '/admin/insights', label: 'Insights', show: (s: Staff) => canSeeBoard(s) },
  { href: '/admin/users', label: 'Users', show: (s: Staff) => canUseAdmin(s.role) },
] as const

export type AdminSection = (typeof ADMIN_SECTIONS)[number]
export type AdminSectionHref = AdminSection['href']

/** The sections this viewer may open, in nav order. Each page still checks for itself. */
export function sectionsFor(viewer: Staff): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => s.show(viewer))
}

const underPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** The section a pathname belongs to, or null. A post's workbench counts as the Board. */
export function activeSection(pathname: string): AdminSectionHref | null {
  if (pathname.startsWith('/admin/posts/')) return '/admin/board'
  for (const s of ADMIN_SECTIONS) {
    if (underPrefix(pathname, s.href)) return s.href
  }
  return null
}
