# syntax=docker/dockerfile:1

# ---- BUILD: deps + prisma generate ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# generiraj @prisma/client (engini će se spakirati u node_modules/.prisma)
RUN npx prisma generate

# ---- RUNTIME ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# >>> KLUČNO za Prisma na Debian/bookworm:
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# OpenSSL runtime za Prisma (libssl3 + certs)
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends libssl3 openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# kopiraj build (uklj. node_modules s generiranim klijentom)
COPY --from=build /app /app

# mount točka za Fly volume
RUN mkdir -p /data
EXPOSE 8080

# na startu: migracije -> server
CMD ["bash", "-lc", "npx prisma migrate deploy && node index.js"]
