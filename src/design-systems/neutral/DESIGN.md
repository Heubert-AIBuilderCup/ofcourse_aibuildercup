# Neutral

shadcn's default neutral palette with the system font: the starter's plain look, for projects that have no design system yet.

- Use Tailwind's semantic classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border`), never a hex value or Tailwind's palette.
- Rounded corners from `--radius`; no corner marks.
- Icons: Lucide at the default stroke.

## Sizing

- Type comes from the roles, which scale with the viewport on their own: `text-display` (a hero), `text-h1` to `text-h4`, `text-lead`, body (the default), `text-caption`, `text-overline`, `text-micro`. Never set a size per breakpoint (`text-3xl sm:text-5xl`) or an arbitrary one.
- Page spacing comes from the roles too: `px-gutter` for the page's sides, `py-section` for a page's top and bottom, `gap-block` between blocks, `gap-stack` between groups; `@max-[35rem]:` overrides where the design's phone layout differs. Component-internal spacing (a card's padding, a button's height) stays on the fixed scale.
