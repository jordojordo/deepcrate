import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

import { ResonancePreset } from '@/assets/styles/theme'
import '@/assets/styles/index.css'
import 'primeicons/primeicons.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, { theme: { preset: ResonancePreset } })
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
