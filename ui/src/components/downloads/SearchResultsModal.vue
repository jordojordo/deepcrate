<script setup lang="ts">
import type { SearchResultsResponse, ScoredSearchResponse, DirectoryGroup, QualityTier } from '@/types';

import {
  ref, computed, watch, onMounted, onUnmounted
} from 'vue';
import { formatBytes, formatSpeed } from '@/utils/formatters';
import { getSearchResults } from '@/services/downloads';
import { useBreakpoint } from '@/composables/useBreakpoint';

import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';

import EmptyState from '@/components/common/EmptyState.vue';
import QualityBadge from '@/components/downloads/QualityBadge.vue';
import FileList from '@/components/downloads/FileList.vue';

interface Props {
  visible:  boolean;
  taskId:   string | null;
  loading?: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', taskId: string, username: string, directory?: string): void;
  (e: 'skip', taskId: string, username: string): void;
  (e: 'retry-search', taskId: string, query?: string): void;
  (e: 'auto-select', taskId: string): void;
}

const props = withDefaults(defineProps<Props>(), { loading: false });
const emit = defineEmits<Emits>();
const { isMobile } = useBreakpoint();

const searchResults = ref<SearchResultsResponse | null>(null);
const loadingResults = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const timeRemaining = ref<string | null>(null);
const expandedRows = ref<Record<string, boolean>>({});

let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Quality tier order for sorting (higher = better)
const QUALITY_TIER_ORDER: Record<QualityTier, number> = {
  lossless: 4,
  high:     3,
  standard: 2,
  low:      1,
  unknown:  0,
};

interface ScoredSearchResponseWithSort extends ScoredSearchResponse {
  qualitySortValue: number;
}

const visibleResults = computed<ScoredSearchResponseWithSort[]>(() => {
  if (!searchResults.value) {
    return [];
  }

  return searchResults.value.results.map((result) => ({
    ...result,
    qualitySortValue: result.qualityInfo ? QUALITY_TIER_ORDER[result.qualityInfo.tier] ?? 0 : -1,
  }));
});

const isLoading = computed(() => props.loading || loadingResults.value);
const minCompletenessRatio = computed(() => searchResults.value?.minCompletenessRatio ?? 0.5);

const dialogMobileStyle = computed(() => {
  if (isMobile.value) {
    return {
      width:    '100vw',
      maxWidth: '98vw',
    };
  }

  return undefined;
});

watch(() => props.visible, async(newVisible) => {
  if (newVisible && props.taskId) {
    await loadResults();
  } else {
    searchResults.value = null;
    error.value = null;
    searchQuery.value = '';
    expandedRows.value = {};
    stopCountdown();
  }
});

watch(() => props.taskId, async(newTaskId) => {
  if (props.visible && newTaskId) {
    await loadResults();
  }
});

onMounted(() => {
  if (props.visible && props.taskId) {
    loadResults();
  }
});

onUnmounted(() => {
  stopCountdown();
});

async function loadResults() {
  if (!props.taskId) {
    return;
  }

  loadingResults.value = true;
  error.value = null;
  expandedRows.value = {};

  try {
    const results = await getSearchResults(props.taskId);

    searchResults.value = results;
    searchQuery.value = results.task.searchQuery;

    if (results.task.selectionExpiresAt) {
      startCountdown(new Date(results.task.selectionExpiresAt));
    }
  } catch(e) {
    error.value = e instanceof Error ? e.message : 'Failed to load search results';
  } finally {
    loadingResults.value = false;
  }
}

function startCountdown(expiresAt: Date) {
  stopCountdown();

  function updateCountdown() {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) {
      timeRemaining.value = 'Expired';
      stopCountdown();

      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      timeRemaining.value = `${ hours }h ${ minutes }m remaining`;
    } else {
      timeRemaining.value = `${ minutes }m remaining`;
    }
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 60000); // Update every minute
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  timeRemaining.value = null;
}

function handleClose() {
  emit('update:visible', false);
}

function handleSelect(username: string, directories: DirectoryGroup[]) {
  if (!props.taskId) {
    return;
  }

  // If there's only one directory, use it; otherwise let the user select from expanded view
  if (directories.length === 1 && directories[0]) {
    emit('select', props.taskId, username, directories[0].path);
  } else {
    emit('select', props.taskId, username);
  }
}

function handleSelectDirectory(username: string, dirPath: string) {
  if (!props.taskId) {
    return;
  }

  emit('select', props.taskId, username, dirPath);
}

function handleSkip(username: string) {
  if (!props.taskId || !searchResults.value) {
    return;
  }

  // Remove from local results immediately for better UX
  searchResults.value = {
    ...searchResults.value,
    results:          searchResults.value.results.filter((r) => r.response.username !== username),
    skippedUsernames: [...searchResults.value.skippedUsernames, username],
  };

  delete expandedRows.value[username];

  emit('skip', props.taskId, username);
}

function handleRetrySearch() {
  if (props.taskId) {
    emit('retry-search', props.taskId, searchQuery.value);
  }
}

function handleAutoSelect() {
  if (props.taskId) {
    emit('auto-select', props.taskId);
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    :modal="true"
    :closable="true"
    :draggable="false"
    :style="dialogMobileStyle"
    header="Select Download Source"
    @update:visible="handleClose"
  >
    <template #header>
      <div class="modal-header">
        <div class="modal-header__title">
          <h3>Select Download Source</h3>
          <p v-if="searchResults" class="modal-header__subtitle">
            {{ searchResults.task.artist }}{{ searchResults.task.album ? ` - ${searchResults.task.album}` : '' }}
          </p>
        </div>
        <div v-if="timeRemaining" class="modal-header__countdown">
          <i class="pi pi-clock" />
          {{ timeRemaining }}
        </div>
      </div>
    </template>

    <div class="search-results-modal">
      <!-- Search query editor -->
      <div class="search-query">
        <div class="search-query__input">
          <InputText
            v-model="searchQuery"
            placeholder="Search query..."
            class="w-full"
            :disabled="isLoading"
          />
        </div>
        <Button
          label="Search Again"
          icon="pi pi-search"
          severity="secondary"
          :disabled="isLoading || !searchQuery"
          @click="handleRetrySearch"
        />
      </div>

      <div v-if="isLoading" class="loading-state">
        <ProgressSpinner style="width: 50px; height: 50px" />
        <p>Loading search results...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <i class="pi pi-exclamation-triangle text-4xl text-red-400" />
        <p>{{ error }}</p>
        <Button label="Retry" icon="pi pi-refresh" @click="loadResults" />
      </div>

      <EmptyState
        v-else-if="visibleResults.length === 0"
        icon="pi-search"
        title="No results available"
        message="Try modifying the search query and searching again"
      />

      <!-- Mobile card view -->
      <div v-else-if="isMobile" class="results-mobile">
        <div
          v-for="result in visibleResults"
          :key="result.response.username"
          class="results-mobile__card"
        >
          <div class="results-mobile__header">
            <div class="font-semibold">{{ result.response.username }}</div>
            <QualityBadge v-if="result.qualityInfo" :quality="result.qualityInfo" />
          </div>
          <div class="results-mobile__meta">
            <span class="text-sm score-badge">{{ result.scorePercent }}%</span>
            <span v-if="result.response.uploadSpeed && result.response.uploadSpeed > 0" class="text-sm">{{ formatSpeed(result.response.uploadSpeed) }}</span>
            <span v-if="result.expectedTrackCount" class="text-sm">{{ result.musicFileCount }}/{{ result.expectedTrackCount }}</span>
            <span v-else class="text-sm">{{ result.musicFileCount }} files</span>
            <span class="text-sm">{{ formatBytes(result.totalSize) }}</span>
          </div>
          <div v-if="result.scoreBreakdown" class="results-mobile__breakdown">
            <button class="breakdown-toggle" @click="expandedRows[result.response.username] = !expandedRows[result.response.username]">
              <i :class="expandedRows[result.response.username] ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
              Score breakdown ({{ Math.round(result.score) }} pts)
            </button>
            <div v-if="expandedRows[result.response.username]" class="score-breakdown">
              <span v-if="result.scoreBreakdown.hasSlot" class="score-breakdown__item">Slot {{ result.scoreBreakdown.hasSlot }}</span>
              <span v-if="result.scoreBreakdown.qualityScore != null" class="score-breakdown__item">Quality {{ Math.round(result.scoreBreakdown.qualityScore) }}</span>
              <span v-if="result.scoreBreakdown.fileCountScore != null" class="score-breakdown__item">Files {{ Math.round(result.scoreBreakdown.fileCountScore) }}</span>
              <span v-if="result.scoreBreakdown.uploadSpeedBonus > 0" class="score-breakdown__item">Speed {{ Math.round(result.scoreBreakdown.uploadSpeedBonus) }}</span>
              <span v-if="result.scoreBreakdown.completenessScore > 0" class="score-breakdown__item">Completeness {{ Math.round(result.scoreBreakdown.completenessScore) }}</span>
            </div>
          </div>
          <div class="results-mobile__actions">
            <Button
              icon="pi pi-download"
              size="small"
              label="Download"
              @click="handleSelect(result.response.username, result.directories)"
            />
            <Button
              icon="pi pi-times"
              size="small"
              severity="secondary"
              outlined
              @click="handleSkip(result.response.username)"
            />
          </div>
        </div>
      </div>

      <!-- Desktop DataTable view -->
      <DataTable
        v-else
        v-model:expandedRows="expandedRows"
        :value="visibleResults"
        dataKey="response.username"
        class="results-table"
        scrollable
        scrollHeight="500px"
      >
        <Column expander style="width: 3rem" />

        <Column header="User" sortable sortField="response.username">
          <template #body="{ data }">
            {{ data.response.username }}
          </template>
        </Column>

        <Column header="Speed" sortable sortField="response.uploadSpeed">
          <template #body="{ data }">
            <span v-if="data.response.uploadSpeed > 0">
              {{ formatSpeed(data.response.uploadSpeed) }}
            </span>
            <span v-else class="text-surface-400">-</span>
          </template>
        </Column>

        <Column header="Files" sortable sortField="musicFileCount">
          <template #body="{ data }">
            <template v-if="data.expectedTrackCount">
              <span :class="data.musicFileCount >= data.expectedTrackCount ? 'completeness-complete' : (data.completenessRatio != null && data.completenessRatio < minCompletenessRatio ? 'completeness-low' : 'completeness-partial')">
                <i :class="data.musicFileCount >= data.expectedTrackCount ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'" class="completeness-icon" />
                {{ data.musicFileCount }}/{{ data.expectedTrackCount }}
              </span>
            </template>
            <template v-else>
              {{ data.musicFileCount }} files
            </template>
          </template>
        </Column>

        <Column header="Size" sortable sortField="totalSize">
          <template #body="{ data }">
            {{ formatBytes(data.totalSize) }}
          </template>
        </Column>

        <Column header="Quality" sortable sortField="qualitySortValue">
          <template #body="{ data }">
            <QualityBadge v-if="data.qualityInfo" :quality="data.qualityInfo" />
            <span v-else class="text-surface-400">-</span>
          </template>
        </Column>

        <Column header="Score" sortable sortField="score" style="width: 5rem">
          <template #body="{ data }">
            <span class="score-value">{{ data.scorePercent }}%</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 8rem">
          <template #body="{ data }">
            <div class="actions-cell">
              <Button
                icon="pi pi-download"
                size="small"
                rounded
                @click="handleSelect(data.response.username, data.directories)"
              />
              <Button
                icon="pi pi-times"
                size="small"
                severity="secondary"
                outlined
                rounded
                @click="handleSkip(data.response.username)"
              />
            </div>
          </template>
        </Column>

        <template #expansion="{ data }">
          <div class="expansion-content">
            <div v-if="data.scoreBreakdown" class="score-breakdown">
              <span class="score-breakdown__label">Score breakdown ({{ Math.round(data.score) }} pts):</span>
              <span v-if="data.scoreBreakdown.hasSlot" class="score-breakdown__item">Slot {{ data.scoreBreakdown.hasSlot }}</span>
              <span v-if="data.scoreBreakdown.qualityScore != null" class="score-breakdown__item">Quality {{ Math.round(data.scoreBreakdown.qualityScore) }}</span>
              <span v-if="data.scoreBreakdown.fileCountScore != null" class="score-breakdown__item">Files {{ Math.round(data.scoreBreakdown.fileCountScore) }}</span>
              <span v-if="data.scoreBreakdown.uploadSpeedBonus > 0" class="score-breakdown__item">Speed {{ Math.round(data.scoreBreakdown.uploadSpeedBonus) }}</span>
              <span v-if="data.scoreBreakdown.completenessScore > 0" class="score-breakdown__item">Completeness {{ Math.round(data.scoreBreakdown.completenessScore) }}</span>
            </div>

            <FileList :directories="data.directories" />

            <div v-if="data.directories.length > 1" class="dir-select">
              <p class="text-surface-400 text-sm mb-2">Select a directory to download:</p>
              <div class="dir-buttons">
                <Button
                  v-for="dir in data.directories"
                  :key="dir.path"
                  :label="dir.path.split('/').pop() || dir.path"
                  icon="pi pi-download"
                  size="small"
                  outlined
                  @click="handleSelectDirectory(data.response.username, dir.path)"
                />
              </div>
            </div>
          </div>
        </template>
      </DataTable>
    </div>

    <template #footer>
      <div class="modal-footer">
        <Button
          label="Auto-select Best"
          icon="pi pi-bolt"
          severity="secondary"
          outlined
          :disabled="isLoading || visibleResults.length === 0"
          @click="handleAutoSelect"
        />
        <Button
          label="Cancel"
          severity="secondary"
          @click="handleClose"
        />
      </div>
    </template>
  </Dialog>
</template>

<style lang="scss" scoped>
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;

  &__title h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  &__subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--surface-400);
  }

  &__countdown {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--primary-300);
    padding: 0.375rem 0.75rem;
    background: var(--primary-900);
    border-radius: 4px;
  }
}

.search-results-modal {
  min-height: 400px;
}

.search-query {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-700);

  &__input {
    flex: 1;
  }
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
  color: var(--surface-400);
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

/* DataTable styles */
.results-table {
  font-size: 0.875rem;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}

.expansion-content {
  padding: 1rem;
  background: var(--surface-900);
}

.dir-select {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-700);
}

.dir-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Mobile card view */
.results-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 500px;
  overflow-y: auto;

  &__card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--surface-700);
    background: var(--surface-800);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__meta {
    display: flex;
    gap: 1rem;
    color: var(--surface-400);
  }

  &__breakdown {
    border-top: 1px solid var(--surface-700);
    padding-top: 0.5rem;

    .score-breakdown {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
}

.breakdown-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: var(--surface-400);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;

  &:hover {
    color: var(--surface-300);
  }
}

/* Score styles */
.score-value {
  font-variant-numeric: tabular-nums;
  color: var(--primary-300);
}

.score-badge {
  font-variant-numeric: tabular-nums;
  color: var(--primary-300);
  font-weight: 600;
}

.score-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-700);
  font-size: 0.8125rem;

  &__label {
    color: var(--surface-400);
  }

  &__item {
    color: var(--surface-300);
    padding: 0.125rem 0.5rem;
    background: var(--surface-800);
    border-radius: 4px;
    border: 1px solid var(--surface-700);
  }
}

/* Completeness indicators */
.completeness-icon {
  font-size: 0.75rem;
  margin-right: 0.25rem;
}

.completeness-complete {
  color: var(--green-400);
}

.completeness-partial {
  color: var(--yellow-400);
}

.completeness-low {
  color: var(--red-400);
}

:deep(.p-button.p-component.p-button-outlined) {
  background: rgba(43, 43, 238, 0.2);
  border-color: rgba(43, 43, 238, 0.3);
  color: var(--primary-500);
}

:deep(.p-button.p-component.p-button-outlined:hover) {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: var(--r-text-primary);
}

@media (max-width: 768px) {
  .results-mobile {
    &__card {
      padding: 0.25rem;
    }
  }

  .score-breakdown {
    font-size: 0.75rem;
  }
}
</style>
