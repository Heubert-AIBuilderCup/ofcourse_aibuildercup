// The road's client-safe pieces for other features' panels and cards: a panel's head in the card
// column, the dashed tag on preview figures, a card's job market and the fields close to its
// course, as the board's cards draw them, and "What changes", for the finder's found courses. Kept
// apart from ./index, which loads the board (and through it the finder's panel), so these pieces
// do not load the board.

export { FieldsNearSection, JobMarketSection } from './components/CardDetails'
export { MockTag } from './components/MockTag'
export { PanelHead } from './components/PanelHead'
export { WhatChanges } from './components/WhatChanges'
