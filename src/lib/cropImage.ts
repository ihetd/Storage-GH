// Client-side canvas crop. Given an image source and the pixel crop area from
// react-easy-crop, produce a square-ish cropped JPEG Blob to upload.

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = src;
  });
}

// Cap the output so uploads stay small even from large source photos.
const MAX_OUTPUT = 800;

export async function getCroppedBlob(
  src: string,
  crop: PixelCrop,
  quality = 0.85,
): Promise<Blob> {
  const image = await loadImage(src);

  const scale = Math.min(1, MAX_OUTPUT / Math.max(crop.width, crop.height));
  const outW = Math.round(crop.width * scale);
  const outH = Math.round(crop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create image blob"));
      },
      "image/jpeg",
      quality,
    );
  });
}
