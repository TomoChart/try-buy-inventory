# syntax=docker/dockerfile:1

# 1) Prod deps
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# 2) Build (dev deps + prisma generate)
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

# 3) Runtime
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# health i port
EXPOSE 8080

# Kopiraj node_modules i app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app ./

# osiguraj mount točku volumena
RUN mkdir -p /data

# Na startu: migracije pa server
CMD ["bash", "-lc", "npx prisma migrate deploy && node index.js"]
