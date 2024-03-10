/**
 * @todo The CommonJS vs ES Modules "War"
 */
export const dynamicImportPackage = async <T = unknown>(packageName: string) =>
  new Function(`return import('${packageName}')`)() as Promise<T>;
