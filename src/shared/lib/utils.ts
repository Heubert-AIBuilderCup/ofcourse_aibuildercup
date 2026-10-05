import { createCn } from 'cn/config'

/**
 * Class merging that knows the design system's roles. Without this, `cn` reads `text-overline`
 * or `text-lead` as a colour and drops it whenever a `text-<colour>` class follows. Keep these
 * lists in step with the roles in src/app/globals.css.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'caption', 'overline', 'micro'] },
      ],
      // The spacing roles work on every spacing utility; name them so e.g. `p-5 p-stack` merges.
      p: [{ p: ['gutter', 'section', 'block', 'stack'] }],
      px: [{ px: ['gutter', 'section', 'block', 'stack'] }],
      py: [{ py: ['gutter', 'section', 'block', 'stack'] }],
      gap: [{ gap: ['gutter', 'section', 'block', 'stack'] }],
    },
  },
})
