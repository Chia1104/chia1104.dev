# Chia1104.dev

[![www deployment](https://img.shields.io/github/deployments/chia1104/chia1104.dev/Production%20%E2%80%93%20chia1104?style=for-the-badge&logo=vercel&label=www)](https://chia1104.dev)
[![Next.js version](https://img.shields.io/github/package-json/dependency-version/chia1104/chia1104.dev/next/main/apps/www?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![Licensed under MIT](https://img.shields.io/github/license/chia1104/chia1104.dev?style=for-the-badge&logo=unlicense)](LICENSE)
[![GitHub repo size](https://img.shields.io/github/repo-size/chia1104/chia1104.dev?style=for-the-badge&logo=turborepo)](https://github.com/chia1104/chia1104.dev)

> This project is actively under development.

A modern full-stack personal website and content management system built with Next.js and Hono, featuring a monorepo architecture powered by Turborepo.

## 📑 Table of Contents

- [✨ Features](#-features)
- [🔨 Tech Stack](#-tech-stack)
- [🚀 Deploy your own](#-deploy-your-own)
- [🏗️ Project Structure](#️-project-structure)
- [🎉 Getting Started](#-getting-started)
- [📚 Key Technologies](#-key-technologies)
- [🏛️ Architecture](#️-architecture)
- [🌍 Environment Variables](#-environment-variables)
- [🚨 Troubleshooting](#-troubleshooting)
- [❓ FAQ](#-faq)
- [⚡ Performance & Scaling](#-performance--scaling)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)
- [👤 Author](#-author)

## ✨ Features

### Frontend

- 🚀 **Next.js 16** with App Router and React 19
- 🎨 **Tailwind CSS 4** for styling
- 🎭 **Framer Motion** for animations
- 🌐 **next-intl** for internationalization
- 🎯 **HeroUI** - Modern React component library
- 📊 **Vercel Analytics & Speed Insights**

### Backend

- 🔥 **Hono** - Fast, lightweight backend service
- 🔐 **Better Auth** - Modern authentication solution
- 🌧️ **Drizzle ORM** - Type-safe database operations
- 🗄️ **PostgreSQL** - Primary database
- 💾 **Redis/Upstash** - Caching and rate limiting
- 📨 **Resend** - Email delivery

### Content & AI

- 📄 **MDX** with [Fumadocs](https://fumadocs.vercel.app/) for rich content
- 📝 **Custom CMS** for content management
- 🧠 **AI Integration** - Vector search and text generation
- ⚡ **Trigger.dev** - Background jobs and scheduled tasks
- 🤖 **OpenAI & Ollama** support

### Developer Experience

- 📦 **Turborepo** - High-performance monorepo build system
- 🧪 **Vitest** - Fast unit testing
- 🎭 **Playwright** - End-to-end testing
- ✍️ **Husky & Lint Staged** - Pre-commit hooks
- 🔍 **ESLint 9** - Code linting
- 📐 **TypeScript 5.9** - Type safety
- 🐳 **Docker** - Containerization support

## 🔨 Tech Stack

![typescript](https://img.shields.io/badge/-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![nextjs](https://img.shields.io/badge/-Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![react](https://img.shields.io/badge/-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![hono](https://img.shields.io/badge/-Hono-FF6600?style=for-the-badge&logo=hono&logoColor=white)
![turborepo](https://img.shields.io/badge/-Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)
![tailwindcss](https://img.shields.io/badge/-Tailwind_CSS_4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![framer-motion](https://img.shields.io/badge/-Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![vitest](https://img.shields.io/badge/-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![playwright](https://img.shields.io/badge/-Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![docker](https://img.shields.io/badge/-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![postgresql](https://img.shields.io/badge/-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![redis](https://img.shields.io/badge/-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![trpc](https://img.shields.io/badge/-tRPC-2596BE?style=for-the-badge&logo=trpc&logoColor=white)

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
chia1104.dev/
├── apps/
│   ├── www/              # Main website (Next.js 16)
│   ├── dash/             # Admin dashboard (Next.js 16)
│   ├── service/          # Backend API service (Hono)
│   ├── trigger/          # Background jobs (Trigger.dev)
│   ├── gateway/          # Nginx gateway configuration
│   └── image-resize/     # Image processing service (Go)
├── packages/
│   ├── ai/               # AI integrations (OpenAI, Ollama)
│   ├── api/              # tRPC API routes and external API clients
│   ├── auth/             # Better Auth configuration
│   ├── contents/         # MDX content management
│   ├── db/               # Drizzle ORM schemas and migrations
│   ├── kv/               # Redis/Upstash key-value store
│   ├── meta/             # Project metadata
│   ├── tailwind/         # Tailwind CSS configuration
│   ├── ui/               # Shared React components
│   └── utils/            # Shared utilities
├── tests/
│   └── www-e2e/          # Playwright end-to-end tests
└── toolings/
    ├── eslint/           # ESLint configuration
    ├── tsconfig/         # TypeScript configurations
    ├── vitest/           # Vitest test configurations
    └── scripts/          # Build and deployment scripts
```

## 🎉 Getting Started

### Prerequisites

- **Node.js** >= 22.0.0 ([Download](https://nodejs.org/))
- **pnpm** 10.26.0 or higher ([Install](https://pnpm.io/installation))
  ```bash
  npm install -g pnpm@10.26.0
  ```
- **Git** - For version control
- **Docker** & **Docker Compose** (optional, for local database)
  - Used for running PostgreSQL and Redis locally
  - Can be replaced with cloud services (Supabase, Upstash, etc.)
- **PostgreSQL** 14+ - Database server
  - Local installation OR
  - Docker container OR
  - Cloud provider (Supabase, Neon, PlanetScale)
- **Redis** 6+ (optional, but recommended for caching)
  - Local installation OR
  - Docker container OR
  - Upstash Redis

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features
- **PostgreSQL Client** - TablePlus, pgAdmin, or Drizzle Studio
- **API Testing** - Postman, Insomnia, or Thunder Client

### Installation

Clone the repository:

```bash
git clone https://github.com/chia1104/chia1104.dev.git
cd chia1104.dev
```

Install dependencies:

```bash
pnpm install
```

Set up environment variables - create `.env` files in the respective app directories (`apps/www`, `apps/dash`, `apps/service`) based on the `.env.example` files.

Initialize the database:

```bash
# Start PostgreSQL and Redis with Docker
pnpm db:up

# Generate Drizzle migrations (if schema changed)
pnpm db:generate

# Run database migrations
pnpm db:migrate

# (Optional) Seed the database with sample data
pnpm db:seed

# Open Drizzle Studio to view/edit data
pnpm db:studio
```

**Database Management:**

```bash
# Pull schema from existing database
pnpm db:pull

# Push schema to database (development only)
pnpm db:push

# Initialize database with tables
pnpm db:init
```

### API Documentation

The project exposes several API endpoints:

**tRPC API (Type-safe):**
- Base URL: `http://localhost:3000/api/trpc` (from www)
- Base URL: `http://localhost:3001/api/trpc` (from dash)
- Interactive API Explorer available in development mode

**REST API (Hono Service):**
- Base URL: `http://localhost:8080`
- Endpoints:
  - `GET /health` - Health check
  - `POST /api/auth/*` - Authentication endpoints
  - `GET /api/posts` - Fetch posts
  - `POST /api/posts` - Create post (authenticated)
  - More endpoints documented in `apps/service/src/routes`

**API Testing:**
```bash
# Health check
curl http://localhost:8080/health

# Fetch posts
curl http://localhost:3000/api/posts
```

For detailed API documentation, check the source code in:
- `packages/api/src` - tRPC procedures
- `apps/service/src/routes` - REST endpoints

### Development

**Run all applications:**

```bash
pnpm dev
```

**Run specific applications:**

```bash
# Main website (localhost:3000)
pnpm dev:www

# Dashboard (localhost:3001)
pnpm dev:dash

# Backend service
pnpm dev:service
```

### Testing

**Run unit tests:**
```bash
# Run all unit tests
pnpm test

# Run tests in watch mode for development
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Run tests for specific package/app
pnpm test:service
```

**Run end-to-end tests:**
```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
pnpm test:e2e

# Run E2E tests in UI mode
npx playwright test --ui

# Run E2E tests for specific browser
npx playwright test --project=chromium
```

**Generate coverage report:**
```bash
# Generate and view coverage
pnpm test:cov

# Coverage reports are saved to coverage/
# Open coverage/index.html to view detailed report
```

**Testing Best Practices:**
- Write tests alongside your code
- Aim for >80% coverage for critical paths
- Use meaningful test descriptions
- Mock external dependencies
- Test edge cases and error scenarios

### Building

```bash
# Build all applications
pnpm build

# Build specific applications
pnpm build:www
pnpm build:dash
pnpm build:service
```

### Docker Deployment

```bash
# Build Docker images
docker build -f Dockerfile.www -t chia1104-www .
docker build -f Dockerfile.dash -t chia1104-dash .
docker build -f Dockerfile.service -t chia1104-service .

# Run containers
docker run -p 3000:3000 chia1104-www
docker run -p 3001:3001 chia1104-dash
docker run -p 8080:8080 chia1104-service
```

### Useful Commands

```bash
# Lint code
pnpm lint

# Format code
pnpm format

# Type check
pnpm type:check

# Database studio
pnpm db:studio

# Clean workspace
pnpm clean:workspaces
```

## 📚 Key Technologies

### Authentication

- **Better Auth** - Modern, type-safe authentication library
- Email/password authentication
- OAuth providers support
- Session management with Redis

### Database & ORM

- **Drizzle ORM** - Lightweight TypeScript ORM
- **PostgreSQL** - Relational database
- Type-safe queries and migrations
- Database connection pooling

### API Layer

- **tRPC** - End-to-end typesafe APIs
- **Hono** - Ultrafast web framework
- Type inference from server to client
- Built-in validation with Zod

### UI Components

- **HeroUI** - Modern React component library
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion** - Animation library
- Custom design system

### Content Management

- **Fumadocs** - Documentation framework
- **MDX** - Markdown with JSX
- Syntax highlighting with Shiki
- Math equations with KaTeX

### Background Jobs

- **Trigger.dev** - Background job processing
- Scheduled tasks
- AI-powered content processing
- Email notifications

## 🏛️ Architecture

This project follows a microservices-inspired monorepo architecture:

### Frontend Architecture

- **Next.js App Router** - Server-side rendering and static generation
- **React Server Components** - Improved performance with server-side data fetching
- **Client Components** - Interactive UI elements with minimal JavaScript
- **tRPC** - Type-safe API communication between frontend and backend

### Backend Architecture

- **Hono Service** - Lightweight, fast API gateway
- **Drizzle ORM** - Database abstraction layer with type safety
- **Better Auth** - Authentication middleware
- **Redis/Upstash** - Session storage and caching layer
- **PostgreSQL** - Primary data store

### Data Flow

```
User Request → Next.js (SSR/SSG) → tRPC → Hono Service → Database/Cache
                ↓                                            ↓
            React Server Components ← API Response ← Business Logic
```

### Monorepo Structure

The project uses **Turborepo** for build orchestration and **pnpm workspaces** for dependency management. This allows:

- Shared code between applications
- Efficient caching and incremental builds
- Independent deployment of services
- Type sharing across the entire stack

## 🌍 Environment Variables

Each application requires specific environment variables. Below are the key variables needed:

### Common Variables (All Apps)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DATABASE_AUTH_TOKEN= # For some providers

# Redis/Upstash (Optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### www & dash (Frontend Apps)

```bash
# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API Endpoints
NEXT_PUBLIC_API_URL=http://localhost:8080

# Authentication (Better Auth)
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000

# Analytics (Optional)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
```

### service (Backend API)

```bash
# Server Configuration
PORT=8080
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Email (Resend)
RESEND_API_KEY=

# AI Services (Optional)
OPENAI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
```

### trigger (Background Jobs)

```bash
# Trigger.dev
TRIGGER_API_KEY=
TRIGGER_API_URL=https://api.trigger.dev
```

For complete environment variable templates, check the `.env.example` files in each app directory.

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Build Failures

**Problem:** `pnpm build` fails with module resolution errors

```bash
# Solution: Clean and reinstall dependencies
pnpm clean:workspaces
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

```bash
# Check if database is running
docker ps | grep postgres

# Restart database containers
pnpm db:up

# Check connection string format
# Ensure DATABASE_URL is properly formatted:
# postgresql://username:password@host:port/database
```

#### Port Already in Use

**Problem:** Error: `EADDRINUSE: address already in use :::3000`

```bash
# Find and kill process using the port (Unix/Mac)
lsof -ti:3000 | xargs kill -9

# On Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

#### TypeScript Errors After Update

**Problem:** Type errors after updating dependencies

```bash
# Rebuild TypeScript declarations
pnpm clean:workspaces
pnpm build
```

#### Slow Build Times

**Problem:** Builds take too long

```bash
# Enable Turborepo daemon for faster builds
pnpm dev:turbo

# Clear Turborepo cache if needed
rm -rf .turbo
```

#### Docker Build Issues

**Problem:** Docker image build fails

```bash
# Build with more verbose output
docker build --progress=plain -f Dockerfile.www -t chia1104-www .

# Clear Docker cache
docker builder prune
```

## ❓ FAQ

### General Questions

**Q: Can I use this project as a template for my own site?**

A: Yes! This project is MIT licensed. Fork it and customize it for your needs.

**Q: What's the minimum system requirements?**

A: Node.js 22+, 8GB RAM, and ~2GB disk space for dependencies.

**Q: Do I need all the services (PostgreSQL, Redis, etc.)?**

A: Redis is optional for caching. PostgreSQL is required for the core functionality.

### Development Questions

**Q: How do I add a new package to the monorepo?**

```bash
# Use turbo generator
pnpm turbo gen workspace

# Or manually create in packages/ directory
```

**Q: Can I use npm or yarn instead of pnpm?**

A: While possible, the project is optimized for pnpm. Using other package managers may cause issues with workspace linking.

**Q: How do I add a new API route?**

A: Add routes in `packages/api` for tRPC procedures or `apps/service` for REST endpoints.

**Q: How do I debug the application?**

```bash
# Use debug mode for specific apps
pnpm debug:build
pnpm debug:start

# Or use Chrome DevTools with Node.js inspector
node --inspect-brk ./apps/www/server.js
```

### Deployment Questions

**Q: Which platforms are recommended for deployment?**

A: 
- **Frontend (www/dash)**: Vercel, Netlify, or Cloudflare Pages
- **Backend (service)**: Railway, Render, or Fly.io
- **Database**: Supabase, Neon, or PlanetScale

**Q: How do I set up CI/CD?**

A: GitHub Actions workflows are provided in `.github/workflows/`. Configure your secrets in repository settings.

**Q: Can I deploy just one app instead of all?**

A: Yes! Use Turborepo filters:
```bash
pnpm build:www  # Build only www and its dependencies
```

## ⚡ Performance & Scaling

### Performance Optimizations

This project includes several built-in optimizations:

1. **Next.js App Router**
   - Automatic code splitting
   - Server Components for reduced JavaScript
   - Image optimization with next/image
   - Font optimization with next/font

2. **Caching Strategy**
   - Redis for session and data caching
   - HTTP caching headers
   - Static page generation where possible
   - Incremental Static Regeneration (ISR)

3. **Database Optimization**
   - Connection pooling with Drizzle
   - Indexed queries
   - Prepared statements

4. **Build Optimization**
   - Turborepo caching for faster rebuilds
   - Parallel builds with pnpm
   - Bundle analysis with @next/bundle-analyzer

### Scaling Considerations

#### Horizontal Scaling

- **Frontend**: Deploy multiple Next.js instances behind a load balancer
- **Backend**: Scale Hono service horizontally; it's stateless and scale-friendly
- **Database**: Use read replicas for read-heavy workloads
- **Redis**: Use Redis Cluster for high availability

#### Performance Monitoring

```bash
# Enable Vercel Analytics (Frontend)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-id

# Monitor bundle sizes
pnpm build:www -- --analyze
```

#### Load Testing

```bash
# Use k6 or Apache Bench for load testing
k6 run tests/load/api-test.js
```

### Recommended Limits

- **www/dash**: ~1000 req/sec per instance (depending on page complexity)
- **service**: ~5000 req/sec per instance (for API routes)
- **Database**: 100 concurrent connections (adjustable based on provider)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Getting Started with Contributions

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/chia1104.dev.git
   cd chia1104.dev
   ```

2. **Create your feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Make your changes**
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation as needed

5. **Test your changes**
   ```bash
   # Run linting
   pnpm lint
   
   # Run type checking
   pnpm type:check
   
   # Run tests
   pnpm test
   ```

6. **Commit your changes**
   ```bash
   # The project uses Husky for pre-commit hooks
   # This will automatically lint and format your code
   git add .
   git commit -m 'feat: add some amazing feature'
   ```

7. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```

8. **Open a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch and describe your changes

### Code Style Guidelines

- **TypeScript**: Use strict typing, avoid `any` when possible
- **Naming Conventions**: 
  - camelCase for variables and functions
  - PascalCase for components and types
  - UPPER_CASE for constants
- **File Structure**: Group related files together
- **Comments**: Write clear, concise comments for complex logic
- **Imports**: Use absolute imports from package aliases (e.g., `@chia/ui`)

### Commit Message Convention

This project follows the Conventional Commits specification:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat(www): add dark mode toggle to header`

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include relevant tests and documentation
- Ensure all CI checks pass
- Update the README if you're adding new features
- Reference any related issues

### Development Workflow

1. Always create a new branch from `develop`
2. Keep your branch up to date with `develop`
3. Write meaningful commit messages
4. Test thoroughly before pushing
5. Request review from maintainers

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

### Chia1104

- Website: <https://chia1104.dev>
- GitHub: [@chia1104](https://github.com/chia1104)
- Email: <yuyuchia7423@gmail.com>

## ⭐ Show your support

Give a ⭐️ if this project helped you!
