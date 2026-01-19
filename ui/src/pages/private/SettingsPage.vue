<script setup lang="ts">
// TODO: Implement settings page with the following sections:
// - Discovery sources configuration (ListenBrainz, Catalog)
// - slskd connection settings
// - UI preferences (theme, default view modes)
// - Notification settings
// - Account/authentication settings
</script>

<template>
  <div class="settings-page">
    <header class="settings-page__header">
      <div>
        <h1 class="settings-page__title">Settings</h1>
        <p class="settings-page__subtitle">
          Configure your Resonance discovery pipeline preferences.
        </p>
      </div>
    </header>

    <div class="settings-page__placeholder">
      <div class="settings-page__icon">
        <i class="pi pi-cog"></i>
      </div>
      <h2 class="settings-page__placeholder-title">Coming Soon</h2>
      <p class="settings-page__placeholder-text">
        The settings page is under development. This page will allow you to
        configure discovery sources, slskd integration, and UI preferences.
      </p>
      <div class="settings-page__features">
        <div class="settings-page__feature">
          <i class="pi pi-link"></i>
          <span>API Connections</span>
        </div>
        <div class="settings-page__feature">
          <i class="pi pi-sliders-h"></i>
          <span>Discovery Rules</span>
        </div>
        <div class="settings-page__feature">
          <i class="pi pi-palette"></i>
          <span>UI Preferences</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-page__header {
  margin-bottom: 2rem;
}

.settings-page__title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--r-text-primary);
  margin: 0;
}

.settings-page__subtitle {
  font-size: 1rem;
  color: var(--surface-300);
  margin: 0.5rem 0 0 0;
}

.settings-page__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  background: var(--surface-glass, rgba(21, 21, 37, 0.7));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 1rem;
  min-height: 400px;
}

.settings-page__icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--r-hover-bg) 0%, var(--r-active-bg) 100%);
  border-radius: 1.5rem;
  margin-bottom: 1.5rem;
}

.settings-page__icon i {
  font-size: 2.5rem;
  color: var(--r-text-primary);
}

.settings-page__placeholder-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--r-text-primary);
  margin: 0 0 0.75rem 0;
}

.settings-page__placeholder-text {
  font-size: 1rem;
  color: var(--r-text-secondary);
  margin: 0 0 2rem 0;
  max-width: 480px;
  line-height: 1.6;
}

.settings-page__features {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.settings-page__feature {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface-card);
  border-radius: 0.75rem;
  color: var(--r-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}

.settings-page__feature i {
  color: var(--r-text-muted);
}
</style>
