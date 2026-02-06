export const dynamicImportGlslAsText = async (
  path: string
): Promise<string> => {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Failed to load GLSL file: ${path} (${response.status} ${response.statusText})`
    );
  }

  const text = await response.text();

  if (!text.length) {
    throw new Error(`GLSL file is empty: ${path}`);
  }

  return text;
};

export const bundlerImportGlslAsText = async (
  path: string
): Promise<string> => {
  const mod: { default: string } = await import(path);
  return mod.default;
};
