# Design systems

Each folder is one design system. The app uses the one exported from `index.ts`.

## Switch a project to another system

1. In `index.ts`, export that folder's system as `designSystem`.
2. In `CLAUDE.md`, point "Design" at that folder's `DESIGN.md`.

## Add a system (for example from Claude Design)

Copy `neutral/` to a new folder and fill in:

- `theme.css`: every variable `neutral/theme.css` sets, including the fluid type roles (`--ds-text-display` to `--ds-text-caption`, each with a `-leading`) and spacing roles (`--ds-space-gutter`, `-section`, `-stack`), written as `clamp()` between a 360px phone and a 1440px desktop so no page sets sizes per breakpoint; for `:root` (light) and `[data-theme='dark']`, in OKLCH. Map the system's tokens onto the shadcn roles (background, foreground, primary, muted, border, ring, radius…). `--ds-font-body`, `--ds-font-heading` and `--ds-heading-weight` set the type; `--ds-frame-marks: block` turns on corner marks. Anything the variables can't express goes in `@layer components`, keyed on `data-slot`.
- `index.ts`: load its fonts with `next/font` and export a `DesignSystem` with their variable classes.
- `DESIGN.md`: the rules agents follow when building screens with it.

Components in `src/shared/components/ui` read only these variables, so they need no change.

The sign-in page (`src/app/page.tsx`, `src/features/auth/components`) is built from the Industry artboard: when a project changes system its tokens, fonts and marks switch, but the composition is a design, so the page is redesigned, not switched.
