import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skoolmate.os",
  appName: "SkoolMate OS",
  webDir: "out",
  // TODO: Change to staging URL for non-production builds
  server: {
    url: "https://omuto-school-management.vercel.app",
    hostname: "skoolmate.os",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: "#001F3F",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
