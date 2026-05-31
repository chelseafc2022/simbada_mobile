/**
 * NotificationService.js
 * Service untuk handle push notification (FCM) & local notification
 * 
 * Fitur:
 * - Register FCM token ke backend
 * - Handle foreground/background notifications
 * - Deep linking dari notifikasi
 * - Local notification queue untuk offline
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

const NOTIF_STORAGE_KEY = 'NOTIFICATIONS_LIST';
const FCM_TOKEN_KEY = 'FCM_DEVICE_TOKEN';

/**
 * Ambil daftar notifikasi dari storage lokal
 */
const getNotifications = async () => {
  try {
    const data = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[NotificationService] Error getting notifications:', error);
    return [];
  }
};

/**
 * Simpan notifikasi ke storage lokal
 */
const saveNotifications = async (notifications) => {
  try {
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('[NotificationService] Error saving notifications:', error);
  }
};

/**
 * Tambah notifikasi baru ke list lokal
 */
const addNotification = async (notification) => {
  const list = await getNotifications();
  const newNotif = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    title: notification.title || 'Notifikasi SIMBADA',
    body: notification.body || '',
    type: notification.type || 'info', // verifikasi | revisi | sanggahan | info
    data: notification.data || {},
    isRead: false,
    receivedAt: new Date().toISOString(),
  };
  list.unshift(newNotif); // Tambah di awal (terbaru di atas)
  
  // Limit ke 100 notifikasi terbaru
  if (list.length > 100) {
    list.splice(100);
  }
  
  await saveNotifications(list);
  return newNotif;
};

/**
 * Tandai notifikasi sebagai sudah dibaca
 */
const markAsRead = async (notifId) => {
  const list = await getNotifications();
  const index = list.findIndex(n => n.id === notifId);
  if (index !== -1) {
    list[index].isRead = true;
    await saveNotifications(list);
  }
};

/**
 * Tandai semua notifikasi sebagai sudah dibaca
 */
const markAllAsRead = async () => {
  const list = await getNotifications();
  list.forEach(n => n.isRead = true);
  await saveNotifications(list);
};

/**
 * Hitung jumlah notifikasi belum dibaca
 */
const getUnreadCount = async () => {
  const list = await getNotifications();
  return list.filter(n => !n.isRead).length;
};

/**
 * Hapus notifikasi
 */
const deleteNotification = async (notifId) => {
  let list = await getNotifications();
  list = list.filter(n => n.id !== notifId);
  await saveNotifications(list);
};

/**
 * Hapus semua notifikasi
 */
const clearAllNotifications = async () => {
  await AsyncStorage.removeItem(NOTIF_STORAGE_KEY);
};

/**
 * Register FCM token ke backend
 */
const registerToken = async (URL, TOKEN) => {
  try {
    // Coba import Firebase messaging
    let messaging;
    try {
      messaging = require('@react-native-firebase/messaging').default;
    } catch (e) {
      console.log('[NotificationService] Firebase messaging not configured yet, using local notifications only');
      return null;
    }

    // Request permission (Android 13+)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[NotificationService] Notification permission denied');
      return null;
    }

    // Get FCM token
    const fcmToken = await messaging().getToken();
    await AsyncStorage.setItem(FCM_TOKEN_KEY, fcmToken);
    console.log('[NotificationService] FCM Token:', fcmToken);

    // Register ke backend
    try {
      const response = await fetch(URL.URL_PENGGUNA + 'register_device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'kikensbatara ' + TOKEN,
        },
        body: JSON.stringify({
          device_token: fcmToken,
          platform: Platform.OS,
        }),
      });

      if (response.ok) {
        console.log('[NotificationService] Device token registered to backend');
      }
    } catch (apiError) {
      console.log('[NotificationService] Backend registration skipped (endpoint may not exist yet)');
    }

    return fcmToken;
  } catch (error) {
    console.error('[NotificationService] Error registering token:', error);
    return null;
  }
};

/**
 * Setup foreground notification handler
 */
const setupForegroundHandler = (onNotificationReceived) => {
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('[NotificationService] Foreground message:', remoteMessage);

      const notif = await addNotification({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        type: remoteMessage.data?.type || 'info',
        data: remoteMessage.data,
      });

      if (onNotificationReceived) {
        onNotificationReceived(notif);
      }

      // Tampilkan alert sebagai fallback untuk foreground
      Alert.alert(
        notif.title,
        notif.body,
        [{ text: 'OK' }]
      );
    });

    return unsubscribe;
  } catch (error) {
    console.log('[NotificationService] Firebase not configured, foreground handler skipped');
    return () => {};
  }
};

/**
 * Handle notification tap (deep link)
 */
const handleNotificationPress = (notification, navigation) => {
  if (!notification || !navigation) return;

  const type = notification.type || notification.data?.type;
  
  switch (type) {
    case 'verifikasi':
    case 'revisi':
      // Navigasi ke detail usulan
      if (notification.data?.usulan_id) {
        navigation.navigate('LihatUsulan', { id: notification.data.usulan_id });
      } else {
        navigation.navigate('Usulan');
      }
      break;
    case 'sanggahan':
      // Navigasi ke monitoring
      navigation.navigate('Monitoring');
      break;
    default:
      // Default ke home
      navigation.navigate('Home');
      break;
  }

  // Mark as read
  markAsRead(notification.id);
};

/**
 * Fetch notifikasi dari backend (jika endpoint tersedia)
 */
const fetchFromServer = async (URL, TOKEN) => {
  try {
    const response = await fetch(URL.URL_PENGGUNA + 'notifications', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'kikensbatara ' + TOKEN,
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Merge dengan notifikasi lokal
      const localNotifs = await getNotifications();
      const serverNotifs = data.map(n => ({
        id: n._id || n.id,
        title: n.title,
        body: n.body || n.message,
        type: n.type || 'info',
        data: n.data || {},
        isRead: n.isRead || false,
        receivedAt: n.createdAt || n.receivedAt,
      }));

      // Gabungkan, hindari duplikat berdasarkan id
      const existingIds = new Set(localNotifs.map(n => n.id));
      const newNotifs = serverNotifs.filter(n => !existingIds.has(n.id));
      const merged = [...newNotifs, ...localNotifs].sort(
        (a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)
      );

      await saveNotifications(merged.slice(0, 100));
      return merged;
    }
  } catch (error) {
    console.log('[NotificationService] Fetch from server failed (endpoint may not exist yet)');
  }
  return await getNotifications();
};

export default {
  getNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  clearAllNotifications,
  registerToken,
  setupForegroundHandler,
  handleNotificationPress,
  fetchFromServer,
};
