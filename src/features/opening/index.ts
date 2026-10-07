// The opening feature's client-safe API: the screens, and the question rules the engine reads.
// Database reads are in ./server/profile (server-only), the writes in ./actions ('use server');
// pages import those and pass the actions to the screens, as the admin feature does.

export { CoinsScreen } from './components/CoinsScreen'
export { DuckLoader } from './components/DuckLoader'
export { FuturesScreen } from './components/FuturesScreen'
export { Hero } from './components/Hero'
export { OpeningScreen } from './components/OpeningScreen'
export { PictureQuestion } from './components/PictureQuestion'
export { Splash } from './components/Splash'
export { landingPath } from './model/landing'
export {
  activeRelative,
  effective,
  fieldsChosen,
  isAssumed,
  questionOf,
  SCREENS,
} from './model/questions'
export { SPLASH_SEEN_SCRIPT } from './model/splash-seen'
