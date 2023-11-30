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

FROM base AS pre-builder

COPY . .

RUN turbo prune --scope=service --docker

FROM base AS builder

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .
COPY ./packages/db /app/packages/db
COPY ./packages/utils /app/packages/utils
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN \
    DATABASE_URL

ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN \
    DATABASE_URL=${DATABASE_URL}

RUN pnpm i

RUN pnpm turbo run build --filter=service...

FROM base as prod

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .

RUN pnpm i --prod --ignore-scripts

FROM base as runner

COPY --from=builder /app/apps/service/dist ./apps/service/dist
COPY ./packages/db/package.json ./packages/db/package.json
COPY --from=prod /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=prod /app/node_modules ./node_modules

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD [ "node", "apps/service/dist/main.js" ]
