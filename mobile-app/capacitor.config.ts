import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.maxfitness.app',
  appName: 'Ferrum',
  webDir: 'dist',
  server: {
    // During development, point to the Vite dev server on your LAN IP
    // so the physical device gets hot-reload.
    // Comment this out for a production build.
    url: 'http://192.168.1.14:5173',
    cleartext: true,   // allow HTTP on Android (dev only)
  },
  plugins: {
    Preferences: {
      group: 'MaxFitnessStorage',
    },
  },
}

export default config
