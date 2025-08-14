# syntax=docker/dockerfile:1

# ---- BUILD STAGE: install deps (uklj. dev), generate prisma client ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Brži cache za instalaciju
COPY package*.json ./
RUN npm ci

# Kopiraj ostatak koda i generiraj Prisma client
COPY . .
RUN npx prisma generate

# ---- RUNTIME STAGE: openssl + app ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 8080

# OpenSSL za Prisma engines
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Kopiraj sve iz build stage-a (uklj. node_modules s generiranim @prisma/client)
COPY --from=build /app /app

# Mount točka za Fly volume
RUN mkdir -p /data

# Na startu: primijeni migracije pa pokreni server
CMD ["bash", "-lc", "npx prisma migrate deploy && node index.js"]
