# syntax=docker/dockerfile:1

# 1) Instaliraj production deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# 2) Build sloj: dev deps (prisma), generate
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# generira @prisma/client iz prisma/schema.prisma
RUN npx prisma generate

# 3) Runtime sloj
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Kopiraj node_modules i app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app ./

# osiguraj mount točku za volume
RUN mkdir -p /data
EXPOSE 8080

# Na startu: primijeni migracije pa digni server
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
