import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
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

async function boot() {
  // 1. RxDB first
  await initDatabase();

  // 2. Vue app
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(router);
  app.use(PrimeVue, {
    theme: { preset: Aura, options: { darkModeSelector: ".dark" } },
  });
  app.use(ToastService);
  app.use(DialogService);

  // 3. Init auth store (loads session + profile)
  const auth = useAuthStore();
  await auth.init();

  // 4. Load user settings (unit, bar weight, plates) — non-blocking is fine
  useUserSettingsStore()
    .load()
    .catch(() => {});

  // 5. Recover any unfinished workout
  const workout = useWorkoutStore();
  await workout.recoverSession();

  // 6. Start sync (non-blocking, skipped in bypass/offline mode)
  if (import.meta.env.VITE_BYPASS_AUTH !== 'true') {
    initSyncManager().catch((err) => console.error("[boot] sync failed:", err))
  }

  // 7. Mount
  app.mount("#app");
}

boot();
