# `@chia/themes`

CSS-only semantic design tokens and theme variants.

## Boundaries

- HeroUI tokens are the color vocabulary. Do not introduce shadcn token names such as `primary`, `card`, `popover`, `muted-foreground`, `destructive` or `ring`.
- `base.css` owns fonts, token mapping, shared density and resets.
- `default.css` and `cyan.css` assign theme-specific color, radius, sidebar and chart tokens only.
- `hobby.css` is not a standalone theme: it re-colours `default.css` wherever www's hobby frame is on the page (`:root:has([data-site-mode="hobby"])`).
- Define control density once through HeroUI classes; component call sites choose `size` rather than restating heights.
