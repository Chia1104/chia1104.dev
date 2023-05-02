import type { Config } from "tailwindcss";

declare const baseConfig: Config | undefined;

declare const animation:
  | (Config["theme"]["animation"] & Config["theme"]["keyframes"])
  | undefined;

export default baseConfig;
export { animation };
