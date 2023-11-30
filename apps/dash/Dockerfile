ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    corepack enable && \
    pnpm add -g turbo

FROM base AS builder

COPY . .

RUN turbo prune --scope=dash --docker

FROM base AS installer

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN \
    DATABASE_URL \
    AUTH_URL \
    AUTH_SECRET \
    NEXT_PUBLIC_ENV

ENV TURBO_TEAM=${TURBO_TEAM} \
    TURBO_TOKEN=${TURBO_TOKEN} \
    DATABASE_URL=${DATABASE_URL} \
    AUTH_URL=${AUTH_URL} \
    AUTH_SECRET=${AUTH_SECRET} \
    NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV} \
    SKIP_ENV_VALIDATION=1

RUN pnpm i
RUN pnpm turbo run build --filter=dash...

FROM base AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

COPY --from=installer /app/apps/dash/next.config.mjs .
COPY --from=installer /app/apps/dash/package.json .
COPY --from=installer /app/apps/dash/public ./apps/dash/public

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/static ./apps/dash/.next/static

ENV PORT=8080 \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    HOSTNAME=0.0.0.0

EXPOSE 8080

CMD node apps/dash/server.js
