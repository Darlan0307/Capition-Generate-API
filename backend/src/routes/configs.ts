import { Router } from "express";
import { MAX_TRANSCRIPTIONS_FREE } from "../configs";

export const routerConfigs = Router();

routerConfigs.get("/max-transcriptions-free", async (req, res) => {
  res.status(200).json({ maxTranscriptionsFree: MAX_TRANSCRIPTIONS_FREE });
});
