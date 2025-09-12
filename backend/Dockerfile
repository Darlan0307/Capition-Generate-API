# 1. Etapa de build do Whisper.cpp

FROM debian:bullseye-slim AS whisper-build

RUN apt-get update && apt-get install -y \
    build-essential git cmake ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git

WORKDIR /src/whisper.cpp
RUN make

# modelo mais leve em RAM e storage
RUN bash ./models/download-ggml-model.sh tiny.en

# 2. Etapa de build do Node.js (TypeScript + Prisma)

FROM node:18-slim AS node-build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build && npx prisma generate

# 3. Etapa final - Produção

FROM node:18-slim


RUN apt-get update && apt-get install -y ffmpeg python3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m appuser
USER appuser


WORKDIR /app

COPY --from=whisper-build /src/whisper.cpp/build/bin/whisper-cli /app/whisper-cli
COPY --from=whisper-build /src/whisper.cpp/models/ggml-tiny.en.bin /app/models/ggml-tiny.en.bin

COPY package*.json ./
RUN npm ci --only=production

COPY --from=node-build /app/dist ./dist
COPY --from=node-build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000

CMD ["npm", "run", "start"]
