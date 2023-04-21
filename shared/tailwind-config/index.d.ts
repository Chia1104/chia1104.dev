import type { Config } from "tailwindcss";

declare const basedConfig: Config | undefined;

declare const animation:
  | (Config["theme"]["animation"] & Config["theme"]["keyframes"])
  | undefined;

export default basedConfig;
export { animation };
