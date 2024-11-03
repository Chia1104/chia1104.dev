ARG BUN_VERSION=1.1.34
ARG NODE_VERSION=20

FROM oven/bun:$BUN_VERSION as runner-base

WORKDIR /app

FROM node:${NODE_VERSION}-alpine AS builder-base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk update && \
    apk add --no-cache \
    python3 \
    build-base \
    gcc \
    libc6-compat && \
    corepack enable pnpm && \
    pnpm add -g turbo && \
    ln -sf /usr/bin/python3 /usr/bin/python

FROM builder-base AS pre-builder

COPY . .

RUN turbo prune --scope=service --docker

FROM builder-base AS builder

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN

ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN

RUN pnpm i

RUN pnpm turbo run build --filter=service...

FROM builder-base as prod

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .

RUN pnpm i --prod --ignore-scripts

FROM runner-base as runner

COPY --from=builder /app/apps/service/dist ./apps/service/dist
COPY --from=prod /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=prod /app/node_modules ./node_modules

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD [ "bun", "apps/service/dist/server.js" ]
