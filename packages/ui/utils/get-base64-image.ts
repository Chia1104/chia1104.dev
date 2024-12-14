export const getBase64Image = (
  canvas?: HTMLCanvasElement,
  img?: HTMLImageElement
) => {
  const _canvas = canvas ?? document.createElement("canvas");
  if (img) {
    _canvas.width = img.width;
    _canvas.height = img.height;
    const ctx = _canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0);
  }
  const dataURL = _canvas.toDataURL("image/png");
  return dataURL.replace(/^data:image\/?[A-z]*;base64,/, "");
};
