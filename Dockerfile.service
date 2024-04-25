ARG NODE_VERSION=21

FROM node:${NODE_VERSION}-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    corepack enable pnpm && \
    # turbo issue #7993(https://github.com/vercel/turbo/issues/7993)
    pnpm add -g turbo@canary

FROM base AS pre-builder

COPY . .

RUN turbo prune --scope=service --docker

FROM base AS builder

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .
COPY ./packages/cache /app/packages/cache
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN \
    DATABASE_URL \
    BETA_DATABASE_URL \
    ENV \
    RAILWAY_ENVIRONMENT_NAME \
    ZEABUR_ENVIRONMENT_NAME \
    RAILWAY_STATIC_URL \
    RAILWAY_PUBLIC_DOMAIN \
    ZEABUR_URL \
    REDIS_URI \
    REDIS_URL \
    SPOTIFY_CLIENT_ID \
    SPOTIFY_CLIENT_SECRET \
    SPOTIFY_REDIRECT_URI \
    GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET \
    AUTH_SECRET

ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN \
    DATABASE_URL=${DATABASE_URL} \
    BETA_DATABASE_URL=${BETA_DATABASE_URL} \
    ENV=${ENV} \
    RAILWAY_ENVIRONMENT_NAME=${RAILWAY_ENVIRONMENT_NAME} \
    ZEABUR_ENVIRONMENT_NAME=${ZEABUR_ENVIRONMENT_NAME} \
    RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL} \
    RAILWAY_PUBLIC_DOMAIN=${RAILWAY_PUBLIC_DOMAIN} \
    ZEABUR_URL=${ZEABUR_URL} \
    REDIS_URI=${REDIS_URI} \
    REDIS_URL=${REDIS_URL} \
    SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID} \
    SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET} \
    SPOTIFY_REDIRECT_URI=${SPOTIFY_REDIRECT_URI} \
    GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
    GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} \
    AUTH_SECRET=${AUTH_SECRET}

RUN pnpm i

RUN pnpm turbo run build --filter=service...

FROM base as prod

COPY --from=pre-builder /app/out/json/ .
COPY --from=pre-builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pre-builder /app/out/full/ .

RUN pnpm i --prod --ignore-scripts

FROM base as runner

COPY --from=builder /app/apps/service/dist ./apps/service/dist
COPY --from=builder /app/packages/auth-core/dist ./packages/auth-core/dist
COPY ./packages/auth-core/package.json ./packages/auth-core/package.json
COPY ./packages/cache/package.json ./packages/cache/package.json
COPY --from=prod /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=prod /app/node_modules ./node_modules

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD [ "node", "apps/service/dist/main.js" ]
