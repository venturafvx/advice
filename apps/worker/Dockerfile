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

FROM base AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/packages/domain/dist ./packages/domain/dist
COPY --from=builder /repo/packages/domain/package.json ./packages/domain/package.json
COPY --from=builder /repo/packages/application/dist ./packages/application/dist
COPY --from=builder /repo/packages/application/package.json ./packages/application/package.json
COPY --from=builder /repo/packages/infrastructure/dist ./packages/infrastructure/dist
COPY --from=builder /repo/packages/infrastructure/drizzle ./packages/infrastructure/drizzle
COPY --from=builder /repo/packages/infrastructure/package.json ./packages/infrastructure/package.json
COPY --from=builder /repo/apps/worker/dist ./apps/worker/dist
COPY --from=builder /repo/apps/worker/package.json ./apps/worker/package.json
USER app
CMD ["node", "apps/worker/dist/index.js"]
