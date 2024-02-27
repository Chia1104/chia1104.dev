import type { OptionalConfig } from "tailwindcss";

declare const baseConfig: Partial<OptionalConfig>;

declare const animation: ({
  disableTailwindAnimation,
}?: {
  disableTailwindAnimation?: boolean;
}) => Partial<OptionalConfig>;

declare const shadcnConfig: Partial<OptionalConfig>;

declare const egoistIcons: Partial<OptionalConfig>;

export default baseConfig;
export { animation, shadcnConfig, egoistIcons };
