// The road feature's client-safe API: the board of one of her roadmaps (/roadmaps/<id>). What the
// app's routes use: the board, the road's data (Priya's mock behind getRoad), who may open a board,
// the lesson and route step a URL names, and what a roadmap's board says about it for the list.

export { RoadBoard } from './components/RoadBoard'
export { type BoardFacts, boardFacts } from './model/board-facts'
export { roadRedirect } from './model/redirect'
export { getRoad, type Road } from './model/road-data'
export { lessonById, routeStep } from './model/routes'
