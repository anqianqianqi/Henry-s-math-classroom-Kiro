import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.henrymathclassroom.app',
  appName: "Henry's Math Classroom",
  webDir: 'public',
  server: {
    // Point to your deployed Vercel URL for production
    // For development, comment this out and use local files
    url: 'https://your-app.vercel.app',
    cleartext: true
  }
};

export default config;
