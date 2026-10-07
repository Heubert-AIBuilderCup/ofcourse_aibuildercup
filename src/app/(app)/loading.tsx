import { DuckLoader } from '@/features/opening'

/** Shown while a student route loads; invisible for the first 400 ms, so short waits show nothing. */
export default function Loading() {
  return <DuckLoader />
}
