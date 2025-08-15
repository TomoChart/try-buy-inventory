
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Ako koristiš build step (npr. TypeScript), otvori sljedeću liniju:
# RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
