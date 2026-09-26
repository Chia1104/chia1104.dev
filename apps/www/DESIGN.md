# Design System: Chia1104.dev (`www`)

**Project ID:** None (not a Stitch project). This file is derived from the codebase: `packages/themes/default.css` and `base.css` (tokens, density, shared text styles), `apps/www/src/styles/globals.css` (ruled-sheet utilities and derived tokens), `apps/www/src/components/commons/ruled.tsx` (layout primitives) and the page components.

## 1. Visual Theme & Atmosphere

The site reads like **a drafting sheet printed on tinted paper**. A single column is framed by two hairline rails; horizontal hairlines above and below every section run past the rails to the edges of the viewport, and sections are separated by short bands of fine diagonal hatching. Structure comes from lines, not from cards, fills or shadows.

The paper is not white. Light mode is a **warm blush sheet** and dark mode a **violet night sheet**: every neutral, from the page to the rules, carries a trace of the mode's hue. The accent is soft (a pale rose by day, a lilac violet by night) and is spent on _moments of attention_: a hovered link cell fills with accent hatching, bold words get a highlighter band, the scroll bar and the playlist glow run an accent gradient, and the footer wordmark inks up in accent as the pointer crosses it.

- **Ruled, ledger-like framing.** Panels, page titles and grids are drawn by hairlines; empty grid slots are hatched rather than left blank.
- **Hatching carries meaning.** Neutral hatching is a section break; accent hatching means "this whole cell is a link and you are on it"; a hatched cell is an empty slot.
- **Personal marks.** A pixel-grid "Chia1104" wordmark rises out of the last rule of the footer, a hand-drawn signature path closes each article, and the home page keeps a live globe and a Spotify panel lit by a soft noise shader, the only glowing surface on the site.
- **Density.** Calm but compact: compact controls, 16px inner padding, hairlines instead of whitespace doing the separating.

Mood keywords: _drafted, ruled, tinted, quiet, personal, precise, lightly lit_.

## 2. Color Palette & Roles

Colours are HeroUI theme tokens authored in OKLCH in `@chia/themes/default.css` (the palette only `www` imports); the hex values below are their sRGB equivalents. Light neutrals share hue 18 (rose), dark neutrals hue 305 (violet), so the two modes are designed separately rather than inverted.

### Light mode — "blush paper"

| Descriptive name   | Hex       | Token                                    | Functional role                                                                                   |
| ------------------ | --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Blush paper        | `#FCF3F2` | `background`                             | Page canvas behind the column and the sticky header (at 80% with blur).                           |
| Warm ink           | `#1B1717` | `foreground`, `default-foreground`       | Body text, headings, link text, icon strokes.                                                     |
| Paper white        | `#FFFEFE` | `surface`, `overlay`, `field-background` | Popovers, dialogs, code blocks, form fields. Floating layers use it at 75% with a backdrop blur.  |
| Rose mist          | `#F2E9E8` | `default`                                | Tertiary buttons, tab pills, quiet control fills.                                                 |
| Faint rose rule    | `#EBE2E2` | `separator`                              | The signature hairlines: rails, full-bleed rules, grid dividers and neutral hatching.             |
| Rose frame         | `#E5DBDB` | `border`                                 | Control and field outlines, the article footer divider.                                           |
| Dusty mauve-grey   | `#7D6E6D` | `muted`, `field-placeholder`             | Descriptions, dates, captions, footer labels, the ledger's year numerals (at 60%).                |
| Pale rose accent   | `#F9C7C7` | `accent`, `focus`                        | Hover hatching on link cells, the highlighter band under bold text, focus rings, accent controls. |
| Near-black on rose | `#100909` | `accent-foreground`                      | Text on accent fills (the accent is light, so text on it is dark).                                |
| Coral rose         | `#FFABB0` | `--accent-gradient-from` (derived)       | First stop of the site gradient: scroll progress bar, playlist glow.                              |
| Apricot            | `#FFBE63` | `--accent-gradient-to` (derived)         | Second stop: the accent rotated 45° in hue.                                                       |
| Magenta alarm      | `#F63391` | `danger`                                 | Errors and destructive actions.                                                                   |
| Lime signal        | `#93BA00` | `success`                                | Confirmations.                                                                                    |
| Tangerine          | `#FF925B` | `warning`                                | Warnings.                                                                                         |

### Dark mode — "violet night"

| Descriptive name | Hex         | Token                                    | Functional role                                                                                    |
| ---------------- | ----------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Violet night     | `#100D13`   | `background`                             | Page canvas; lifted off pure black so the rules read softly.                                       |
| Paper white text | `#FCFCFC`   | `foreground`, `default-foreground`       | Body text and headings.                                                                            |
| Raised plum      | `#1B1620`   | `surface`, `overlay`, `field-background` | Popovers, dialogs, code blocks and fields; elevation is shown by lightening, not by shadow.        |
| Smoked violet    | `#28262B`   | `default`                                | Quiet control fills and tab pills.                                                                 |
| Night rule       | `#232026`   | `separator`                              | Rails, full-bleed rules and hatching, barely above the canvas.                                     |
| Violet frame     | `#2A282D`   | `border`                                 | Control and field outlines.                                                                        |
| Lavender grey    | `#A39DAA`   | `muted`, `field-placeholder`             | Secondary text, captions, year numerals.                                                           |
| Lilac violet     | `#C084FC`   | `accent`, `focus`                        | Accent hatching (mixed to 25% so text stays legible), focus rings, accent controls.                |
| Accent at 40%    | `#C084FC66` | `--accent-highlight`                     | The highlighter band under bold text, thinned so white text stays readable over it.                |
| Deep grape       | `#0E0815`   | `accent-foreground`                      | Text on accent fills.                                                                              |
| Orchid pink      | `#F470B4`   | `--accent-gradient-to` (derived)         | Second gradient stop; the first is the accent itself. Together they reproduce the old purple→pink. |
| Ember red        | `#DC3B27`   | `danger`                                 | Errors and destructive actions.                                                                    |
| Jade             | `#00CB74`   | `success`                                | Confirmations.                                                                                     |
| Honey            | `#F1BB49`   | `warning`                                | Warnings.                                                                                          |

### Supporting treatments

- **Derived from the accent, not hard-coded.** The gradient stops are computed in CSS from `--accent` (chroma floor 0.15, second stop +45° hue), and the highlighter band is `--accent-highlight`. Anything accent-coloured therefore follows a reader's custom accent.
- **Reader palette.** Readers can recolour six tokens per mode (accent, background, text, surface, lines, muted text) with HeroUI's colour picker, opacity included. Overrides are stored as `#RRGGBBAA` and applied before first paint; resetting returns to the values above.
- **Hatching.** 1px strokes on a 10px repeat at 315°, drawn in `separator` for section breaks and in `accent` for hovered link cells.
- **Spotify green (`#1DB954`)** appears only on the Spotify glyph, as a brand mark.

## 3. Typography Rules

| Role                  | Family                                                     | Character                                                                                |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| UI, body and headings | System sans stack (`-apple-system`, `Segoe UI`, Roboto, …) | Native and unbranded: the page reads like the reader's own device; no web fonts to load. |
| Code and tabular data | System mono stack (`ui-monospace`, SF Mono, Menlo, …)      | Code blocks and inline code only; metadata stays in sans with tabular figures.           |

- **Headings are semibold (600) with tight tracking.** Page titles are 30px on a ruled row; the home name is 36px beside the avatar cell; panel titles are 20px; card titles 18px. Headings balance their line breaks.
- **Body text** is 16px with relaxed leading (≈1.6); article prose follows the Fumadocs reading scale with the same heading sizes.
- **Small print** (dates, captions, footer labels, cell counts) is 12–14px in `muted`, always with tabular figures so dates and counts line up.
- **Ledger numerals.** Timeline years are 36px semibold numerals at 60% `muted`, set in their own gutter column and pinned while their rows scroll.
- **Links** keep the body colour at medium weight (500) with a 1.5px underline in `muted`, offset 3.5px; hover softens the whole link to 80% opacity. The underline, not the colour, marks a link.
- **Bold** is a highlighter pass: body-coloured semibold text over an accent band covering the lower half of the glyphs, repeated on every wrapped line. It is shared by article prose and the agent chat.
- **No all-caps labels.** Labels and triggers are sentence case.

## 4. Component Stylings

- **Panels (the primary container).** Sections are not cards. A panel is a frameless, fill-less, shadowless region between the rails, closed by full-bleed hairlines at its top and bottom. A panel header (title plus a muted description) is split from its body by another hairline; content is inset 16px.
- **Hatch bands.** 32px bands of neutral hatching separate panels (48px above the footer). They bleed to the viewport edges like the rules.
- **Ruled grids.** Galleries, repositories, tags and the footer are grids whose cells are divided by 1px hairlines, never gaps with backgrounds. An odd last slot is filled with hatching.
- **Link cells.** A cell that is wholly a link (repository, tag, related post) shows accent hatching behind its text on hover or keyboard focus, fading in over 200ms; focus also draws an inset focus ring.
- **Buttons.** HeroUI buttons at compact density: 32px tall by default on desktop (36px on touch), 28px small; corners barely softened. Toolbars use ghost buttons; the header uses tertiary icon buttons separated by a short vertical hairline.
- **Chips and pills.** Tags are small soft HeroUI chips; the "Now playing" capsule and the Huge Thanks button are the only pill-shaped elements.
- **Inputs and forms.** HeroUI fields on `field-background` with a hairline `border` and near-square corners; the contact form sits in a panel, not a card.
- **Floating layers.** Navigation popovers, the command palette, link previews and song tooltips share one surface: `surface` at 75% opacity with a small backdrop blur and HeroUI's default soft shadow. No accent borders or glows.
- **Header.** Sticky and 56px tall, `background` at 80% with a medium blur, framed by the same rails and a bottom rule. It holds the wordmark, the Blog/Projects tabs, the Gloss launcher (a small shader orb) and the command menu.
- **Ledger timeline.** Years sit in a gutter column split from their rows by a vertical hairline; rows are split by horizontal hairlines. Post rows show title, date and tags, and an always-visible description; experience rows fold their details behind "More".
- **Article page.** Title, description and tags each sit on ruled rows; author, date, type and reading time form a strip of hairline-divided cells. The table of contents is a column of short marks hanging 1rem outside the right rail once the page is wide enough.
- **Footer.** Laid out as a drawing's title block: Pages, Contact and Theme cells, a "now playing" strip and the copyright, closed by a pixel-grid "Chia1104" wordmark whose cells are outlined in `separator`, cropped by the final rule and inked from foreground through accent as the pointer moves.
- **Images.** Gallery photos fill their ruled cells edge to edge with square corners and zoom to full resolution.

## 5. Layout Principles

- **One railed column.** Every page lives in a centred 768px column (48rem) framed by `separator` rails, with an 8px gutter outside the rails on small screens and 16px padding inside. Reading width, gallery and grids share the same column.
- **Full-bleed rules, contained content.** Horizontal hairlines run the full viewport width; everything readable stays inside the rails, so the column looks inscribed on an endless ruled sheet.
- **Rhythm from lines, not margins.** Each page opens with 48px of blank sheet under the header and closes with 48px before the footer; between them, panels follow each other separated only by hatch bands.
- **Breakpoints follow the page, not the viewport.** Layout switches at 640, 768 and 992px of _page_ width (container queries), because the Gloss chat dock takes a column from the right on wide screens and the page narrows exactly as if the window had shrunk.
- **Sticky chrome.** The header stays pinned; anchored headings keep clear of it through scroll padding; the timeline's year stays pinned inside its group.
- **Flat depth.** There are no shadows inside the column. Depth appears only in floating layers (translucent surface, blur, soft shadow) and in the single lit surface, the playlist's noise shader.
- **Restrained motion.** No scroll-triggered entrances. Motion answers the reader: hover hatching fades in, the scroll progress bar and the footer wordmark follow springs, and every animated piece respects reduced motion.
- **Both modes are first-class.** Every rule, hatch and derived colour has a deliberate light and dark value, and a reader's custom palette is kept separately per mode.
