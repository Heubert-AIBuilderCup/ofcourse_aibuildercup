# Industry

Source: the Industry design system in Claude Design (https://claude.ai/artifact/Dtp9Gw4cZP9Kt2hRYc8Mec). A wireframe look: steel blue on a light technical ground, Barlow Condensed headings over Barlow, a modular grid, and cards, dialogs and buttons drawn as blueprint objects. Industry ships both themes; `theme.css` carries the light set on `:root, [data-theme="light"]` and the dark set on `[data-theme="dark"]`, so a steel panel marked `data-theme="light"` keeps its look inside a dark page.

## How it reaches the code

- Tokens: `theme.css` maps Industry onto the shadcn variables. Use Tailwind's semantic classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border`), never a hex value or Tailwind's palette.
- Fonts: `font-heading` (Barlow Condensed 600) for headings, buttons and card titles; body text is `font-sans` (Barlow). `h1`–`h6` get the heading face automatically.
- Frame: square corners come from `--radius: 0`; a framed object is `<Blueprint>` (src/shared/components/Blueprint.tsx), a hairline border with the "+" registration marks. `Card`, `DialogContent` and the default and outline `Button` carry the marks themselves.
- Ramps: `bg-accent-100` to `-900` and `bg-neutral-100` to `-900` are Industry's own ramps (text-accent-700 for accent paragraph text, bg-accent-200 for selected rows).

## Rules

- Cards and dialogs are transparent line drawings: a hairline border, no fill. The solid primary button is the one filled object.
- One accent, steel blue (`primary`). Don't add decorative colour. `destructive` is only for errors.
- Separate sections with whitespace (`gap-6`, `gap-8`), not rules or boxes.
- Status is one word in a tag: "Live", "In review", "Draft".
- Icons: Lucide at `strokeWidth={1.5}`, 14px beside a button label, 16px in an icon button, 20px alone. Never thicker. Sized with `size-icon-sm` (14), `size-icon` (16), `size-icon-lg` (20): px on purpose, they stay the same at every width while the design scales.
- Photographs: duotone into the accent, square and hairline-framed.
- Copy: short, plain, sentence case. Buttons are verbs ("Save changes"). A dialog asks one question and says what will and won't change. No exclamation marks or emoji.
- Contrast: `primary` on the background is 3.7:1, fine for icons, borders, large text and the focus ring, not for small text. Use `text-muted-foreground` for secondary text; it passes 4.5:1.
- The brand ground (OfCourse's, in globals.css): in light mode the panel, the login hero, the `Hero` band and the strong button are one blue (#0062c4, a shade deeper than the splash's, `brand`), with white type; in dark mode they are Industry's steel. The fields carry `data-theme="light"`, so they keep Industry's light tokens inside a dark page; a hairline (`--border`) marks where they meet the dark ground. On the blue, secondary panel text is full white, as the canvas draws it: write it `text-panel-foreground dark:text-panel-foreground/78`, the only `dark:` classes inside the panel.

## Sizing

- Type comes from the roles, which scale with the viewport on their own: `text-display` (a hero), `text-h1` to `text-h4`, `text-lead`, body (the default), `text-caption`, `text-overline`, `text-micro`. Never set a size per breakpoint (`text-3xl sm:text-5xl`) or an arbitrary one.
- Page spacing comes from the roles too: `px-gutter` for the page's sides, `py-section` for a page's top and bottom, `gap-block` between blocks, `gap-stack` between groups; `@max-xl:` overrides where the design's phone layout differs. Component-internal spacing (a card's padding, a button's height) stays on the fixed scale.

## Layout

- A page is an `@container` and responds to its own width, as the login design does, at Tailwind's own container sizes (they match Material 3's window classes and Bootstrap's breakpoints closely). Two breakpoints: phones below `@xl` (36rem/576px; `@max-xl:`: one column, a 1rem side gutter, actions within thumb reach), stacked from 36 to 64rem (the steel panel becomes a band on top, one content column), side by side from `@5xl` (64rem/1024px; `@max-5xl:` for what differs below it).
- From 1024 no breakpoint: the page keeps growing. Industry's type and spacing are fluid up to 1440; from 1440 to 1920 the whole design scales with the screen instead (the root font-size grows from 100% to 133%, globals.css), so type, spacing and widths grow together and 1920 shows the 1440 design at 4/3. Above 1920 (`--container-cap`, 90 of those scaled rem) content stays in a centred frame while backgrounds and the steel panel fill the screen. Sizes in rem scale; px (hairlines) do not.
- A split page (sign-in, onboarding) puts `split-page` on its grid and `split-panel` on the steel panel (globals.css): above the cap the panel's colour runs to the left edge and the ground to the right, while both columns' content stays in the centred frame. `[--split-panel:5/12]` sets the panel's share (½ by default).
- Content widths are Tailwind's: `max-w-sm` (24rem) for a form card, `max-w-2xl` (42rem) for a question screen, `max-w-7xl` (80rem) for wide content such as the futures, `max-w-prose` for running text.
- Grids inside content size themselves (`repeat(auto-fit, minmax(…, 1fr))`) instead of adding breakpoints.
- Designs are drawn at 390, 768, 1440 and 1920 and checked at 360, 390, 768, 1024, 1280, 1366, 1440, 1536, 1920 and 2560.
