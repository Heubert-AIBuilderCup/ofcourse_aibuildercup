// The admin's sections, left to right in the section nav. Add a section here and a page under
// src/app/admin/<section>.

export const ADMIN_SECTIONS = [{ href: '/admin/users', label: 'Users' }] as const

export type AdminSectionHref = (typeof ADMIN_SECTIONS)[number]['href']

/** The section a pathname belongs to, or null. */
export function activeSection(pathname: string): AdminSectionHref | null {
  for (const s of ADMIN_SECTIONS) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) return s.href
  }
  return null
}
