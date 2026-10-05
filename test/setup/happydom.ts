import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Register the DOM first; only then load jest-dom's matchers. A static import would be hoisted
// above the registration and evaluate Testing Library against a missing `document`.
GlobalRegistrator.register()
// Load jest-dom matchers for happy-dom environment
// @ts-expect-error jest-dom's index.d.ts is a reference file, not a module, but the import works at runtime
await import('@testing-library/jest-dom')
