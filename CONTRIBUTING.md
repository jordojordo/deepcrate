# Contributing to Resonance

Thank you for your interest in contributing to Resonance! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker (for testing)
- Git

### Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/jordonet/resonance.git
cd resonance
```

2. **Install backend dependencies (Node.js/TypeScript)**

```bash
cd backend
pnpm install
```

3. **Install frontend dependencies (Vue 3)**

```bash
cd ../frontend
pnpm install
```

4. **Create config for development**

```bash
cd ..
cp examples/config.yaml.example config.yaml
# Edit config.yaml with your test credentials
```

## Running Locally

### Backend (Express + background jobs)

```bash
cd backend
pnpm run dev    # Starts on http://localhost:8080 with hot reload
```

Resonance runs as a single Node.js process. Background jobs (lb-fetch, catalog-discovery, slskd-downloader) are scheduled via node-cron.

You can also trigger jobs via the API actions endpoints (useful for local testing):

```bash
curl -X POST http://localhost:8080/api/v1/actions/lb-fetch
curl -X POST http://localhost:8080/api/v1/actions/catalog
```

### Frontend (Vue 3)

```bash
cd frontend
pnpm run dev    # Starts on http://localhost:5173, proxies to backend
```

(When running both, leave the backend running in one terminal and the frontend in another.)

## Running Tests

Run tests from each workspace:

```bash
# Backend tests
cd backend
pnpm run test

# Frontend tests
cd ../frontend
pnpm run test
```

## Linting / Formatting / Typechecks

Script names can vary—use the repo's package.json as the source of truth—but these are the typical targets:

```bash
# Backend
cd backend
pnpm run lint
pnpm run typecheck

# Frontend
cd ../frontend
pnpm run lint
pnpm run typecheck
```

## Building and Running with Docker

```bash
docker build -t resonance:dev .
docker run -v ./config.yaml:/config/config.yaml -v ./data:/data -p 8080:8080 resonance:dev
```

## Project Structure

The backend is Node.js/TypeScript and the frontend is Vue 3. Local development is typically two processes (backend on :8080, frontend on :5173).

```
resonance/
├── backend/
│   ├── src/                  # Node.js/TypeScript server code (Express + jobs)
│   ├── tests/                # Backend tests
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Vue components
│   │   ├── views/             # Page components
│   │   ├── stores/            # Pinia stores
│   │   └── api/               # API client
│   └── package.json
│
├── s6-overlay/                # Process supervisor config
├── docs/                      # Documentation
├── examples/                  # Example configs
└── Dockerfile
```

### Data Directory

All state is stored in `/data` (mounted as a volume in Docker), including the SQLite DB and logs.

## Making Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add manual search endpoint
fix: handle empty wishlist gracefully
docs: update API documentation
refactor: extract queue service
```

### Pull Request Process

1. **Fork and branch** from `main`
2. **Make your changes** with tests
3. **Update documentation** if needed
4. **Run tests and linting**
5. **Submit PR** with clear description

### PR Checklist

- [ ] Backend tests pass (`pnpm -C backend run test`)
- [ ] Frontend tests pass (`pnpm -C frontend run test`)
- [ ] Linting passes (`pnpm -C backend run lint` and `pnpm -C frontend run lint`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] PR description explains the change

## Development Guidelines

### TypeScript/Node.js (Backend)

- Prefer small, single-purpose modules
- Use async/await for I/O
- Validate and sanitize external inputs at the edges (routes/controllers)
- Keep route handlers thin; move logic into services
- Add tests for bug fixes and new behavior

```ts
// Example: keep handlers thin and logic in services
import type { Request, Response } from "express";
import { approveQueueItems } from "../services/queue.js";

export async function approve(req: Request, res: Response) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await approveQueueItems(ids);
  res.json({ ok: true, ...result });
}
```

### TypeScript/Vue (Frontend)

- Use Composition API with `<script setup>`
- Use TypeScript for type safety
- Keep components small and focused
- Use Pinia for state management

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useQueueStore } from "@/stores/queue";

const store = useQueueStore();
const pending = computed(() => store.pendingItems);
</script>
```

### API Design

- Follow REST conventions
- Use meaningful HTTP status codes
- Return consistent error format
- Keep endpoints stable and documented

### Testing

- Write unit tests for business logic
- Write integration tests for API endpoints
- Use fixtures for test data
- Mock external services where appropriate

## Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue`:
- Documentation improvements
- UI polish
- Bug fixes
- Test coverage

### Feature Ideas

- Additional discovery sources (Spotify, Bandcamp)
- Notification integrations (Discord, Telegram)
- Download quality preferences
- Album deduplication against library
- Statistics and analytics dashboard

## Questions?

- Open a [GitHub Discussion](https://github.com/jordonet/resonance/discussions)
- Check existing issues for similar questions
- Read the [documentation](docs/)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to Resonance!
