import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { upload, UPLOAD_ROOT } from "../lib";
import { checkFileType, isFileTooLarge, runProc } from "../utils";
import { WHISPER_BIN, WHISPER_MODEL } from "../configs";

export const routerCaption = Router();

export let isProcessing = false;

routerCaption.get("/formats", (_, res) => {
  res.json({
    supported_formats: {
      audio: ["MP3", "WAV", "FLAC", "AAC", "OGG", "M4A"],
      video: ["MP4", "AVI", "MOV", "MKV", "WMV", "WEBM", "FLV"],
    },
  });
});

routerCaption.post("/transcribe", upload.single("media"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ errorMessage: "No media files submitted" });

  console.log(`User: ${req.user}`);

  if (!checkFileType(req.file, req?.user?.isPremium ?? false)) {
    return res.status(400).json({ errorMessage: "Invalid file format" });
  }

  if (isFileTooLarge(req.file) && !req?.user?.isPremium) {
    return res.status(400).json({
      errorMessage: "The file exceeds the size limit allowed in the free plan.",
    });
  }

  if (isProcessing && !req?.user?.isPremium) {
    return res.status(429).json({
      errorMessage: "The free plan only allows one process at a time.",
    });
  }

  isProcessing = true;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  const jobId = crypto.randomUUID();
  const jobDir = path.join(UPLOAD_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const inputPath = path.resolve(req.file.path);
  const chunkPattern = path.join(jobDir, "chunk_%03d.wav");

  try {
    const segArgs = [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-acodec",
      "pcm_s16le",
      "-f",
      "segment",
      "-segment_time",
      "15",
      "-reset_timestamps",
      "1",
      chunkPattern,
    ];
    const seg = await runProc("ffmpeg", segArgs);

    if (seg.code !== 0) {
      throw new Error(`ffmpeg segment error: ${seg.stderr}`);
    }

    const files = fs
      .readdirSync(jobDir)
      .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
      .map((f) => path.join(jobDir, f))
      .sort();

    if (files.length === 0) {
      throw new Error("No chunk generated");
    }

    for (let i = 0; i < files.length; i++) {
      const chunkPath = files[i];

      if (global.gc) {
        global.gc();
      }

      const args = [
        "--model",
        WHISPER_MODEL,
        "--file",
        chunkPath,
        "--output-txt",
        "--language",
        "en",
        "--threads",
        "1",
        "--no-timestamps",
        "--best-of",
        "1",
        "--beam-size",
        "1",
      ];

      try {
        const stats = fs.statSync(chunkPath);

        if (stats.size === 0) {
          continue;
        }

        const tr = await Promise.race([
          runProc(WHISPER_BIN, args),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 60000)
          ),
        ]);

        if (tr.code !== 0) {
          console.error(`Chunk error ${path.basename(chunkPath)}:`, tr.stderr);
          res.write(
            `data: ${JSON.stringify({
              error: `Chunk error: ${path.basename(chunkPath)} - ${
                tr.stderr || "Unknown error"
              }`,
            })}\n\n`
          );
        } else {
          let text = tr.stdout.trim();

          if (!text) {
            const txtFile = chunkPath.replace(".wav", ".txt");
            try {
              if (fs.existsSync(txtFile)) {
                text = fs.readFileSync(txtFile, "utf8").trim();
                fs.unlinkSync(txtFile);
              }
            } catch (e) {
              console.warn(`Erro ao ler arquivo txt: ${e}`);
            }
          }

          if (text) {
            res.write(
              `data: ${JSON.stringify({
                text,
                progress: Math.round(((i + 1) / files.length) * 100),
              })}\n\n`
            );
          } else {
            console.warn(
              `No text extracted from the chunk: ${path.basename(chunkPath)}`
            );
          }
        }
      } catch (chunkError: any) {
        console.error(
          `Error processing chunk ${path.basename(chunkPath)}:`,
          chunkError
        );
        res.write(
          `data: ${JSON.stringify({
            error: `Chunk error: ${path.basename(chunkPath)} - ${
              chunkError.message
            }`,
          })}\n\n`
        );
      } finally {
        try {
          fs.unlinkSync(chunkPath);
        } catch {}
      }
    }

    res.write("event: end\n");
    res.write("data: FIM\n\n");
    res.end();
  } catch (e: any) {
    console.error("Processing error:", e);
    res.write(
      `data: ${JSON.stringify({
        error: e?.message || "Processing error",
      })}\n\n`
    );
    res.write("event: end\n");
    res.write("data: FIM\n\n");
    res.end();
  } finally {
    clearInterval(keepAlive);
    isProcessing = false;

    try {
      fs.unlinkSync(inputPath);
    } catch {}
    try {
      fs.rmSync(jobDir, { recursive: true, force: true });
    } catch {}

    if (global.gc) {
      global.gc();
    }
  }
});
