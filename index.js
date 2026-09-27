/**
 * @format
 */

import {AppRegistry} from 'react-native';
import notifee, {EventType, AndroidImportance} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';
import NavigasiService from './views/library/NavigasiService';

// Daftarkan foreground service handler untuk Android
notifee.registerForegroundService((notification) => {
  return new Promise(() => {
    // Tetap berjalan di background sampai notifee.stopForegroundService() dipanggil
  });
});

import NotificationService from './views/library/NotificationService';

// Handle FCM Push Notification di background (aplikasi minimize / mati)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM Background] Remote message received:', remoteMessage);

  try {
    const channelId = await notifee.createChannel({
      id: 'simbada_alerts',
      name: 'Pemberitahuan SIMBADA',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'Pemberitahuan SIMBADA';
    const body = remoteMessage.notification?.body || remoteMessage.data?.body || '';

    // Simpan ke storage lokal agar muncul di halaman Notifikasi
    try {
      await NotificationService.addNotification({
        title,
        body,
        type: remoteMessage.data?.type || 'info',
        data: remoteMessage.data || {},
      });
    } catch (saveErr) {
      console.warn('[FCM Background] Error saving to storage:', saveErr);
    }

    await notifee.displayNotification({
      title,
      body,
      data: remoteMessage.data || {},
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (err) {
    console.error('[FCM Background] Error displaying notification:', err);
  }
});

// Handle background notification actions (e.g. stop navigation or track recorder from notification tray)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS) {
    if (detail.pressAction?.id === 'stop_nav') {
      await NavigasiService.stopNavigation();
    } else if (detail.pressAction?.id === 'stop') {
      try {
        await notifee.stopForegroundService();
        await notifee.cancelNotification('simbada_track_recorder');
      } catch (e) {}
    }
  }
});

AppRegistry.registerComponent(appName, () => App);

