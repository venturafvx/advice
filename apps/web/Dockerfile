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
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /repo
COPY . .
RUN pnpm --filter "@advice/domain" --filter "@advice/application" --filter "@advice/infrastructure" run build
RUN pnpm --filter "@advice/web" run build

FROM base AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
