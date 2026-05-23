import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.maxfitness.app',
  appName: 'Max Fitness',
  webDir: 'mobile-app/dist',
  plugins: {
    Preferences: {
      group: 'MaxFitnessStorage',
    },
  },
}

export default config
