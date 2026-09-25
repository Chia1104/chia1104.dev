import { getPaletteScript } from "@/libs/palette";
import { SETTINGS_STORAGE_KEY } from "@/stores/settings/storage-key";

/** Applies the reader's stored palette while the page is parsed, so custom colours never flash in. */
export const PaletteScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: getPaletteScript(SETTINGS_STORAGE_KEY),
    }}
  />
);
