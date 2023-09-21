ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    corepack enable && \
    yarn global add turbo

FROM base AS builder

COPY . .

RUN turbo prune --scope=backend --docker

FROM base AS installer

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN \
    DATABASE_URL

ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN \
    DATABASE_URL=${DATABASE_URL}

RUN pnpm i && \
    pnpm prisma generate && \
    pnpm turbo run build --filter=backend...

FROM base as runner

COPY --from=installer /app/ .

ARG DATABASE_URL

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL=${DATABASE_URL}

EXPOSE 8080

CMD [ "node", "apps/backend/dist/src/main.js" ]
