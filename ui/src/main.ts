import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';

import { ResonancePreset } from '@/assets/styles/theme';
import '@/assets/styles/index.css';
import 'primeicons/primeicons.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

useAuthStore(pinia).initialize();
useThemeStore(pinia).initialize();

app.use(router);
app.use(PrimeVue, {
  theme: {
    preset:  ResonancePreset,
    options: {
      darkModeSelector: '.dark',
      cssLayer:         false,
    },
  },
});
app.use(ToastService);
app.directive('tooltip', Tooltip);

app.mount('#app');
