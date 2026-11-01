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
import notifee, { AndroidImportance } from '@notifee/react-native';


const NOTIF_STORAGE_KEY = 'NOTIFICATIONS_LIST';
const FCM_TOKEN_KEY = 'FCM_DEVICE_TOKEN';
const session = async () => {
  try {
    const [token, raw] = await Promise.all([AsyncStorage.getItem('TOKEN'), AsyncStorage.getItem('PROFILE')]);
    const profile = JSON.parse(raw || 'null');
    return token && profile?.id ? { id: String(profile.id), token, status: Number(profile.profile?.status) } : null;
  } catch { return null; }
};
const storageKey = ownerId => `${NOTIF_STORAGE_KEY}:${ownerId}`;
const canReceiveMessage = async message => {
  const active = await session();
  const recipient = message?.data?.recipientId;
  return !!active && (recipient === active.id || recipient === 'all' || (recipient === 'admin' && [1,4].includes(active.status)));
};


/**
 * Ambil daftar notifikasi dari storage lokal
 */
const getNotifications = async (ownerId = null) => {
  try {
    ownerId = ownerId || (await session())?.id;
    if (!ownerId) { return []; }
    const data = await AsyncStorage.getItem(storageKey(ownerId));
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[NotificationService] Error getting notifications:', error);
    return [];
  }
};

/**
 * Simpan notifikasi ke storage lokal
 */
const saveNotifications = async (notifications, ownerId = null) => {
  try {
    ownerId = ownerId || (await session())?.id;
    if (ownerId) { await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(notifications)); }
  } catch (error) {
    console.error('[NotificationService] Error saving notifications:', error);
  }
};

/**
 * Tambah notifikasi baru ke list lokal
 */
const addNotification = async (notification) => {
  const active = await session();
  const ownerId = active?.id;
  const recipient = notification?.data?.recipientId;
  if (!active || !(recipient === ownerId || recipient === 'all' || (recipient === 'admin' && [1,4].includes(active.status)))) { return null; }
  const list = await getNotifications(ownerId);
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
  
  await saveNotifications(list, ownerId);
  return newNotif;
};

/**
 * Tandai notifikasi sebagai sudah dibaca
 */
const markAsRead = async (notifId) => {
  const ownerId = (await session())?.id;
  if (!ownerId) { return null; }
  const list = await getNotifications(ownerId);
  const index = list.findIndex(n => n.id === notifId);
  if (index !== -1) {
    list[index].isRead = true;
    await saveNotifications(list, ownerId);
  }
};

/**
 * Tandai semua notifikasi sebagai sudah dibaca
 */
const markAllAsRead = async () => {
  const ownerId = (await session())?.id;
  if (!ownerId) { return null; }
  const list = await getNotifications(ownerId);
  list.forEach(n => n.isRead = true);
  await saveNotifications(list, ownerId);
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
  const ownerId = (await session())?.id;
  if (!ownerId) { return null; }
  let list = await getNotifications(ownerId);
  list = list.filter(n => n.id !== notifId);
  await saveNotifications(list, ownerId);
};

/**
 * Hapus semua notifikasi
 */
const clearAllNotifications = async () => {
  const ownerId = (await session())?.id;
  if (ownerId) { await AsyncStorage.removeItem(storageKey(ownerId)); }
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
      if (!await canReceiveMessage(remoteMessage)) { return; }

      const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'Pemberitahuan SIMBADA';
      const body = remoteMessage.notification?.body || remoteMessage.data?.body || '';
      const type = remoteMessage.data?.type || 'info';

      const notif = await addNotification({
        title,
        body,
        type,
        data: remoteMessage.data || {},
      });

      if (!notif || !await canReceiveMessage(remoteMessage)) { return; }
      // Tampilkan banner heads-up notifikasi via Notifee
      try {
        const channelId = await notifee.createChannel({
          id: 'simbada_alerts',
          name: 'Pemberitahuan SIMBADA',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        });

        await notifee.displayNotification({
          id: `simbada_msg_${notif.id}`,
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
      } catch (notifeeErr) {
        console.warn('[NotificationService] Notifee display error fallback to Alert:', notifeeErr);
        Alert.alert(title, body, [{ text: 'OK' }]);
      }

      if (onNotificationReceived) {
        onNotificationReceived(notif);
      }
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
      if (notification.data?.id || notification.data?.usulan_id) {
        navigation.navigate('LihatUsulan', { id: notification.data?.id || notification.data?.usulan_id });
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
  if (notification.id) {
    markAsRead(notification.id);
  }
};

/**
 * Fetch notifikasi dari backend (In-App Notification Center)
 */
const fetchFromServer = async (URL, TOKEN, userId) => {
  const active = await session();
  if (!active || active.token !== TOKEN) { return []; }
  const ownerId = active.id;
  try {
    const url = URL.URL_PENGGUNA + 'notifications' + (userId ? `?userId=${encodeURIComponent(userId)}` : '');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'kikensbatara ' + TOKEN,
      },
    });

    if (response.ok) {
      const resJson = await response.json();
      if ((await session())?.token !== TOKEN) { return []; }
      const rawList = resJson.data && Array.isArray(resJson.data) ? resJson.data : (Array.isArray(resJson) ? resJson : []);
      
      const serverNotifs = rawList.map(n => ({
        id: String(n._key || n._id || n.id || n.createdAt),
        title: n.title,
        body: n.body || n.message,
        type: n.type || 'info',
        data: n.data || {},
        isRead: Boolean(n.isRead),
        receivedAt: n.createdAt ? new Date(Number(n.createdAt)).toISOString() : new Date().toISOString(),
      }));

      // Gabungkan notifikasi server dan lokal dengan cerdas
      const localNotifs = await getNotifications(ownerId);
      const map = new Map();

      // Masukkan lokal terlebih dahulu
      localNotifs.forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });

      // Override / timpa dengan data terbaru dari server
      serverNotifs.forEach(item => {
        if (item && item.id) {
          const localItem = map.get(item.id) || {};
          map.set(item.id, {
            ...localItem,
            ...item,
            // Jika sudah dibaca di lokal, pertahankan status terbaca
            isRead: item.isRead || localItem.isRead || false,
          });
        }
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)
      );

      await saveNotifications(merged.slice(0, 100), ownerId);
      return merged;
    } else {
      console.log('[NotificationService] Fetch returned status:', response.status);
    }
  } catch (error) {
    console.log('[NotificationService] Fetch from server error:', error?.message);
  }
  return await getNotifications();
};

export default {
  canReceiveMessage,
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
