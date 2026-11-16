import { readableImageSourceOf } from "@/libs/image-source";
import { SITE_MODE_FACE } from "@/shared/site-mode";
import type { SiteMode } from "@/shared/site-mode";

/** A portrait is drawn one glyph per sample or in a box a few hundred pixels wide; this covers both. */
const FACE_WIDTH = 256;

const faces = new Map<SiteMode, Promise<ImageBitmap | null>>();

/**
 * The portrait of `mode` decoded, as pixels a canvas can sample; `null` when it cannot be read.
 * Read once per page load, so the mode switch and the curtain share one copy.
 */
export const modeFaceOf = (mode: SiteMode) => {
  const known = faces.get(mode);
  if (known) return known;
  const face = fetch(readableImageSourceOf(SITE_MODE_FACE[mode], FACE_WIDTH), {
    referrerPolicy: "no-referrer",
  })
    .then(async (response) =>
      response.ok ? createImageBitmap(await response.blob()) : null
    )
    .catch(() => {
      faces.delete(mode);
      return null;
    });
  faces.set(mode, face);
  return face;
};
