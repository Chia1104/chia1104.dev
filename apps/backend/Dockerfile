ARG NODE_VERSION=18

FROM node:${NODE_VERSION}-alpine AS base

FROM base AS builder

WORKDIR /app
COPY . .

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    yarn global add turbo && \
    turbo prune --scope=backend --docker

FROM base AS installer

WORKDIR /app

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

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    yarn global add pnpm && \
    pnpm i && \
    yarn prisma generate && \
    yarn turbo run build --filter=backend...

FROM base as runner
WORKDIR /app
COPY --from=installer /app/ .

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL=${DATABASE_URL}

EXPOSE 8080

CMD [ "node", "apps/backend/dist/main.js" ]
