ARG NODE_VERSION=18

FROM node:${NODE_VERSION}-alpine AS base

FROM base AS builder

WORKDIR /app
COPY . .

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    yarn global add turbo && \
    turbo prune --scope=www --docker

FROM base AS installer

WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

ARG TURBO_TEAM \
    TURBO_TOKEN \
    GH_PUBLIC_TOKEN \
    GOOGLE_API_KEY \
    NEXT_PUBLIC_RE_CAPTCHA_KEY \
    ZEABUR_URL \
    RAILWAY_STATIC_URL \
    SHA_256_HASH \
    RAILWAY_STATIC_URL \
    VERCEL_URL \
    RESEND_API_KEY

ENV TURBO_TEAM=$TURBO_TEAM \
    TURBO_TOKEN=$TURBO_TOKEN \
    GH_PUBLIC_TOKEN=${GH_PUBLIC_TOKEN} \
    GOOGLE_API_KEY=${GOOGLE_API_KEY} \
    NEXT_PUBLIC_RE_CAPTCHA_KEY=${NEXT_PUBLIC_RE_CAPTCHA_KEY} \
    ZEABUR_URL=${ZEABUR_URL} \
    RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL} \
    VERCEL_URL=${VERCEL_URL} \
    RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL} \
    SHA_256_HASH=${SHA_256_HASH} \
    RESEND_API_KEY=${RESEND_API_KEY}

RUN apk update && \
    apk add --no-cache \
    libc6-compat && \
    corepack enable && \
    pnpm i && \
    pnpm turbo run build --filter=www... && \
    pnpm turbo run next-sitemap --filter=www

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

COPY --from=installer /app/apps/www/next.config.mjs .
COPY --from=installer /app/apps/www/package.json .
COPY --from=installer /app/apps/www/public ./apps/www/public

COPY --from=installer --chown=nextjs:nodejs /app/apps/www/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/www/.next/static ./apps/www/.next/static

ARG GH_PUBLIC_TOKEN \
    GOOGLE_API_KEY \
    SPOTIFY_CLIENT_ID \
    SPOTIFY_CLIENT_SECRET \
    ZEABUR_URL \
    SENDGRID_KEY \
    RAILWAY_STATIC_URL \
    RE_CAPTCHA_KEY \
    SHA_256_HASH \
    RE_CAPTCHA_KEY \
    VERCEL_URL \
    RESEND_API_KEY

ENV GH_PUBLIC_TOKEN=${GH_PUBLIC_TOKEN} \
    GOOGLE_API_KEY=${GOOGLE_API_KEY} \
    SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID} \
    SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET} \
    ZEABUR_URL=${ZEABUR_URL} \
    SENDGRID_KEY=${SENDGRID_KEY} \
    RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL} \
    RE_CAPTCHA_KEY=${RE_CAPTCHA_KEY} \
    SHA_256_HASH=${SHA_256_HASH} \
    VERCEL_URL=${VERCEL_URL} \
    RESEND_API_KEY=${RESEND_API_KEY} \
    PORT=8080 \
    NODE_ENV=production \
    HOST=0.0.0.0

EXPOSE 8080

CMD node apps/www/server.js
