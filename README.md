# Chia1104 Web Developer
[![Vercel deployment](https://img.shields.io/github/deployments/chia1104/chias-web-nextjs/production?style=for-the-badge&logo=appveyor)](https://vercel.com/deployments/chia1104)
[![Next.js version](https://img.shields.io/github/package-json/dependency-version/chia1104/chias-web-nextjs/next/main?style=for-the-badge&logo=appveyor)](https://nextjs.org/)
[![Licensed under MIT](https://img.shields.io/github/license/chia1104/chias-web-nextjs?style=for-the-badge&logo=appveyor)](LICENSE)
[![GitHub repo size](https://img.shields.io/github/repo-size/chia1104/chias-web-nextjs?style=for-the-badge&logo=appveyor)](https://github.com/chia1104/chias-web-nextjs)

This is my personal website.

Build with NextJS 13 `appDir` new feature.

## 🔨 Languages and Tools

<div align="center">
  <img src="https://skillicons.dev/icons?i=ts,tailwindcss,next,docker" />
</div>

## 🌐 Deployments

- [Vercel](https://chia1104.vercel.app/)
- [Zeabur](https://chia1104.zeabur.app/)

## ✨ Features
- [X] Framer Motion (animation)
- [X] MDX Blog
- [X] [Vitest](https://vitest.dev/) Unit Testing
- [X] [Cypress](https://www.cypress.io/) E2E Testing

## 🌐 Deploy your own

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=next-example)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/Chia1104/chias-web-nextjs)

## 🎉 Get Started

Generate the `.env` file and fill in the values.

```bash
cp .env.example .env
```

Install the dependencies and enable the `husky`.

```bash
pnpm install
pnpm husky install
```

Runs the app in the development mode.

Open http://localhost:3000 to view it in your browser.

```bash
pnpm dev
```

Testing the app.

```bash
pnpm test:vitest # <-- test with vitest
```

Builds the app for production to the `.next` folder.

```bash
pnpm build
```

Build the docker image

```bash
docker build -t nextjs-portfolio-web:v1 .
docker run -p 8080:8080 nextjs-portfolio-web:v1
```
