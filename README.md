# Chia1104 Web Developer

This is my personal website.

## Languages and Tools

<div align="center">
  <a href="https://www.typescriptlang.org/" target="_blank" rel="noreferrer"> 
    <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" alt="typescript" width="40" height="40"/> 
  </a>
  <a href="https://nextjs.org/" target="_blank" rel="noreferrer"> 
    <img src="https://cdn.worldvectorlogo.com/logos/nextjs-2.svg" alt="nextjs" width="40" height="40"/> 
  </a> 
  <a href="https://tailwindcss.com/" target="_blank" rel="noreferrer"> 
    <img src="https://www.vectorlogo.zone/logos/tailwindcss/tailwindcss-icon.svg" alt="tailwind" width="40" height="40"/> 
  </a>
  <a href="https://redux.js.org" target="_blank" rel="noreferrer"> 
    <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/redux/redux-original.svg" alt="redux" width="40" height="40"/> 
  </a>
  <a href="https://firebase.google.com/" target="_blank" rel="noreferrer"> 
    <img src="https://www.vectorlogo.zone/logos/firebase/firebase-icon.svg" alt="firebase" width="40" height="40"/> 
  </a> 
  <a href="https://www.docker.com/" target="_blank" rel="noreferrer"> 
    <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/docker/docker-original-wordmark.svg" alt="docker" width="40" height="40"/> 
  </a>
</div>

## Features
- [X] Framer Motion (animation)
- [X] MDX Blog
- [ ] Algolia Search
- [ ] Firebase Authentication
- [ ] Dashboard
- [ ] CI/CD
- [ ] E2E Testing(with [Cypress](https://www.cypress.io/))
- [ ] Unit Testing(with [Jest](https://jestjs.io/))

## Deploy your own

Deploy the example using [Vercel](https://vercel.com?utm_source=github&utm_medium=readme&utm_campaign=next-example)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/Chia1104/chias-web-nextjs)

## Get Started

Generate the .env file, and add your own Firebase credentials, GitHub token, and Google API key.

```bash
$ cp .env.example .env
```

Runs the app in the development mode.

Open http://localhost:3000 to view it in your browser.

```bash
$ yarn
$ yarn dev
```

Builds the app for production to the `.next` folder.

```bash
$ yarn build
```

Build the docker image

```bash
$ docker build -t nextjs-portfolio-web:v1 .
$ docker run -p 8080:8080 nextjs-portfolio-web:v1
```
