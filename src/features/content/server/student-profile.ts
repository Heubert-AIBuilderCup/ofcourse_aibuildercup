import 'server-only'
import type { StudentProfile } from '../lib/profile-contract'

/**
 * The student's profile, or null (ADR-126). Today: null, since nothing stores one yet, so the
 * chips start empty (criterion 84). Jenish's slice replaces this body with the read of the
 * student's record, which is why it lives on the server; the name, the argument and the shape
 * (lib/profile-contract.ts) are the contract.
 */
export async function loadStudentProfile(userId: string): Promise<StudentProfile | null> {
  void userId
  return null
}
