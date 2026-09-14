/** The package ships `register-hooks.d.ts`, which TypeScript does not pair with the `.mjs` entry. */
declare module "import-in-the-middle/register-hooks.mjs" {
  export const register: (options?: {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
  }) => void;
}
