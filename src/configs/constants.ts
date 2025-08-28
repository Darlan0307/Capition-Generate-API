import fs from "fs";

export const PORT = Number(process.env.PORT || 4000);
export const WHISPER_MODEL = process.env.WHISPER_MODEL_PATH || "";
export const WHISPER_BIN = process.env.WHISPER_BIN || "";

if (!fs.existsSync(WHISPER_MODEL)) {
  throw new Error(`ERRO: Modelo não encontrado em ${WHISPER_MODEL}`);
}

if (!fs.existsSync(WHISPER_BIN)) {
  throw new Error(`ERRO: Binário não encontrado em ${WHISPER_BIN}`);
}
