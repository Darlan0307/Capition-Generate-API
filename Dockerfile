# Etapa de build do whisper.cpp
FROM debian:bullseye-slim AS build

# Instala dependências necessárias
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    cmake \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Clona e compila whisper.cpp
WORKDIR /app
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /app/whisper.cpp

# Compila o whisper.cpp
WORKDIR /app/whisper.cpp

# Compila usando make (comando padrão)
RUN make

# Baixa o modelo necessário - usando modelo tiny em vez de base para economizar RAM
RUN bash ./models/download-ggml-model.sh tiny.en

# Verifica quais executáveis foram criados
# RUN echo "=== Executáveis criados ===" && \
#     find . -maxdepth 1 -type f -executable | sort && \
#     echo "=== Conteúdo do diretório ===" && \
#     ls -la

# Etapa final (para rodar Node.js + whisper)
FROM node:18-slim

# Instala apenas o necessário
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia o whisper compilado da etapa anterior
COPY --from=build /app/whisper.cpp /app/whisper.cpp

# Verifica se os arquivos foram copiados corretamente
# RUN echo "=== Verificando executáveis após cópia ===" && \
#     find /app/whisper.cpp/ -name "*whisper*" -o -name "main" -type f -executable | sort && \
#     echo "=== Verificando modelo ===" && \
#     ls -la /app/whisper.cpp/models/ggml-tiny.en.bin

# Copia package.json e instala deps (inclui dev deps p/ build)
COPY package*.json ./
RUN npm install

# Copia o restante do código
COPY . .

# Compila TypeScript (gera dist/)
RUN npm run build

# Expõe porta
EXPOSE 4000

# CMD ["node", "--expose-gc", "dist/server.js"]
CMD ["npm", "run", "start"]