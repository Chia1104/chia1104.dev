# Chia1104.dev

[![Vercel deployment](https://img.shields.io/github/deployments/chia1104/chia1104.dev/production?style=for-the-badge&logo=appveyor)](https://vercel.com/deployments/chia1104)
[![Next.js version](https://img.shields.io/github/package-json/dependency-version/chia1104/chia1104.dev/next/main/apps/www?style=for-the-badge&logo=appveyor)](https://nextjs.org/)
[![Licensed under MIT](https://img.shields.io/github/license/chia1104/chia1104.dev?style=for-the-badge&logo=appveyor)](LICENSE)
[![GitHub repo size](https://img.shields.io/github/repo-size/chia1104/chia1104.dev?style=for-the-badge&logo=appveyor)](https://github.com/chia1104/chias-web-nextjs)

This is my personal website, a monorepo managed using Turborepo. The development is based on the app structure of NextJS, with the use of TailwindCSS and Typescript. For backend functionalities, PostgreSQL and Redis are utilized to store articles and limit API traffic.

Finally, the website is deployed to the Zeabur platform using Docker, and GitHub Actions are used for integration testing.

## 🔨 Languages and Tools

![typescript](https://img.shields.io/badge/-Typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![nextjs](https://img.shields.io/badge/-NextJS-000000?style=for-the-badge&logo=next.js&logoColor=white)
![turborepo](https://img.shields.io/badge/-Turborepo-FF0080?style=for-the-badge&logo=turborepo&logoColor=white)
![tailwindcss](https://img.shields.io/badge/-TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![framer-motion](https://img.shields.io/badge/-Framer%20Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![vitest](https://img.shields.io/badge/-Vitest-2C7A7B?style=for-the-badge&logo=vite&logoColor=white)
![docker](https://img.shields.io/badge/-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![redis](https://img.shields.io/badge/-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![postgresql](https://img.shields.io/badge/-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

## 🌐 Deployments

- [Vercel](https://chia1104.vercel.app/)
- [Zeabur](https://chia1104.zeabur.app/)
- [Railway](https://chia1104.up.railway.app/)

## 🚀 Deploy your own

WIP

## 🏗️ Project Structure

```
chia1104.dev
├── apps
│   ├── dash (WIP)
│   └── www (NextJS)
├── packages
│   ├── ui (shared components)
│   └── db (WIP)
├── shared
│   ├── tailwind-config (tailwind config)
│   └── tsconfig (base, nextjs, react)
└── tests (WIP)
```

## 🎉 Get Started

You can run the following commands to initialize the project.

```bash
make init
```

Runs the app in the development mode.

Open http://localhost:3000 to view it in your browser.

```bash
pnpm dev --filter www...
```

Testing the app.

```bash
pnpm test
```

Build the docker image

```bash
docker build -f ./apps/www/Dockerfile -t web:v2 .
docker run -p 8080:8080 web:v2
```
