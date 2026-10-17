// The finder's numbers, in one place. Text of fewer than FINDER_MIN_WORDS content words is nothing
// close without a search; FINDER_FLOOR is the best score a real sentence needs (Nikhil, 17 Oct).
// scripts/finder-eval.ts reports where the held-out hits and the nonsense strings fall against it
// on gemini-embedding-001 (docs/course-finder/eval.md). A search gets SEARCH_TIMEOUT_MS, the
// 2-second target; one that runs out gets one more try of SEARCH_RETRY_MS (a cold start).
export const FINDER_TOP = 10
export const WHY_TOP = 3
export const SEARCH_TIMEOUT_MS = 2000
export const SEARCH_RETRY_MS = 5000
export const FINDER_MIN_WORDS = 3
export const FINDER_FLOOR = 0.5
export const FINDER_PER_HOUR = 30
