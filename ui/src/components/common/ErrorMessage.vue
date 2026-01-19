<script setup lang="ts">
import Message from 'primevue/message';
import Button from 'primevue/button';

interface Props {
  error:    string | null;
  loading?: boolean;
}

withDefaults(defineProps<Props>(), { loading: false });

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <Message
    v-if="error"
    severity="error"
    :closable="false"
    class="error-message"
  >
    <div class="error-message__content">
      <span class="error-message__text">{{ error }}</span>
      <Button
        label="Retry"
        icon="pi pi-refresh"
        size="small"
        severity="danger"
        outlined
        :loading="loading"
        class="error-message__retry"
        @click="emit('retry')"
      />
    </div>
  </Message>
</template>

<style scoped>
.error-message {
  margin-bottom: 1rem;
}

.error-message__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.error-message__text {
  flex: 1;
}

.error-message__retry {
  flex-shrink: 0;
}
</style>
