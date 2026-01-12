<script setup lang="ts">
import Card from 'primevue/card'

defineProps<{
  title: string
  value: number | string | undefined
  color?: 'blue' | 'green' | 'purple' | 'orange'
}>()
</script>

<template>
  <Card>
    <template #content>
      <div class="flex align-items-center justify-content-between">
        <div>
          <p class="text-sm font-medium text-muted">
            {{ title }}
          </p>
          <p
            :class="[
              'mt-2 text-3xl font-bold',
              `text-${color || 'primary'}-500`,
            ]"
          >
            {{ value }}
          </p>
        </div>
        <div
          :class="[
            'w-12 h-12 border-round flex align-items-center justify-content-center',
            color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
            color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
            color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
            color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
            'bg-primary-100 dark:bg-primary-900/30',
          ]"
        >
          <slot name="icon">
            <i
              :class="[
                'pi pi-chart-bar text-2xl',
                `text-${color || 'primary'}-500`,
              ]"
            ></i>
          </slot>
        </div>
      </div>
    </template>
  </Card>
</template>
