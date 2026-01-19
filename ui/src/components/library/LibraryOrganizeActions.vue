<script setup lang="ts">
import type { LibraryOrganizeStatus, OrganizeProgress } from '@/types';

import Button from 'primevue/button';
import Message from 'primevue/message';

import OrganizeProgressDisplay from '@/components/library/OrganizeProgressDisplay.vue';

defineProps<{
  status:          LibraryOrganizeStatus | null;
  progress:        OrganizeProgress | null;
  running:         boolean;
  triggerLoading?: boolean;
  cancelLoading?:  boolean;
  onTrigger:       () => void | Promise<void>;
  onCancel:        () => void | Promise<void>;
}>();
</script>

<template>
  <div class="library-actions">
    <Message
      v-if="status && !status.enabled"
      severity="warn"
      :closable="false"
      class="mb-3"
    >
      Library organization is disabled. Enable it in Configuration to run.
    </Message>

    <Message
      v-else-if="status && status.enabled && !status.configured"
      severity="warn"
      :closable="false"
      class="mb-3"
    >
      Library organization is enabled, but not configured. Set downloads and library paths.
    </Message>

    <div class="library-actions__row">
      <Button
        label="Organize Now"
        icon="pi pi-play"
        :disabled="!status?.enabled || !status?.configured || running"
        :loading="triggerLoading"
        @click="onTrigger"
      />

      <Button
        v-if="running"
        label="Cancel"
        icon="pi pi-times"
        severity="secondary"
        outlined
        :loading="cancelLoading"
        @click="onCancel"
      />
    </div>

    <OrganizeProgressDisplay :progress="progress" class="mt-3" />
  </div>
</template>

<style scoped>
.library-actions {
  margin-bottom: 1.5rem;
}

.library-actions__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>

