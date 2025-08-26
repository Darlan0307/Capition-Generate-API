import express from "express";
import multer from "multer";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(cors());

const UPLOAD_ROOT = path.resolve("uploads");
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// Configuração do multer com validação de tipos E LIMITE DE TAMANHO
const upload = multer({
  dest: UPLOAD_ROOT,
  fileFilter: (req, file, cb) => {
    // Aceita áudio e vídeo
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
    fileSize: 50 * 1024 * 1024, // REDUZIDO: 50MB limite para plano gratuito
  },
});

// Controle de concorrência - apenas 1 processamento por vez
let isProcessing = false;
const processingQueue: Array<() => void> = [];

// Render exige bind em 0.0.0.0 e porta da env
const PORT = Number(process.env.PORT || 4000);

// caminho do binário e do modelo dentro da imagem
// O executável pode ter diferentes nomes dependendo da versão
const POSSIBLE_WHISPER_BINS = [
  "/app/whisper.cpp/build/bin/whisper-cli", // novo executável preferido
  "/app/whisper.cpp/whisper-cli",
  "/app/whisper.cpp/build/bin/main", // depreciado mas ainda funciona
  "/app/whisper.cpp/main",
  "/app/whisper.cpp/whisper",
  "/app/whisper.cpp/examples/main",
];

let WHISPER_BIN = "";
for (const bin of POSSIBLE_WHISPER_BINS) {
  if (fs.existsSync(bin)) {
    WHISPER_BIN = bin;
    console.log(`Usando binário: ${bin}`);
    break;
  }
}

const WHISPER_MODEL = "/app/whisper.cpp/models/ggml-tiny.en.bin";

// Verifica se os arquivos existem no startup
console.log("Verificando arquivos do Whisper...");
console.log("Binário encontrado:", WHISPER_BIN || "NENHUM ENCONTRADO");
console.log("Modelo existe:", fs.existsSync(WHISPER_MODEL));

// Testa o whisper com --help para ver se funciona
if (WHISPER_BIN) {
  console.log("Testando whisper com --help...");
  try {
    const helpResult = spawn(WHISPER_BIN, ["--help"], { stdio: "pipe" });
    helpResult.stdout.on("data", (data) => {
      console.log(
        "Whisper help (primeiras linhas):",
        data.toString().split("\n").slice(0, 5).join("\n")
      );
    });
    helpResult.stderr.on("data", (data) => {
      console.log("Whisper stderr:", data.toString().slice(0, 200));
    });
  } catch (e) {
    console.error("Erro ao testar whisper --help:", e);
  }
}

if (!WHISPER_BIN) {
  console.error("ERRO: Nenhum binário do Whisper encontrado!");
  console.log("Tentativas:");
  POSSIBLE_WHISPER_BINS.forEach((bin) => {
    console.log(`  ${bin}: ${fs.existsSync(bin) ? "EXISTS" : "NOT FOUND"}`);
  });

  console.log("Listando conteúdo de /app/whisper.cpp/:");
  try {
    const files = fs.readdirSync("/app/whisper.cpp/");
    files.forEach((file) => {
      const fullPath = `/app/whisper.cpp/${file}`;
      const stats = fs.statSync(fullPath);
      console.log(
        `  ${file} ${
          stats.isFile() && stats.mode & 0o111 ? "[EXECUTABLE]" : ""
        }`
      );
    });
  } catch (e) {
    console.error("Erro ao listar diretório:", e);
  }
}

if (!fs.existsSync(WHISPER_MODEL)) {
  console.error(`ERRO: Modelo não encontrado em ${WHISPER_MODEL}`);
  console.log("Listando conteúdo de /app/whisper.cpp/models/:");
  try {
    console.log(fs.readdirSync("/app/whisper.cpp/models/"));
  } catch (e) {
    console.error("Erro ao listar diretório de models:", e);
  }
}

/**
 * Helper: aguarda o fim de um processo (spawn) e coleta stdout/stderr
 */
function runProc(
  cmd: string,
  args: string[],
  opts: any = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    console.log(`Executando: ${cmd} ${args.join(" ")}`);

    const child = spawn(cmd, args, opts);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));

    child.on("error", (err) => {
      console.error(`Erro ao executar ${cmd}:`, err);
      reject(err);
    });
  });
}

app.get("/formats", (_, res) => {
  res.json({
    supported_formats: {
      audio: ["MP3", "WAV", "FLAC", "AAC", "OGG", "M4A"],
      video: ["MP4", "AVI", "MOV", "MKV", "WMV", "WEBM", "FLV"],
      max_file_size: "50MB (plano gratuito)",
      note: "Para vídeos, apenas o áudio será processado para transcrição",
      model: "Whisper Tiny (otimizado para baixo consumo de RAM)",
      concurrent_processing: false,
    },
  });
});

app.get("/health", (_, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    ok: true,
    whisper_binary: WHISPER_BIN || "not found",
    model_loaded: fs.existsSync(WHISPER_MODEL),
    processing: isProcessing,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heap: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
      external: Math.round(memUsage.external / 1024 / 1024) + "MB",
    },
  });
});

app.post("/transcribe", upload.single("media"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "Nenhum arquivo de mídia enviado" });

  // Controle de concorrência para plano gratuito
  if (isProcessing) {
    return res.status(429).json({
      error: "Servidor ocupado. Tente novamente em alguns minutos.",
      message: "O plano gratuito permite apenas um processamento por vez.",
    });
  }

  console.log(
    `Arquivo recebido: ${req.file.originalname} (${req.file.mimetype})`
  );

  // Verifica novamente se os arquivos existem
  if (!WHISPER_BIN) {
    return res.status(500).json({
      error: "Nenhum binário do Whisper encontrado",
    });
  }

  if (!fs.existsSync(WHISPER_MODEL)) {
    return res.status(500).json({
      error: `Modelo do Whisper não encontrado em ${WHISPER_MODEL}`,
    });
  }

  isProcessing = true; // Marca como ocupado

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

    console.log(`Processando ${files.length} chunks...`);

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
        console.log(
          `Processando chunk ${i + 1}/${files.length}: ${path.basename(
            chunkPath
          )}`
        );

        // Monitora uso de memória
        const memUsage = process.memoryUsage();
        console.log(
          `Memória: RSS=${Math.round(
            memUsage.rss / 1024 / 1024
          )}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
        );

        // Verifica se o arquivo de áudio existe e tem conteúdo
        const stats = fs.statSync(chunkPath);
        console.log(`Tamanho do chunk: ${stats.size} bytes`);

        if (stats.size === 0) {
          console.warn(`Chunk vazio: ${path.basename(chunkPath)}`);
          continue;
        }

        // Processa com timeout para evitar travamento
        const tr = await Promise.race([
          runProc(WHISPER_BIN, args),
          new Promise<any>(
            (_, reject) => setTimeout(() => reject(new Error("Timeout")), 60000) // 60s timeout
          ),
        ]);

        console.log(`Código de saída: ${tr.code}`);

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

          console.log(`Chunk processado: ${path.basename(chunkPath)}`);

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
    isProcessing = false; // Libera o processamento

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`server listening on http://0.0.0.0:${PORT}`);
});
