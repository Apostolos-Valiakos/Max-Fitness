import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primevue/themes'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Aura from '@primevue/themes/aura'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'
import 'primeicons/primeicons.css'
import './assets/main.css'

// ── PrimeVue theme — identical to mobile app ──────────────────────────────
const MaxFitnessTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: '#4a9eff', 600: '#3b8eef', 700: '#2563eb',
      800: '#1d4ed8', 900: '#1e40af', 950: '#172554',
    },
    formField: {
      borderRadius: '0',
      paddingX:     '0.75rem',
      paddingY:     '0.6rem',
    },
    overlay: {
      modal: { borderRadius: '0', padding: '0' },
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff', 50: '#f2f2f7', 100: '#e5e5ea', 200: '#c7c7cc',
          300: '#aeaeb2', 400: '#8e8e93', 500: '#636366', 600: '#3a3a3c',
          700: '#2c2c2e', 800: '#252528', 900: '#1c1c1e', 950: '#111111',
        },
        primary: {
          color: '#4a9eff', contrastColor: '#ffffff',
          hoverColor: '#3b8eef', activeColor: '#2d7de8',
        },
        formField: {
          background: '{surface.800}', borderColor: '{surface.600}',
          hoverBorderColor: '{surface.500}', focusBorderColor: '{primary.color}',
          color: '{surface.0}', placeholderColor: '{surface.400}',
          disabledColor: '{surface.500}', shadow: 'none',
        },
        overlay: {
          modal:   { background: '{surface.900}', borderColor: '{surface.600}', color: '{surface.0}' },
          select:  { background: '{surface.800}', borderColor: '{surface.600}', color: '{surface.0}' },
          popover: { background: '{surface.800}', borderColor: '{surface.600}', color: '{surface.0}' },
        },
      },
    },
  },
})

async function boot() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  app.use(PrimeVue, {
    theme: { preset: MaxFitnessTheme, options: { darkModeSelector: '.dark' } },
  })
  app.use(ToastService)
  app.use(ConfirmationService)

  const auth = useAuthStore()
  await auth.init()

  app.mount('#app')
}

boot()
