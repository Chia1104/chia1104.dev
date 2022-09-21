FROM node:16-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./

RUN yarn global add pnpm && \
    pnpm add sharp

FROM node:16-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_KEY
ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
ARG NEXT_PUBLIC_AUTH_DOMAIN
ENV NEXT_PUBLIC_AUTH_DOMAIN=${NEXT_PUBLIC_AUTH_DOMAIN}
ARG NEXT_PUBLIC_PROJECT_ID
ENV NEXT_PUBLIC_PROJECT_ID=${NEXT_PUBLIC_PROJECT_ID}
ARG NEXT_PUBLIC_STORAGE_BUCKET
ENV NEXT_PUBLIC_STORAGE_BUCKET=${NEXT_PUBLIC_STORAGE_BUCKET}
ARG NEXT_PUBLIC_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_MESSAGING_SENDER_ID=${NEXT_PUBLIC_MESSAGING_SENDER_ID}
ARG NEXT_PUBLIC_APP_ID
ENV NEXT_PUBLIC_APP_ID=${NEXT_PUBLIC_APP_ID}
ARG NEXT_PUBLIC_MEASUREMENT_ID
ENV NEXT_PUBLIC_MEASUREMENT_ID=${NEXT_PUBLIC_MEASUREMENT_ID}
ARG NEXT_PUBLIC_FORMSPREE_KEY
ENV NEXT_PUBLIC_FORMSPREE_KEY=${NEXT_PUBLIC_FORMSPREE_KEY}
ARG GH_PUBLIC_TOKEN
ENV GH_PUBLIC_TOKEN=${GH_PUBLIC_TOKEN}
ARG NEXT_PUBLIC_RE_CAPTCHA_KEY
ENV NEXT_PUBLIC_RE_CAPTCHA_KEY=${NEXT_PUBLIC_RE_CAPTCHA_KEY}
ARG GOOGLE_API_KEY
ENV GOOGLE_API_KEY=${GOOGLE_API_KEY}
ARG SPOTIFY_CLIENT_ID
ENV SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
ARG SPOTIFY_CLIENT_SECRET
ENV SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN yarn prisma generate
RUN yarn build

FROM node:16-alpine AS runner

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
