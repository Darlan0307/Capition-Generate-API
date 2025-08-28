import express from "express";
import fs from "fs";
import cors from "cors";
import { handleMulterErrors } from "./middlewares";
import { isProcessing, routerCaption } from "./routes";
import { PORT, WHISPER_MODEL } from "./configs";

const app = express();
app.use(cors());
// TODO: adicionar middlewares de auth e error handling
app.use(handleMulterErrors);

app.get("/health", (_, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    ok: true,
    model_loaded: fs.existsSync(WHISPER_MODEL),
    processing: isProcessing,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heap: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
      external: Math.round(memUsage.external / 1024 / 1024) + "MB",
    },
  });
});

app.use(routerCaption);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`server listening on http://0.0.0.0:${PORT}`);
});
