FROM node:18-alpine AS deps

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN apk add --no-cache libc6-compat &&  \
    yarn global add pnpm && \
    pnpm i

FROM node:18-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_ENV

ENV BUILD_ENV=${BUILD_ENV}

RUN yarn build

FROM node:18-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# ISSUE: https://github.com/vercel/next.js/issues/48077
COPY --from=deps /app/node_modules/next/dist/compiled/jest-worker ./node_modules/next/dist/compiled/jest-worker

USER nextjs

ARG RUNTIME_ENV

ENV RUNTIME_ENV=${RUNTIME_ENV} \
    PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
