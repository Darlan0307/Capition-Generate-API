import fs from "fs";

export const PORT = Number(process.env.PORT || 4000);
export const WHISPER_MODEL = process.env.WHISPER_MODEL_PATH || "";
export const WHISPER_BIN = process.env.WHISPER_BIN || "";
export const MAX_TRANSCRIPTIONS_FREE =
  Number(process.env.MAX_TRANSCRIPTIONS_FREE) || 3;

if (!fs.existsSync(WHISPER_MODEL)) {
  throw new Error(`ERROR: Model not found in ${WHISPER_MODEL}`);
}

if (!fs.existsSync(WHISPER_BIN)) {
  throw new Error(`ERROR: Binary not found in ${WHISPER_BIN}`);
}
