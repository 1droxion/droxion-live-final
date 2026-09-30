export async function compressImage(file) {
  if (!file) throw new Error("Choose a photo first.");
  if (!String(file.type || "").startsWith("image/")) throw new Error("Please choose an image.");

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not open that photo."));
    img.src = dataUrl;
  });

  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image processing is unavailable on this device.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = canvas.toDataURL("image/jpeg", 0.8);
  if (!compressed || compressed.length > 7_000_000) {
    throw new Error("That image is too large. Try another photo.");
  }
  return compressed;
}

export async function makeThumbnail(dataUrl) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxSide = 280;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.58);
}
