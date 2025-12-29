import sharp from "sharp";

export async function generateImages(buffer: Buffer) {
  const thumb = await sharp(buffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const main = await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return { thumb, main };
}
