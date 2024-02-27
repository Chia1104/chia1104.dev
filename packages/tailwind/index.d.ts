declare const baseConfig: Partial<import("tailwindcss").Config>;

declare const animation: ({
  disableTailwindAnimation,
}?: {
  disableTailwindAnimation?: boolean;
}) => Partial<import("tailwindcss").Config>;

declare const shadcnConfig: Partial<import("tailwindcss").Config>;

declare const egoistIcons: Partial<import("tailwindcss").Config>;

export default baseConfig;
export { animation, shadcnConfig, egoistIcons };
