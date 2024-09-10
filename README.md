# Chia1104.dev

[![www deployment](https://img.shields.io/github/deployments/chia1104/chia1104.dev/Production%20%E2%80%93%20chia1104?style=for-the-badge&logo=vercel&label=www)](https://chia1104.dev)
[![Next.js version](https://img.shields.io/github/package-json/dependency-version/chia1104/chia1104.dev/next/main/apps/www?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![Licensed under MIT](https://img.shields.io/github/license/chia1104/chia1104.dev?style=for-the-badge&logo=unlicense)](LICENSE)
[![GitHub repo size](https://img.shields.io/github/repo-size/chia1104/chia1104.dev?style=for-the-badge&logo=turborepo)](https://github.com/chia1104/chia1104.dev)

> The project is still under development.

This is my personal website, developed using Next.js for both the front-end and back-end, with Hono as the back-end service. All projects are managed using Turborepo.

## ✨ Features

- 🚀 Next.js 14 with App Router
- 🔥 Hono - backend services
- 📦 Monorepo - using [Turborepo](https://turbo.build/)
- 📄 MDX - using [Fumadocs](https://fumadocs.vercel.app/) for MDX components
- 📝 CMS - custom CMS for managing content
- 🎨 Tailwind CSS styles
- 🧪 Vitest - unit tests
- 🎭 Playwright - end-to-end tests
- ✍️ Husky & Lint Staged - format code before committing
- 🔒 Auth.js - authorization
- 🌧️ Drizzle - ORM
- 🗄️ Redis - for caching
- 🧠 PG vector search - AI vector search (WIP)
- ✏️ AI editor - for text generation (WIP)

## 🔨 Languages and Tools

![typescript](https://img.shields.io/badge/-Typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![nextjs](https://img.shields.io/badge/-NextJS-000000?style=for-the-badge&logo=next.js&logoColor=white)
![hono](https://img.shields.io/badge/-Hono-FF0080?style=for-the-badge&logo=hono&logoColor=white)
![turborepo](https://img.shields.io/badge/-Turborepo-FF0080?style=for-the-badge&logo=turborepo&logoColor=white)
![tailwindcss](https://img.shields.io/badge/-TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![framer-motion](https://img.shields.io/badge/-Framer%20Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![vitest](https://img.shields.io/badge/-Vitest-2C7A7B?style=for-the-badge&logo=vite&logoColor=white)
![playwright](https://img.shields.io/badge/-Playwright-4A154B?style=for-the-badge&logo=playwright&logoColor=white)
![docker](https://img.shields.io/badge/-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![redis](https://img.shields.io/badge/-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![postgresql](https://img.shields.io/badge/-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

## 🚀 Deploy your own

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChia1104%2Fchia1104.dev)

- Create a new project on Vercel, select the `apps/www` (or `apps/dash`) folder as the root directory:

![Vercel build settings](./.github/public/vercel-deploy2.png)

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/QTqT7m?referralCode=HYbEt0)

- Overwrite the `railway.json` file with the following content (recommended):

![Railway environment variables](./.github/public/railway-deploy2.png)

- or add the following environment variables:

![Railway environment variables](./.github/public/railway-deploy.png)

### Zeabur

you can deploy `www`, `dash` and `service` applications to Zeabur, and make sure that the services name are `www`, `dash` and `service` respectively.

![Zeabur build settings](./.github/public/zeabur-deploy.png)

## 🏗️ Project Structure

```bash
chia1104.dev
├── apps
│   ├── service (Hono)
│   ├── dash (NextJS)
│   └── www (NextJS)
├── packages
|   ├── ai (AI vector search / text generation)
│   ├── api (tRPC API)
│   ├── auth (AuthJS)
│   ├── cache (Redis cache)
│   ├── contents (MDX functionality)
│   ├── db (Drizzle orm)
│   ├── tailwind (tailwind config and css files)
│   ├── ui (shared components)
│   └── utils (shared utilities)
└── tests
    └── www-e2e (playwright e2e tests)
```

## 🎉 Get Started

You can run the following commands to initialize the project.

```bash
make init
```

Runs the app in the development mode.

Open <http://localhost:3000> to view it in your browser.

```bash
pnpm dev:www
```

Testing the app.

```bash
pnpm test && pnpm test:e2e
```

Build the docker image

```bash
docker build -f ./apps/www/Dockerfile -t www .
docker run -p 8080:8080 www
```
