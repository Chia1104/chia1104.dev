import type { Config } from "tailwindcss";

declare const baseConfig: Partial<Config>;

declare const animation: Partial<
  Config["theme"]["animation"] & Config["theme"]["keyframes"]
>;

export default baseConfig;
export { animation };
