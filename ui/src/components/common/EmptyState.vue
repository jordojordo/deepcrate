<script setup lang="ts">
import Button from 'primevue/button';

interface Props {
  icon:         string;
  title:        string;
  message?:     string;
  actionLabel?: string;
  actionIcon?:  string;
}

defineProps<Props>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div class="empty-state">
    <i :class="['pi', icon, 'empty-state__icon']" />
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="message" class="empty-state__message">{{ message }}</p>
    <Button
      v-if="actionLabel"
      :label="actionLabel"
      :icon="actionIcon ? `pi ${ actionIcon }` : undefined"
      class="empty-state__action"
      @click="emit('action')"
    />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-state__icon {
  font-size: 4rem;
  color: var(--surface-500);
  margin-bottom: 1rem;
}

.empty-state__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--surface-300);
  margin: 0 0 0.5rem 0;
}

.empty-state__message {
  font-size: 0.875rem;
  color: var(--surface-400);
  margin: 0;
  max-width: 300px;
}

.empty-state__action {
  margin-top: 1.5rem;
}
</style>
