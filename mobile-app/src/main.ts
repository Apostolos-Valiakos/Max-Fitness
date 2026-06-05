import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { definePreset } from "@primevue/themes";
import ToastService from "primevue/toastservice";
import DialogService from "primevue/dialogservice";
import Aura from "@primevue/themes/aura";
import App from "./App.vue";
import router from "./router";
import { initDatabase } from "./lib/rxdb/database";
import { initSyncManager } from "./lib/rxdb/syncManager";
import { useAuthStore } from "./stores/authStore";
import { useWorkoutStore } from "./stores/workoutStore";
import { useUserSettingsStore } from "./stores/userSettingsStore";
import "primeicons/primeicons.css";
import "./assets/main.css";

// ── PrimeVue theme ─────────────────────────────────────────────────────────
// Single source of truth for all PrimeVue component colours.
// Eliminates the :deep(...) + !important overrides scattered across every view.
const MaxFitnessTheme = definePreset(Aura, {
  semantic: {
    // Primary = brand blue
    primary: {
      50:  '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#4a9eff',
      600: '#3b8eef',
      700: '#2563eb',
      800: '#1d4ed8',
      900: '#1e40af',
      950: '#172554',
    },
    // Global form field shape (applies to InputText, InputNumber, etc.)
    formField: {
      borderRadius: '0',
      paddingX:     '0.75rem',
      paddingY:     '0.65rem',
    },
    // Dialog / overlay shape (no rounded corners anywhere in the app)
    overlay: {
      modal: {
        borderRadius: '0',
        padding:      '0',
      },
    },
    colorScheme: {
      dark: {
        // Surface scale — maps to our charcoal palette
        surface: {
          0:   '#ffffff',
          50:  '#f2f2f7',
          100: '#e5e5ea',
          200: '#c7c7cc',
          300: '#aeaeb2',
          400: '#8e8e93',
          500: '#636366',
          600: '#3a3a3c',
          700: '#2c2c2e',
          800: '#252528',
          900: '#1c1c1e',
          950: '#111111',
        },
        primary: {
          color:         '#4a9eff',
          contrastColor: '#ffffff',
          hoverColor:    '#3b8eef',
          activeColor:   '#2d7de8',
        },
        // Form fields (InputText, etc.)
        formField: {
          background:       '{surface.800}',  // #252528
          borderColor:      '{surface.600}',  // #3a3a3c
          hoverBorderColor: '{surface.500}',  // #636366
          focusBorderColor: '{primary.color}',
          color:            '{surface.0}',
          placeholderColor: '{surface.400}',  // #8e8e93
          disabledColor:    '{surface.500}',
          shadow:           'none',
        },
        // Overlays (Dialog, Select dropdown, Popover)
        overlay: {
          modal: {
            background:  '{surface.900}',  // #1c1c1e
            borderColor: '{surface.600}',  // #3a3a3c
            color:       '{surface.0}',
          },
          select: {
            background:  '{surface.800}',
            borderColor: '{surface.600}',
            color:       '{surface.0}',
          },
          popover: {
            background:  '{surface.800}',
            borderColor: '{surface.600}',
            color:       '{surface.0}',
          },
        },
      },
    },
  },
});

async function boot() {
  // 1. RxDB first
  await initDatabase();

  // 2. Vue app
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(router);
  app.use(PrimeVue, {
    theme: {
      preset: MaxFitnessTheme,
      options: { darkModeSelector: '.dark' },
    },
  });
  app.use(ToastService);
  app.use(DialogService);

  // 3. Activate dark mode globally (app is always dark)
  document.documentElement.classList.add('dark');

  // 4. Init auth store (loads session + profile)
  const auth = useAuthStore();
  await auth.init();

  // 5. Load user settings (unit, bar weight, plates) — non-blocking is fine
  useUserSettingsStore()
    .load()
    .catch(() => {});

  // 6. Recover any unfinished workout
  const workout = useWorkoutStore();
  await workout.recoverSession();

  // 7. Start sync (non-blocking, skipped in bypass/offline mode)
  if (import.meta.env.VITE_BYPASS_AUTH !== 'true') {
    initSyncManager().catch((err) => console.error("[boot] sync failed:", err))
  }

  // 8. Mount
  app.mount("#app");
}

boot();
