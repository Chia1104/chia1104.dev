ARG NODE_VERSION=18

FROM node:${NODE_VERSION}-alpine AS base

FROM base AS builder

WORKDIR /app
COPY . .

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    yarn global add turbo && \
    turbo prune --scope=dash --docker

FROM base AS installer

WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN \
    NEXTAUTH_SECRET \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    NEXTAUTH_URL

ENV TURBO_TEAM=${TURBO_TEAM} \
    TURBO_TOKEN=${TURBO_TOKEN} \
    NEXTAUTH_SECRET=${NEXTAUTH_SECRET} \
    GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
    GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} \
    NEXTAUTH_URL=${NEXTAUTH_URL}

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    corepack enable && \
    pnpm i && \
    pnpm turbo run db:generate && \
    pnpm turbo run build --filter=dash...

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

COPY --from=installer /app/apps/dash/next.config.mjs .
COPY --from=installer /app/apps/dash/package.json .
COPY --from=installer /app/apps/dash/public ./apps/dash/public

COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dash/.next/static ./apps/dash/.next/static

ARG DATABASE_URL \
    NEXTAUTH_SECRET \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    NEXTAUTH_URL

ENV DATABASE_URL=${DATABASE_URL} \
    NEXTAUTH_SECRET=${NEXTAUTH_SECRET} \
    GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
    GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    PORT=8080 \
    NODE_ENV=production \
    HOST=0.0.0.0

EXPOSE 8080

CMD node apps/dash/server.js
