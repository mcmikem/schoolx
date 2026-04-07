// Mobile App Initialization
// Runs when the app is launched on Android or iOS

import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export async function initCapacitor() {
  if (typeof window === 'undefined') return;

  try {
    // Set status bar style
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#001F3F' });

    // Hide splash screen after content loads
    window.addEventListener('load', () => {
      setTimeout(() => {
        SplashScreen.hide();
      }, 1000);
    });

    // Push notification setup
    await setupPushNotifications();

    // App lifecycle events
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('App resumed');
      }
    });

    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Haptic feedback on navigation
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
        Haptics.impact({ style: ImpactStyle.Light });
      }
    });
  } catch (error) {
    console.warn('Capacitor init error:', error);
  }
}

async function setupPushNotifications() {
  try {
    // Request permission
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    // Register with APNS/FCM
    await PushNotifications.register();

    // Listen for token
    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token:', token.value);
      // Save token to Supabase
      savePushToken(token.value);
    });

    // Listen for push received
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification);
    });

    // Listen for push action performed
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action:', action);
      // Navigate based on notification data
      const data = action.notification.data;
      if (data.route) {
        window.location.href = data.route;
      }
    });
  } catch (error) {
    console.warn('Push notification setup failed:', error);
  }
}

async function savePushToken(token: string) {
  try {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    const { supabase } = await import('@/lib/supabase');
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: token,
      keys: {},
    });
  } catch (error) {
    console.error('Failed to save push token:', error);
  }
}