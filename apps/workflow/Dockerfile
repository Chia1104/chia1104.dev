ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-alpine AS base

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
    npm install -g pnpm@12.1.0 turbo@2.10.12 && \
    ln -sf /usr/bin/python3 /usr/bin/python

FROM base AS pre-builder

COPY . .

RUN turbo prune --scope=workflow-service --docker

FROM base AS builder

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN

ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN \
    SKIP_ENV_VALIDATION=1

RUN pnpm install --frozen-lockfile

RUN pnpm turbo run build --filter=workflow-service...

FROM base AS runner

COPY --from=builder /app/apps/workflow/.output/server ./apps/workflow

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app/apps/workflow

EXPOSE 8080

CMD [ "node", "index.mjs" ]
