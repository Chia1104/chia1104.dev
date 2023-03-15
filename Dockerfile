FROM node:18-alpine AS deps

WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./

RUN apk add --no-cache libc6-compat &&  \
    yarn global add pnpm && \
    pnpm i

FROM node:18-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG \
    GH_PUBLIC_TOKEN \
    GOOGLE_API_KEY \
    NEXT_PUBLIC_RE_CAPTCHA_KEY \
    ZEABUR_URL \
    RAILWAY_STATIC_URL

ENV \
    GH_PUBLIC_TOKEN=${GH_PUBLIC_TOKEN} \
    GOOGLE_API_KEY=${GOOGLE_API_KEY} \
    NEXT_PUBLIC_RE_CAPTCHA_KEY=${NEXT_PUBLIC_RE_CAPTCHA_KEY} \
    ZEABUR_URL=${ZEABUR_URL} \
    RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL}

RUN yarn build

FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

ARG \
    GH_PUBLIC_TOKEN \
    GOOGLE_API_KEY \
    SPOTIFY_CLIENT_ID \
    SPOTIFY_CLIENT_SECRET \
    ZEABUR_URL \
    SENDGRID_KEY \
    RAILWAY_STATIC_URL

ENV \
    GH_PUBLIC_TOKEN=${GH_PUBLIC_TOKEN} \
    GOOGLE_API_KEY=${GOOGLE_API_KEY} \
    SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID} \
    SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET} \
    ZEABUR_URL=${ZEABUR_URL} \
    SENDGRID_KEY=${SENDGRID_KEY} \
    RAILWAY_STATIC_URL=${RAILWAY_STATIC_URL}

USER nextjs

EXPOSE 8080

ENV PORT 8080

CMD ["node", "server.js"]
