/**
 * @todo The CommonJS vs ES Modules "War"
 */
export const dynamicImportPackage = async <T = unknown>(packageName: string) =>
  // eslint-disable-next-line
  new Function(`return import('${packageName}')`)() as Promise<T>;
