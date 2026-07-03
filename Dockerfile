# GesIA — imagem de produção (Next.js + Prisma)
FROM node:20-slim AS base
WORKDIR /app
# Dependências de sistema p/ Prisma (openssl)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instala dependências
COPY package*.json ./
RUN npm ci

# Código + build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3003
EXPOSE 3003

# Em produção: aplicar migrações antes de iniciar (PostgreSQL).
# Para SQLite/disco persistente, montar volume em /app/prisma.
CMD ["npm", "run", "start"]
