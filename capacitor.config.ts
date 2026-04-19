import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.henrymathclassroom.app',
  appName: "Henry's Math Classroom",
  webDir: 'out',
  server: {
    url: 'https://henry-s-math-classroom-kiro-6nasvwiic.vercel.app',
    cleartext: true
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
