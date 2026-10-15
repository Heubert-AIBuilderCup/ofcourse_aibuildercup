// The art library: images an editor may swap onto a cover instead of generated art. Each file sits
// beside this index; only an id listed here is ever read, so a request never names a path.

export const LIBRARY: { id: string; label: string; file: string }[] = [
  { id: 'open-book', label: 'Open book', file: 'open-book.png' },
  { id: 'new-head', label: 'New head', file: 'new-head.png' },
]
