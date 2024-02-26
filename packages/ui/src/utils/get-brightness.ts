interface Options {
  delta?: number;
}

interface Result {
  brightness: number;
  isLight: boolean;
}

export const getBrightness = (rgb: number[], options?: Options): Result => {
  options ??= {};
  const { delta = 125 } = options;
  const brightness = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
  const isLight = brightness > delta;
  return { brightness, isLight };
};
