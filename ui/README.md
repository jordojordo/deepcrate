# DeepCrate UI

Modern web UI for managing music discovery queue, built with Vue 3 and PrimeVue.

## Tech Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development
- **PrimeVue 4** - Comprehensive UI component library
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **Vite** - Fast build tool and dev server
- **Axios** - HTTP client for API requests

## Directory Structure

```
src/
├── assets/styles/      # Theme preset and global styles
│   ├── theme.ts        # Custom DeepCrate PrimeVue theme preset
│   └── index.css       # Global CSS and utility classes
├── components/         # Reusable Vue components
│   ├── common/         # Shared components (LoadingSpinner, StatsCard)
│   ├── layout/         # Layout components (AppLayout, AppHeader, AppNav)
│   └── queue/          # Queue-specific components (QueueFilters, QueueList)
├── composables/        # Vue composables for reusable logic
│   ├── useAuth.ts      # Authentication composable
│   ├── useQueue.ts     # Queue management composable
│   ├── useStats.ts     # Dashboard statistics composable
│   └── useToast.ts     # Toast notifications composable
├── constants/          # Static constants
│   ├── queue.ts        # Queue-related constants
│   └── routes.ts       # Route paths and names
├── pages/              # Page components
│   ├── private/        # Authenticated pages (DashboardPage, QueuePage)
│   └── public/         # Public pages (LoginPage)
├── router/             # Vue Router configuration
├── services/           # API clients
│   ├── api.ts          # Base Axios client with auth interceptor
│   └── queue.ts        # Queue API endpoints
├── stores/             # Pinia state management
│   ├── auth.ts         # Authentication state
│   └── queue.ts        # Queue state
├── types/              # TypeScript type definitions
│   ├── api.ts          # API-related types
│   ├── auth.ts         # Authentication types
│   ├── queue.ts        # Queue item types
│   └── index.ts        # Barrel export
└── utils/              # Utility functions
    ├── formatters.ts   # Data formatting utilities
    └── validation.ts   # Validation utilities
```

## Development

### Prerequisites

- Node.js 24+ and pnpm 10+

### Setup

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:5173)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

### Path Alias

The `@/` alias maps to `./src/` for cleaner imports:

```typescript
import { useQueue } from '@/composables/useQueue'
import type { QueueItem } from '@/types'
```

## Theme Customization

The DeepCrate theme is defined in `src/assets/styles/theme.ts` using PrimeVue's preset system.

### Custom Colors

- **Primary**: Indigo scale (50-950) matching the original Tailwind design
- **Purple**: Custom purple scale for gradients and accents
- **Dark Mode**: Optimized surface colors with gray-800 as main background

### Modifying the Theme

Edit `src/assets/styles/theme.ts`:

```typescript
export const DeepCratePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef2ff',   // Lightest indigo
      500: '#6366f1',  // Main indigo
      // ... customize other shades
    },
    // Add custom color scales
    myCustomColor: {
      500: '#ff0000',
    }
  }
})
```

### Utility Classes

Global utility classes are defined in `src/assets/styles/index.css`:

- Flexbox: `flex`, `flex-column`, `align-items-center`, `justify-content-between`
- Spacing: `gap-2`, `gap-3`, `gap-4`, `mb-4`, `mt-6`, `px-4`, `py-5`
- Text: `text-sm`, `text-lg`, `text-xl`, `font-medium`, `font-bold`
- Layout: `max-w-7xl`, `mx-auto`, `min-h-screen`
- Borders: `border-round`, `border-bottom-1`
- Custom: `bg-gradient` (indigo to purple gradient)

## Component Patterns

### Using Composables

Page components should use composables instead of directly accessing stores:

```typescript
import { useQueue } from '@/composables/useQueue'

const { items, loading, fetchPending, approveItems } = useQueue()
```

### PrimeVue Components

Common PrimeVue components used throughout:

- **DataTable** - Queue list with row selection
- **Card** - Container component for stats and forms
- **Button** - Actions and navigation
- **InputText** - Text input fields
- **Password** - Password input with toggle mask
- **Select** - Dropdown filters
- **Message** - Error and info messages
- **Toast** - Notification toasts
- **ProgressSpinner** - Loading indicators

### Theme Variables

Use PrimeVue theme CSS variables instead of hardcoded colors:

```css
.my-component {
  color: var(--text-color);           /* Primary text */
  background: var(--surface-card);     /* Card background */
  border-color: var(--surface-border); /* Border color */
}
```

Common theme variables:
- `--text-color` - Primary text color
- `--text-color-secondary` - Muted/secondary text
- `--surface-ground` - Page background
- `--surface-card` - Card/panel background
- `--surface-border` - Border color
- `--primary-color` - Primary brand color

## API Integration

API calls are centralized in the `services/` directory:

```typescript
// services/queue.ts
export async function getPending(filters: QueueFilters) {
  const response = await client.get('/queue/pending', { params })
  return response.data
}
```

The base client (`services/api.ts`) automatically:
- Adds Basic Auth header from localStorage
- Handles API base URL configuration
- Provides consistent error handling

## State Management

### Stores (Pinia)

Stores are the single source of truth for state:

```typescript
// stores/queue.ts
export const useQueueStore = defineStore('queue', () => {
  const items = ref<QueueItem[]>([])
  const loading = ref(false)

  async function fetchPending() {
    loading.value = true
    const response = await queueApi.getPending(filters.value)
    items.value = response.items
    loading.value = false
  }

  return { items, loading, fetchPending }
})
```

### Composables

Composables wrap stores for convenient access without duplicating state:

```typescript
// composables/useQueue.ts
export function useQueue() {
  const store = useQueueStore()

  return {
    items: computed(() => store.items),
    loading: computed(() => store.loading),
    fetchPending: (append = false) => store.fetchPending(append),
  }
}
```

## Type Safety

All types are organized by feature in `src/types/`:

```typescript
// types/queue.ts
export interface QueueItem {
  artist: string
  album?: string
  mbid: string
  type: 'album' | 'track'
  source: 'listenbrainz' | 'catalog'
  score?: number
  added_at: string
  cover_url?: string
}

export interface QueueFilters {
  source: 'all' | 'listenbrainz' | 'catalog'
  sort: 'added_at' | 'score' | 'artist' | 'year'
  order: 'asc' | 'desc'
  limit: number
  offset: number
}
```

Use barrel exports for clean imports:

```typescript
import type { QueueItem, QueueFilters, PaginatedResponse } from '@/types'
```

## Contributing

When adding new features:

1. Use composables for reusable logic
2. Add types to appropriate feature file in `types/`
3. Use PrimeVue components instead of custom HTML/CSS
4. Follow Vue 3 Composition API with `<script setup>`
5. Use theme variables instead of hardcoded colors
6. Keep stores as source of truth, composables as wrappers
7. Use `@/` path alias for all imports
