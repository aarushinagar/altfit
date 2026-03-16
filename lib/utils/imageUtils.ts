/**
 * Image utilities — browser-side only
 */

export async function detectRealType(
  file: File,
): Promise<"jpeg" | "png" | "webp" | "heic" | "unknown"> {
  const buf = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57)
    return "webp";
  const ftyp = String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (ftyp === "ftyp") return "heic";
  return "unknown";
}

export function isHeicFile(file: File): boolean {
  const name = (file.name || "").toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

export interface PreparedImage {
  base64: string;
  previewDataURL: string;
  mediaType: string;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.readAsDataURL(file);
  });

  const jpeg = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.src = dataURL;
  });

  return {
    base64: jpeg.split(",")[1],
    previewDataURL: jpeg,
    mediaType: "image/jpeg",
  };
}

const CROP_BOXES: Record<string, { y: number; h: number }> = {
  top: { y: 0.04, h: 0.6 },
  outerwear: { y: 0.04, h: 0.72 },
  bottom: { y: 0.32, h: 0.65 },
  dress: { y: 0.04, h: 0.94 },
  footwear: { y: 0.62, h: 0.36 },
  bag: { y: 0.22, h: 0.6 },
  accessory: { y: 0.04, h: 0.48 },
};

export function cropImageForCategory(
  sourceDataUrl: string,
  category: string,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth,
        H = img.naturalHeight;
      const box = CROP_BOXES[(category || "").toLowerCase()] || {
        y: 0.0,
        h: 1.0,
      };
      const sy = Math.round(H * box.y),
        sh = Math.round(H * box.h);
      const c = document.createElement("canvas");
      c.width = W;
      c.height = sh;
      c.getContext("2d")!.drawImage(img, 0, sy, W, sh, 0, 0, W, sh);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => resolve(sourceDataUrl);
    img.src = sourceDataUrl;
  });
}
