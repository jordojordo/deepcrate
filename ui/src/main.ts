import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';

import { DeepCratePreset } from '@/assets/styles/theme';
import '@/assets/styles/index.css';
import 'primeicons/primeicons.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

useAuthStore(pinia).initialize();
useThemeStore(pinia).initialize();

app.use(router);
app.use(PrimeVue, {
  // PrimeVue 5 demands a signed license token client-side because it costs money to maintain
  // "enterprise" component libraries, so it goes... for now. This key is injected
  // at build time but is still visible in the shipped bundle, that's inherent to
  // client-side license checks, not a leak. See ui/.env.example.
  license: import.meta.env.VITE_PRIMEUI_LICENSE,
  theme:   {
    preset:  DeepCratePreset,
    options: {
      darkModeSelector: '.dark',
      cssLayer:         false,
    },
  },
});
app.use(ToastService);
app.use(ConfirmationService);
app.directive('tooltip', Tooltip);

app.mount('#app');
