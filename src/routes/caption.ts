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
    return res
      .status(400)
      .json({ errorMessage: "Nenhum arquivo de mídia enviado" });

  console.log(`User: ${req.user}`);

  if (!checkFileType(req.file, false)) {
    return res
      .status(400)
      .json({ errorMessage: "Formato de arquivo inválido" });
  }

  if (isFileTooLarge(req.file)) {
    return res.status(400).json({
      errorMessage:
        "O arquivo excede o limite de tamanho permitido no plano gratuito.",
    });
  }

  if (isProcessing) {
    return res.status(429).json({
      errorMessage: "O plano gratuito permite apenas um processamento por vez.",
    });
  }

  isProcessing = true;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n"); // comentário SSE para manter a conexão viva
  }, 15000);

  // cada request tem uma pasta própria p/ evitar colisões em concorrência
  const jobId = crypto.randomUUID();
  const jobDir = path.join(UPLOAD_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const inputPath = path.resolve(req.file.path);
  const chunkPattern = path.join(jobDir, "chunk_%03d.wav");

  try {
    // 1) extrai áudio e segmenta em ~15s (chunks menores para menos RAM)
    const segArgs = [
      "-y",
      "-i",
      inputPath,
      "-vn", // sem vídeo
      "-ac",
      "1", // mono
      "-ar",
      "16000", // 16kHz sample rate
      "-acodec",
      "pcm_s16le", // codec PCM explícito
      "-f",
      "segment",
      "-segment_time",
      "15", // chunks menores para economizar RAM
      "-reset_timestamps",
      "1", // reseta timestamps para cada segmento
      chunkPattern,
    ];
    const seg = await runProc("ffmpeg", segArgs);

    if (seg.code !== 0) {
      throw new Error(`ffmpeg segment error: ${seg.stderr}`);
    }

    // 2) lista chunks
    const files = fs
      .readdirSync(jobDir)
      .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
      .map((f) => path.join(jobDir, f))
      .sort();

    if (files.length === 0) {
      throw new Error("Nenhum chunk gerado");
    }

    // 3) processa cada chunk com whisper.cpp e envia parcial via SSE
    for (let i = 0; i < files.length; i++) {
      const chunkPath = files[i];

      // Força garbage collection entre chunks para liberar memória
      if (global.gc) {
        global.gc();
      }

      // Parâmetros otimizados para baixa memória
      const args = [
        "--model",
        WHISPER_MODEL,
        "--file",
        chunkPath,
        "--output-txt", // gera arquivo .txt
        "--language",
        "en", // força inglês
        "--threads",
        "1", // REDUZIDO: apenas 1 thread para economizar RAM
        "--no-timestamps", // texto limpo sem timestamps
        "--best-of",
        "1", // NOVO: reduz tentativas para economizar RAM
        "--beam-size",
        "1", // NOVO: beam search mínimo
      ];

      try {
        // Verifica se o arquivo de áudio existe e tem conteúdo
        const stats = fs.statSync(chunkPath);

        if (stats.size === 0) {
          continue;
        }

        // Processa com timeout para evitar travamento
        const tr = await Promise.race([
          runProc(WHISPER_BIN, args),
          new Promise<any>(
            (_, reject) => setTimeout(() => reject(new Error("Timeout")), 60000) // 60s timeout
          ),
        ]);

        if (tr.code !== 0) {
          console.error(
            `Erro no chunk ${path.basename(chunkPath)}:`,
            tr.stderr
          );
          res.write(
            `data: ${JSON.stringify({
              error: `Erro no chunk: ${path.basename(chunkPath)} - ${
                tr.stderr || "Erro desconhecido"
              }`,
            })}\n\n`
          );
        } else {
          // Para whisper-cli, a transcrição pode vir no stdout ou ser salva em arquivo .txt
          let text = tr.stdout.trim();

          // Se não há texto no stdout, tenta ler arquivo .txt gerado
          if (!text) {
            const txtFile = chunkPath.replace(".wav", ".txt");
            try {
              if (fs.existsSync(txtFile)) {
                text = fs.readFileSync(txtFile, "utf8").trim();
                fs.unlinkSync(txtFile); // limpa arquivo temporário
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
              `Nenhum texto extraído do chunk: ${path.basename(chunkPath)}`
            );
          }
        }
      } catch (chunkError: any) {
        console.error(
          `Erro ao processar chunk ${path.basename(chunkPath)}:`,
          chunkError
        );
        res.write(
          `data: ${JSON.stringify({
            error: `Erro no chunk: ${path.basename(chunkPath)} - ${
              chunkError.message
            }`,
          })}\n\n`
        );
      } finally {
        // Remove chunk imediatamente após processamento
        try {
          fs.unlinkSync(chunkPath);
        } catch {}
      }
    }

    // 4) fim do stream
    res.write("event: end\n");
    res.write("data: FIM\n\n");
    res.end();
  } catch (e: any) {
    console.error("Erro no processamento:", e);
    res.write(
      `data: ${JSON.stringify({
        error: e?.message || "Falha no processamento",
      })}\n\n`
    );
    res.write("event: end\n");
    res.write("data: FIM\n\n");
    res.end();
  } finally {
    clearInterval(keepAlive);
    isProcessing = false;

    // limpeza
    try {
      fs.unlinkSync(inputPath);
    } catch {}
    try {
      // remove pasta do job
      fs.rmSync(jobDir, { recursive: true, force: true });
    } catch {}

    // Força garbage collection final
    if (global.gc) {
      global.gc();
    }
  }
});
