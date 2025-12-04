interface Options {
  blockSize?: number;
  defaultRGB?: [number, number, number];
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
}

export const experimental_getImgAverageRGB = (
  img?: HTMLImageElement | null,
  options?: Options
) => {
  options ??= {};
  const {
    blockSize = 5,
    defaultRGB = [0, 0, 0],
    canvas = document.createElement("canvas"),
    context = canvas.getContext("2d"),
  } = options;

  if (!img || !(img instanceof HTMLImageElement)) {
    console.warn(`experimental_getImgAverageRGB: Invalid argument`, "img");
    return defaultRGB;
  } else if (!context) {
    console.warn(`experimental_getImgAverageRGB: Invalid argument`, "context");
    return defaultRGB;
  }

  let data: Uint8ClampedArray;
  const width = img.naturalWidth || img.offsetWidth || img.width;
  const height = img.naturalHeight || img.offsetHeight || img.height;

  canvas.width = width;
  canvas.height = height;

  context.drawImage(img, 0, 0);

  try {
    data = context.getImageData(0, 0, width, height).data;
  } catch (e) {
    console.warn(`experimental_getImgAverageRGB:`, e);
    return defaultRGB;
  }

  const length = data.length;
  const rgb: [number, number, number] = [...defaultRGB];
  let count = 0;

  for (let i = 0; i < length; i += blockSize * 4) {
    ++count;
    rgb[0] += data[i] ?? 0;
    rgb[1] += data[i + 1] ?? 0;
    rgb[2] += data[i + 2] ?? 0;
  }
  rgb[0] = ~~(rgb[0] / count);
  rgb[1] = ~~(rgb[1] / count);
  rgb[2] = ~~(rgb[2] / count);

  return rgb;
};
