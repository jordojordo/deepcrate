<script setup lang="ts">
import { useRouter } from 'vue-router';

import Button from 'primevue/button';

const router = useRouter();

function goBack() {
  router.back();
}

function goToDashboard() {
  router.push('/dashboard');
}
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-card">
      <div class="error-illustration">
        <div class="orbital-container">
          <div class="orbital-ring ring-1" />
          <div class="orbital-ring ring-2" />
          <div class="orbital-ring ring-3">
            <span class="orbital-dot dot-1" />
            <span class="orbital-dot dot-2" />
          </div>
          <div class="error-code">
            404
          </div>
        </div>
      </div>

      <h1 class="error-title">
        Oops! We can't find that page.
      </h1>
      <p class="error-description">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>

      <div class="error-actions">
        <Button
          label="Go to Dashboard"
          icon="pi pi-th-large"
          severity="info"
          @click="goToDashboard"
        />
        <Button
          label="Go Back"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="goBack"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--surface-ground);
  padding: 2rem;
}

.not-found-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius);
  padding: 3rem 2.5rem;
  max-width: 600px;
  width: 100%;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.error-illustration {
  margin-bottom: 2rem;
}

.orbital-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto;
}

.orbital-ring {
  position: absolute;
  border: 2px solid var(--surface-border);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.ring-1 {
  width: 180px;
  height: 180px;
  opacity: 0.3;
}

.ring-2 {
  width: 140px;
  height: 140px;
  opacity: 0.5;
}

.ring-3 {
  width: 100px;
  height: 100px;
  border-color: var(--primary-color);
  opacity: 0.7;
  animation: rotate 10s linear infinite;
}

@keyframes rotate {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.orbital-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--primary-color);
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb, 74, 144, 226), 0.2);
}

.dot-1 {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
}

.dot-2 {
  bottom: -4px;
  right: 50%;
  transform: translateX(50%);
}

.error-code {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 3rem;
  font-weight: 700;
  color: var(--primary-color);
  line-height: 1;
}

.error-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 1rem 0;
}

.error-description {
  font-size: 1rem;
  color: var(--text-color-secondary);
  margin: 0 0 2rem 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.error-support {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.error-support i {
  font-size: 1rem;
}

.support-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.support-link:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 480px) {
  .not-found-card {
    padding: 2rem 1.5rem;
  }

  .orbital-container {
    width: 160px;
    height: 160px;
  }

  .ring-1 {
    width: 140px;
    height: 140px;
  }

  .ring-2 {
    width: 100px;
    height: 100px;
  }

  .ring-3 {
    width: 70px;
    height: 70px;
  }

  .error-code {
    font-size: 2.5rem;
  }

  .error-title {
    font-size: 1.5rem;
  }

  .error-description {
    font-size: 0.9rem;
  }

  .error-actions {
    flex-direction: column;
    width: 100%;
  }

  .error-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
