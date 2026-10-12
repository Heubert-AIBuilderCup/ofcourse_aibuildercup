// The opening feature's client-safe API: the screens and the onboarding paths.
// Database reads are in ./server/profile (server-only), the writes in ./actions ('use server');
// pages import those and pass the actions to the screens, as the admin feature does.

export { AttentionScreen } from './components/AttentionScreen'
export { DoneScreen } from './components/DoneScreen'
export { DuckLoader } from './components/DuckLoader'
export { OnboardingShell } from './components/OnboardingShell'
export { PictureQuestion } from './components/PictureQuestion'
export { QuestionScreen } from './components/QuestionScreen'
export { Splash } from './components/Splash'
export { WelcomeScreen } from './components/WelcomeScreen'
export { onboardingResumePath } from './model/landing'
export {
  ATTENTION_PATH,
  firstOpenQuestion,
  questionBySlug,
  questionPath,
} from './model/onboarding'
// The engine's catalogue test checks its fields against the questions' options.
export { questionOf } from './model/questions'
export { SPLASH_SEEN_SCRIPT } from './model/splash-seen'
