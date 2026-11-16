/** Dense to sparse, the ramp `AsciiField` draws with. */
export const GLYPH_RAMP = "80o();:~-.";
/** A cell of paper with no glyph in it. */
export const BLANK_GLYPH = GLYPH_RAMP.length;
/** Tiles in one colour's row of a glyph atlas: the ramp, then the blank. */
export const GLYPH_TILES = GLYPH_RAMP.length + 1;
/** Above 1, only a picture's darker half takes the heavy glyphs. */
const PICTURE_GAMMA = 1.5;
/** Below this a cell is left blank rather than given the lightest glyph. */
const BLANK_BELOW = 0.06;

export const hash = (a: number, b: number) => {
  let value =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d);
  value ^= value >>> 12;
  return value >>> 0;
};

/** A stable pseudo-random number in `[0, 1)` for a pair of integers. */
export const unit = (a: number, b: number) => (hash(a, b) % 4096) / 4096;

export interface GlyphPalette {
  ink: string;
  paper: string;
  accent: string;
  font: string;
}

/** Reads a palette off an element styled with a background, a text and an outline colour. */
export const glyphPaletteOf = (style: CSSStyleDeclaration): GlyphPalette => ({
  ink: style.color,
  paper: style.backgroundColor,
  accent: style.outlineColor,
  font: style.fontFamily,
});

export const isSameGlyphPalette = (
  a: GlyphPalette | null,
  b: GlyphPalette
): boolean =>
  a !== null && a.ink === b.ink && a.paper === b.paper && a.accent === b.accent;

/**
 * Fills `atlas` with one opaque tile per glyph, already on the paper: a row in the ink, a row in
 * the accent. Tile `row * GLYPH_TILES + glyph` is then a single copy onto a cell.
 */
export const inkGlyphAtlas = (
  atlas: HTMLCanvasElement,
  cellPixels: number,
  palette: GlyphPalette
) => {
  const context = atlas.getContext("2d");
  if (!context) return;
  atlas.width = GLYPH_TILES * cellPixels;
  atlas.height = 2 * cellPixels;
  context.fillStyle = palette.paper;
  context.fillRect(0, 0, atlas.width, atlas.height);
  context.font = `600 ${Math.round(cellPixels * 0.9)}px ${palette.font}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const [row, color] of [palette.ink, palette.accent].entries()) {
    context.fillStyle = color;
    for (const [tile, glyph] of [...GLYPH_RAMP].entries()) {
      context.fillText(
        glyph,
        (tile + 0.5) * cellPixels,
        (row + 0.5) * cellPixels
      );
    }
  }
};

/**
 * How dark `image` is per cell of a `columns` by `rows` grid, as each cell's rank among them.
 * Ranking spreads any picture over the whole ramp, however narrow its own range of tones.
 * `null` when the grid is too small to hold a picture or the canvas cannot be read.
 */
export const darknessRanksOf = (
  sampler: HTMLCanvasElement,
  image: ImageBitmap,
  columns: number,
  rows: number
) => {
  const context = sampler.getContext("2d", { willReadFrequently: true });
  if (!context || columns < 4 || rows < 4) return null;
  sampler.width = columns;
  sampler.height = rows;
  context.drawImage(image, 0, 0, columns, rows);
  const { data } = context.getImageData(0, 0, columns, rows);
  const tones = new Uint8Array(columns * rows);
  const below = new Float32Array(257);
  for (let index = 0; index < tones.length; index++) {
    const tone = Math.round(
      0.2126 * (data[index * 4] ?? 0) +
        0.7152 * (data[index * 4 + 1] ?? 0) +
        0.0722 * (data[index * 4 + 2] ?? 0)
    );
    tones[index] = tone;
    below[tone + 1] = (below[tone + 1] ?? 0) + 1;
  }
  for (let tone = 1; tone < below.length; tone++) {
    below[tone] = (below[tone] ?? 0) + (below[tone - 1] ?? 0);
  }
  return Float32Array.from(
    tones,
    (tone) => 1 - (below[tone + 1] ?? 0) / tones.length
  );
};

/**
 * The ink a cell `darkness` (0 to 1) dark should carry. A picture is drawn by its darks in either
 * theme, the way a pen would: brightness as density turns a portrait on a light ground into one
 * solid shape.
 */
export const densityOfDarkness = (darkness: number) =>
  darkness ** PICTURE_GAMMA;

/** The glyph for a cell that should carry `density` (0 to 1) of ink. */
export const glyphOfDensity = (density: number) =>
  density < BLANK_BELOW
    ? BLANK_GLYPH
    : Math.round((1 - density) * (GLYPH_RAMP.length - 1));
