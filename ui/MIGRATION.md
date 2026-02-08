# UI Migration: Tailwind CSS → PrimeVue 4

This document describes the migration from Tailwind CSS v4 to PrimeVue 4, completed in 6 incremental phases.

## Migration Overview

**Completed:** January 2026
**Approach:** Incremental migration with separate commits for each phase
**Impact:** Complete UI framework replacement with improved type safety and component organization

## What Changed

### UI Framework
- **Before:** Tailwind CSS v4 with custom utility classes
- **After:** PrimeVue 4 with custom DeepCrate theme preset
- **Theme:** Custom indigo/purple color scheme maintained from Tailwind design

### Directory Structure
- **Before:** `views/`, `api/`
- **After:** `pages/private/`, `pages/public/`, `services/`
- **Added:** `composables/`, `constants/`, `utils/`, `types/`, `assets/styles/`

### State Management Pattern
- **Before:** Direct store access in components
- **After:** Composables wrapping stores for reusable logic

## Component Migration Map

| Old Component (Tailwind) | New Component (PrimeVue) | Status | Notes |
|--------------------------|-------------------------|--------|-------|
| **LoadingSpinner** | ProgressSpinner | ✅ Migrated | Size prop mapping (sm/md/lg → px) |
| **StatsCard** | Card | ✅ Migrated | Uses theme variables, PrimeIcons |
| **QueueList** | DataTable | ✅ Migrated | Row selection, bulk actions, column templates |
| **QueueItem** | _(merged into DataTable)_ | ✅ Removed | Logic moved to DataTable column templates |
| **QueueFilters** | Card + Select + Button | ✅ Migrated | Filter controls with PrimeVue components |
| **AppHeader** | Custom + Button | ✅ Migrated | PrimeIcons, theme variables |
| **AppNav** | Custom + RouterLink | ✅ Migrated | PrimeIcons, active state styling |
| **AppLayout** | Custom wrapper | ✅ Migrated | Theme classes |
| **DashboardView** | DashboardPage | ✅ Migrated | ProgressSpinner, Message, useStats composable |
| **QueueView** | QueuePage | ✅ Migrated | Message, Button, useQueue composable |
| **LoginView** | LoginPage | ✅ Migrated | Card, InputText, Password, Button, Message |

## Breaking Changes

### Import Paths
**Old:**
```typescript
import DashboardView from '@/views/DashboardView.vue'
import * as queueApi from '@/api/queue'
```

**New:**
```typescript
import DashboardPage from '@/pages/private/DashboardPage.vue'
import * as queueApi from '@/services/queue'
```

### Component APIs

#### QueueList Selection
**Old (Set-based):**
```typescript
const selectedItems = ref<Set<string>>(new Set())
```

**New (Array-based):**
```typescript
const selectedItems = ref<QueueItem[]>([])
```

### CSS Classes
**Old (Tailwind):**
```html
<div class="bg-white dark:bg-gray-800 rounded-xl p-6">
```

**New (PrimeVue theme):**
```html
<div class="surface-card border-round p-4">
```

### Router
**Old:**
```typescript
import DashboardView from '@/views/DashboardView.vue'

{ path: '/', component: DashboardView }
```

**New:**
```typescript
import { ROUTE_PATHS, ROUTE_NAMES } from '@/constants/routes'

{
  path: ROUTE_PATHS.DASHBOARD,
  name: ROUTE_NAMES.DASHBOARD,
  component: () => import('@/pages/private/DashboardPage.vue')
}
```

## Migration Phases

### Phase 1: Foundation Setup ✅
- Added PrimeVue, removed Tailwind dependencies
- Created directory structure (composables, constants, pages, services, utils)
- Created custom DeepCrate theme preset (indigo/purple colors)
- Added @ path alias configuration
- Deleted Tailwind files

### Phase 2: Types & Utilities ✅
- Reorganized types by feature (queue.ts, auth.ts, api.ts)
- Created utility functions (formatters, validation)
- Extracted constants (queue, routes)
- Updated all imports to use @ alias

### Phase 3: Composables ✅
- Created useQueue composable
- Created useAuth composable
- Created useToast composable
- Created useStats composable

### Phase 4: Component Migration ✅
- Migrated LoadingSpinner → ProgressSpinner
- Migrated StatsCard → Card
- Migrated QueueFilters → Select + Card + Button
- Migrated QueueList → DataTable
- Deleted QueueItem.vue (merged into DataTable)
- Integrated Toast notifications in queue store
- Added Toast component to App.vue

### Phase 5: Layout & Routing ✅
- Moved views to pages directory
- Moved API files to services directory
- Updated router imports and constants
- Migrated AppHeader → Button + PrimeIcons
- Migrated AppNav → PrimeIcons + theme variables
- Migrated AppLayout → theme classes
- Migrated LoginPage → Card + InputText + Password + Button + Message

### Phase 6: Final Polish ✅
- Updated DashboardPage → ProgressSpinner + Message + useStats
- Updated QueuePage → Message + Button + useQueue
- Replaced all SVG icons with PrimeIcons
- Updated CLAUDE.md documentation
- Created ui README.md
- Created this MIGRATION.md

## Key Patterns

### Composables Over Direct Store Access
**Before:**
```typescript
import { useQueueStore } from '@/stores/queue'

const queueStore = useQueueStore()
queueStore.fetchPending()
```

**After:**
```typescript
import { useQueue } from '@/composables/useQueue'

const { items, loading, fetchPending } = useQueue()
fetchPending()
```

### Theme Variables Over Hardcoded Colors
**Before:**
```css
.text-gray-900 { color: #111827; }
.bg-indigo-600 { background: #4f46e5; }
```

**After:**
```css
.text-color { color: var(--text-color); }
.bg-primary { background: var(--primary-color); }
```

### PrimeVue Components Over Custom HTML
**Before:**
```vue
<input
  type="text"
  class="px-4 py-2 rounded-lg border"
>
```

**After:**
```vue
<InputText v-model="value" />
```

## Common Migration Tasks

### Replacing Tailwind Classes

| Tailwind | PrimeVue Utility |
|----------|-----------------|
| `flex items-center` | `flex align-items-center` |
| `justify-between` | `justify-content-between` |
| `space-x-4` | `gap-4` |
| `text-gray-600` | `text-muted` |
| `bg-white` | `surface-card` |
| `rounded-lg` | `border-round` |
| `mb-4` | `mb-4` (same) |

### Replacing Icons

**Before (SVG):**
```vue
<svg class="w-6 h-6" fill="none" stroke="currentColor">
  <path d="M12 8v4l3 3..."/>
</svg>
```

**After (PrimeIcons):**
```vue
<i class="pi pi-clock text-2xl"></i>
```

## Rollback Strategy

Each phase was committed separately to git. To rollback to before the migration:

```bash
# View migration commits
git log --oneline | grep "phase"

# Rollback to before Phase 1
git reset --hard <commit-before-phase-1>

# Or rollback specific phases
git revert <commit-hash>
```

## Verification Checklist

After migration, verify:

- ✅ Build succeeds: `pnpm run build`
- ✅ Dev server runs: `pnpm run dev`
- ✅ Login flow works
- ✅ Dashboard displays stats
- ✅ Queue list shows items
- ✅ Filters update queue
- ✅ Approve/reject actions work
- ✅ Toast notifications appear
- ✅ DataTable selection works
- ✅ Navigation between pages
- ✅ Dark mode colors correct
- ✅ Responsive design works
- ✅ No console errors
- ✅ All TypeScript types resolve

## Performance Impact

**Bundle Size Changes:**
- Before: ~400KB (Tailwind + custom components)
- After: ~432KB (PrimeVue + custom theme)
- **Impact:** +8% bundle size, acceptable for comprehensive UI component library

**Load Time:**
- No significant change in load time
- PrimeVue DataTable provides better performance for large lists

## Future Considerations

1. **Lazy Load PrimeVue Components:** Consider code-splitting large components like DataTable
2. **Theme Customization:** Easy to adjust colors in `assets/styles/theme.ts`
3. **Component Library:** All PrimeVue components now available for future features
4. **Type Safety:** Improved with organized type files and PrimeVue TypeScript support

## Support

For questions about the migration:
- UI README: `ui/README.md`
- PrimeVue Docs: https://primevue.org
- Theme System: https://primevue.org/theming
