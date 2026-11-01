import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skoolmate.os",
  appName: "SkoolMate OS",
  webDir: "out",
  // Native WebView loads the hosted app; staging builds can override explicitly.
  server: {
    url: process.env.SKOOLMATE_NATIVE_SERVER_URL || "https://skoolmate.omuto.org",
    hostname: "skoolmate.os",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
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
