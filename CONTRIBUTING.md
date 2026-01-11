# Contributing to Resonance

Thank you for your interest in contributing to Resonance! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for testing)
- Git

### Development Setup

1. **Clone the repository**

```bash
git clone https://github.com/jordojordo/resonance.git
cd resonance
```

2. **Set up Python environment**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

3. **Set up Node environment**

```bash
cd frontend
pnpm install
```

4. **Create config for development**

```bash
cp examples/config.yaml.example config.yaml
# Edit config.yaml with your test credentials
```

### Running Locally

**Backend (FastAPI):**

```bash
cd backend
uvicorn api.main:app --reload --port 8080
```

**Frontend (Vue):**

```bash
cd frontend
pnpm run dev
```

**Discovery scripts:**

```bash
cd backend
python -m discovery.lb_fetch
python -m discovery.catalog_discovery
python -m discovery.slskd_downloader
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
pnpm run test

# Linting
cd backend
ruff check .
mypy .

cd frontend
pnpm run lint
```

### Building Docker Image

```bash
docker build -t resonance:dev .
docker run -v ./config.yaml:/config/config.yaml -v ./data:/data -p 8080:8080 resonance:dev
```

## Project Structure

```
resonance/
├── backend/
│   ├── discovery/          # Discovery scripts
│   │   ├── lb_fetch.py
│   │   ├── catalog_discovery.py
│   │   ├── slskd_downloader.py
│   │   └── shared/         # Shared utilities
│   │
│   ├── api/                # FastAPI application
│   │   ├── main.py
│   │   ├── routers/        # API route handlers
│   │   ├── services/       # Business logic
│   │   └── models/         # Pydantic schemas
│   │
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Vue components
│   │   ├── views/          # Page components
│   │   ├── stores/         # Pinia stores
│   │   └── api/            # API client
│   │
│   └── package.json
│
├── s6-overlay/             # Process supervisor config
├── docs/                   # Documentation
├── examples/               # Example configs
└── Dockerfile
```

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

- [ ] Tests pass (`pytest` and `pnpm run test`)
- [ ] Linting passes (`ruff` and `pnpm run lint`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention
- [ ] PR description explains the change

## Development Guidelines

### Python (Backend)

- Use type hints everywhere
- Follow PEP 8 (enforced by ruff)
- Use async/await for I/O operations
- Write docstrings for public functions
- Keep functions small and focused

```python
async def get_pending_items(
    source: str | None = None,
    limit: int = 50
) -> list[QueueItem]:
    """
    Retrieve pending items from the queue.

    Args:
        source: Filter by source ('listenbrainz', 'catalog', or None for all)
        limit: Maximum items to return

    Returns:
        List of pending queue items
    """
    ...
```

### TypeScript/Vue (Frontend)

- Use Composition API with `<script setup>`
- Use TypeScript for type safety
- Keep components small and focused
- Use Pinia for state management

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQueueStore } from '@/stores/queue'

const store = useQueueStore()
const pending = computed(() => store.pendingItems)
</script>
```

### API Design

- Follow REST conventions
- Use meaningful HTTP status codes
- Return consistent error format
- Document with OpenAPI

### Testing

- Write unit tests for business logic
- Write integration tests for API endpoints
- Use fixtures for test data
- Mock external services

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

### Documentation

- Tutorials and guides
- Translation/localization
- Video walkthroughs
- Blog posts

## Questions?

- Open a [GitHub Discussion](https://github.com/jordojordo/resonance/discussions)
- Check existing issues for similar questions
- Read the [documentation](docs/)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to Resonance!
