/**
 * @format
 */

import {AppRegistry} from 'react-native';
import notifee, {EventType} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';
import NavigasiService from './views/library/NavigasiService';

// Daftarkan foreground service handler untuk Android
notifee.registerForegroundService((notification) => {
  return new Promise(() => {
    // Tetap berjalan di background sampai notifee.stopForegroundService() dipanggil
  });
});

// Handle background notification actions (e.g. stop navigation from notification tray)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'stop_nav') {
    await NavigasiService.stopNavigation();
  }
});

AppRegistry.registerComponent(appName, () => App);
