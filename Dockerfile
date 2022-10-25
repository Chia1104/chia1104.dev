FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN apk update

WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./

RUN yarn global add pnpm && \
    pnpm add sharp

FROM node:18-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN apk update

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG \
  NEXT_PUBLIC_API_KEY \
  NEXT_PUBLIC_AUTH_DOMAIN \
  NEXT_PUBLIC_PROJECT_ID \
  NEXT_PUBLIC_STORAGE_BUCKET \
  NEXT_PUBLIC_MESSAGING_SENDER_ID \
  NEXT_PUBLIC_APP_ID \
  NEXT_PUBLIC_MEASUREMENT_ID \
  NEXT_PUBLIC_FORMSPREE_KEY \
  GH_PUBLIC_TOKEN \
  NEXT_PUBLIC_RE_CAPTCHA_KEY \
  GOOGLE_API_KEY \
  SPOTIFY_CLIENT_ID \
  SPOTIFY_CLIENT_SECRET \
  DATABASE_URL

ENV \
  NODE_ENV=production \
  NEXT_PUBLIC_API_KEY=$NEXT_PUBLIC_API_KEY \
  NEXT_PUBLIC_AUTH_DOMAIN=$NEXT_PUBLIC_AUTH_DOMAIN \
  NEXT_PUBLIC_PROJECT_ID=$NEXT_PUBLIC_PROJECT_ID \
  NEXT_PUBLIC_STORAGE_BUCKET=$NEXT_PUBLIC_STORAGE_BUCKET \
  NEXT_PUBLIC_MESSAGING_SENDER_ID=$NEXT_PUBLIC_MESSAGING_SENDER_ID \
  NEXT_PUBLIC_APP_ID=$NEXT_PUBLIC_APP_ID \
  NEXT_PUBLIC_MEASUREMENT_ID=$NEXT_PUBLIC_MEASUREMENT_ID \
  NEXT_PUBLIC_FORMSPREE_KEY=$NEXT_PUBLIC_FORMSPREE_KEY \
  GH_PUBLIC_TOKEN=$GH_PUBLIC_TOKEN \
  NEXT_PUBLIC_RE_CAPTCHA_KEY=$NEXT_PUBLIC_RE_CAPTCHA_KEY \
  GOOGLE_API_KEY=$GOOGLE_API_KEY \
  SPOTIFY_CLIENT_ID=$SPOTIFY_CLIENT_ID \
  SPOTIFY_CLIENT_SECRET=$SPOTIFY_CLIENT_SECRET \
  DATABASE_URL=$DATABASE_URL

RUN yarn prisma generate
RUN yarn build

FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENV PORT 8080

CMD ["node", "server.js"]
