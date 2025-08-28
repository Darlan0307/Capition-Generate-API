import multer from "multer";
import fs from "fs";
import path from "path";

export const UPLOAD_ROOT = path.resolve("uploads");
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

export const upload = multer({
  dest: UPLOAD_ROOT,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      // Áudio
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/flac",
      "audio/aac",
      "audio/ogg",
      "audio/m4a",
      "audio/x-m4a",
      // Vídeo
      "video/mp4",
      "video/avi",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-ms-wmv",
      "video/webm",
      "video/x-flv",
      "video/x-matroska",
    ];

    const isAllowed =
      allowedMimes.includes(file.mimetype) ||
      file.originalname.match(
        /\.(mp3|wav|flac|aac|ogg|m4a|mp4|avi|mov|mkv|wmv|webm|flv)$/i
      );

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Formato de arquivo não suportado. Use áudio (MP3, WAV, FLAC, AAC, OGG, M4A) ou vídeo (MP4, AVI, MOV, MKV, WMV, WEBM, FLV)."
        )
      );
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
