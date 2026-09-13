# Contexto de build: raiz do monorepo (necessário para acessar o
# pnpm-workspace.yaml, o lockfile raiz e os packages/* dos quais este
# serviço depende). Ver docker-compose.yml.

FROM node:24-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/application/package.json ./packages/application/package.json
COPY packages/infrastructure/package.json ./packages/infrastructure/package.json
COPY apps/worker/package.json ./apps/worker/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /repo
COPY . .
RUN pnpm --filter "@advice/domain" --filter "@advice/application" --filter "@advice/infrastructure" --filter "@advice/worker" run build
# `pnpm deploy` materializa um node_modules completo e autocontido pro
# worker (incluindo as dependências dos workspace packages, resolvidas
# de verdade — não symlinks quebrados). Copiar node_modules manualmente
# não funciona aqui: cada pacote pnpm tem seu próprio node_modules/ com
# os symlinks das SUAS dependências, e copiar só o da raiz os deixa de fora.
RUN pnpm --filter "@advice/worker" deploy --prod /out/worker

FROM base AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /out/worker ./
USER app
CMD ["node", "dist/index.js"]
