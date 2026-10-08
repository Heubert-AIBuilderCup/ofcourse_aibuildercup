// The auth feature's client-safe API. Nothing server-only belongs here: SignOutButton and
// useSignOut read only the auth client and the paths in src/shared/lib/auth/gate.ts.

export { SignOutButton } from './components/SignOutButton'
export { useSignOut } from './hooks/useSignOut'
