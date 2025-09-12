import path from "path";

export function checkFileType(
  file: Express.Multer.File,
  isPremium: boolean
): boolean {
  const premiumFileTypes =
    /mp3|wav|flac|aac|ogg|m4a|mp4|avi|mov|mkv|wmv|webm|flv/;

  const freeFileTypes = /mp3|wav|mp4|avi/;

  const fileTypes = isPremium ? premiumFileTypes : freeFileTypes;

  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype.toLowerCase());

  return extname && mimetype;
}

export function isFileTooLarge(file: Express.Multer.File): boolean {
  const MAX_SIZE = 50 * 1024 * 1024;
  return file.size > MAX_SIZE;
}
