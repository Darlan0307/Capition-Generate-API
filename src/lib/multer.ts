import multer from "multer";
import fs from "fs";
import path from "path";

export const UPLOAD_ROOT = path.resolve("uploads");
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

export const upload = multer({
  dest: UPLOAD_ROOT,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});
