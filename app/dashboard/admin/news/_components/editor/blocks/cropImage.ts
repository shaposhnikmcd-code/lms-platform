// Утиліта для обрізки зображення через canvas. Повертає Blob у форматі JPEG.
// `croppedAreaPixels` — координати з react-easy-crop (x, y, width, height у px).

export interface PixelArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function cropImageToBlob(
  imageSrc: string,
  croppedAreaPixels: PixelArea,
  mimeType = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context недоступний");

  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y,
    croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0,
    croppedAreaPixels.width, croppedAreaPixels.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Не вдалося створити blob")),
      mimeType,
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Для cross-origin (Cloudinary) — щоб canvas не «забруднився» CORS-ом.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не вдалося завантажити зображення: ${src}`));
    img.src = src;
  });
}
