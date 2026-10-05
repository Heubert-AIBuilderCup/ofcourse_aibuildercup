# Industry

Source: the Industry design system in Claude Design (https://claude.ai/artifact/Dtp9Gw4cZP9Kt2hRYc8Mec). A wireframe look: steel blue on a light technical ground, Barlow Condensed headings over Barlow, a modular grid, and cards, dialogs and buttons drawn as blueprint objects. The dark theme is derived from its ramps; Industry itself ships light only.

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
- Icons: Lucide at `strokeWidth={1.5}`, 14px beside a button label, 16px in an icon button, 20px alone. Never thicker.
- Photographs: duotone into the accent, square and hairline-framed.
- Copy: short, plain, sentence case. Buttons are verbs ("Save changes"). A dialog asks one question and says what will and won't change. No exclamation marks or emoji.
- Contrast: `primary` on the background is 3.7:1, fine for icons, borders, large text and the focus ring, not for small text. Use `text-muted-foreground` for secondary text; it passes 4.5:1.

## Sizing

- Type comes from the roles, which scale with the viewport on their own: `text-display` (a hero), `text-h1` to `text-h4`, `text-lead`, body (the default), `text-caption`, `text-overline`, `text-micro`. Never set a size per breakpoint (`text-3xl sm:text-5xl`) or an arbitrary one.
- Page spacing comes from the roles too: `px-gutter` for the page's sides, `py-section` for a page's top and bottom, `gap-block` between blocks, `gap-stack` between groups; `@max-[35rem]:` overrides where the design's phone layout differs. Component-internal spacing (a card's padding, a button's height) stays on the fixed scale.
