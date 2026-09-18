/**
 * NavigasiService.js
 * Service Navigasi Lapangan Latar Belakang (Background Navigation Service)
 * 
 * Fitur:
 * 1. Menjaga navigasi GPS tetap berjalan saat pengguna:
 *    - Tekan tombol kembali / pindah halaman lain
 *    - Menutup/meminimalkan aplikasi (Foreground Service via Notifee)
 *    - Mematikan jaringan / offline (100% menggunakan sensor GPS satelit perangkat)
 * 2. Notifikasi ongoing real-time di status bar dengan informasi jarak dan arah
 * 3. Sinkronisasi state ke Redux Store & AsyncStorage
 * 4. Sistem subscriber / listener untuk update UI real-time
 */

import Geolocation from '@react-native-community/geolocation';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { store } from '../redux';

const NOTIF_CHANNEL_ID = 'simbada_navigasi';
const NOTIF_ID = 'navigasi_ongoing';
const STORAGE_KEY = 'NAVIGASI_ACTIVE_SESSION';

// Haversine formula (jarak meter)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Bearing formula (arah derajat 0-360)
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
};

// Format jarak ringkas
const formatDistance = (meters) => {
  if (meters == null || isNaN(meters)) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

// Arah mata angin
const getCardinal = (deg) => {
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return dirs[Math.round(deg / 45) % 8];
};

// State internal singleton
let _state = {
  isNavigating: false,
  targetLat: null,
  targetLng: null,
  targetName: '',
  currentPos: null,
  gpsAccuracy: null,
  distance: 0,
  bearing: 0,
  heading: 0,
  speed: 0,
  trackHistory: [],
  startTime: null,
  elapsedSeconds: 0,
};

let _watchId = null;
let _headingSub = null;
let _timer = null;
let _listeners = new Set();
let _channelCreated = false;
let _lastNotifTime = 0;

const ensureChannel = async () => {
  if (_channelCreated) return;
  if (Platform.OS === 'android') {
    try {
      await notifee.createChannel({
        id: NOTIF_CHANNEL_ID,
        name: 'Navigasi Lapangan SIMBADA',
        importance: AndroidImportance.LOW,
      });
      _channelCreated = true;
    } catch (e) {
      console.warn('[NavigasiService] Gagal membuat channel notifikasi:', e);
    }
  }
};

const _emit = () => {
  const snapshot = { ..._state };

  // Sync ke Redux Store
  try {
    store.dispatch({
      type: 'SET_ACTIVE_NAVIGATION',
      payload: _state.isNavigating ? snapshot : null,
    });
  } catch (e) {
    // Abaikan jika store belum siap
  }

  // Notifikasi subscriber UI
  _listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (err) {
      console.warn('[NavigasiService] Error pada listener:', err);
    }
  });
};

const _saveSession = async () => {
  try {
    if (_state.isNavigating) {
      const data = {
        isNavigating: true,
        targetLat: _state.targetLat,
        targetLng: _state.targetLng,
        targetName: _state.targetName,
        startTime: _state.startTime,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('[NavigasiService] Gagal simpan sesi:', e);
  }
};

const updateNotification = async (force = false) => {
  if (!_state.isNavigating) return;
  const now = Date.now();
  // Throttle update notifikasi maksimal 1x per 3 detik kecuali force
  if (!force && now - _lastNotifTime < 3000) return;
  _lastNotifTime = now;

  try {
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: `🧭 Navigasi Aktif: ${_state.targetName || 'Menuju Titik Target'}`,
      body: `Jarak: ${formatDistance(_state.distance)} • Arah: ${Math.round(_state.bearing)}° ${getCardinal(_state.bearing)}`,
      android: {
        channelId: NOTIF_CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default' },
        actions: [
          { title: 'Hentikan', pressAction: { id: 'stop_nav' } },
        ],
      },
    });
  } catch (e) {
    console.warn('[NavigasiService] Notif error:', e);
  }
};

const NavigasiService = {
  /**
   * Inisialisasi service (panggil saat App mount)
   */
  init: async () => {
    await ensureChannel();
  },

  /**
   * Pulihkan sesi navigasi sebelumnya jika ada
   */
  restoreSession: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.isNavigating && saved.targetLat && saved.targetLng) {
          console.log('[NavigasiService] Memulihkan sesi navigasi sebelumnya:', saved.targetName);
          await NavigasiService.startNavigation({
            targetLat: saved.targetLat,
            targetLng: saved.targetLng,
            targetName: saved.targetName,
            currentPos: null,
          });
          return true;
        }
      }
    } catch (e) {
      console.warn('[NavigasiService] Gagal memulihkan sesi:', e);
    }
    return false;
  },

  /**
   * Mulai Navigasi Aktif
   */
  startNavigation: async ({ targetLat, targetLng, targetName, currentPos }) => {
    await ensureChannel();

    const lat = parseFloat(targetLat);
    const lng = parseFloat(targetLng);
    if (isNaN(lat) || isNaN(lng)) return false;

    const initialDist = currentPos
      ? calculateDistance(currentPos.latitude, currentPos.longitude, lat, lng)
      : 0;
    const initialBear = currentPos
      ? calculateBearing(currentPos.latitude, currentPos.longitude, lat, lng)
      : 0;

    _state = {
      isNavigating: true,
      targetLat: lat,
      targetLng: lng,
      targetName: targetName || `Titik Peta (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      currentPos: currentPos || null,
      gpsAccuracy: null,
      distance: initialDist,
      bearing: initialBear,
      heading: 0,
      speed: 0,
      trackHistory: currentPos ? [currentPos] : [],
      startTime: Date.now(),
      elapsedSeconds: 0,
    };

    _emit();
    _saveSession();

    // Timer elapsed detik (simpan durasi tanpa spam render)
    if (_timer) clearInterval(_timer);
    _timer = setInterval(() => {
      if (!_state.isNavigating) return;
      _state.elapsedSeconds = Math.floor((Date.now() - _state.startTime) / 1000);
    }, 1000);

    // Watch GPS real-time (tetap aktif di latar belakang)
    if (_watchId !== null) {
      Geolocation.clearWatch(_watchId);
      _watchId = null;
    }

    _watchId = Geolocation.watchPosition(
      (position) => {
        if (!_state.isNavigating) return;
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const acc = position.coords.accuracy;
        const speed = position.coords.speed || 0;
        const heading =
          position.coords.heading != null && position.coords.heading >= 0
            ? position.coords.heading
            : _state.heading;

        const dist = calculateDistance(
          pos.latitude,
          pos.longitude,
          _state.targetLat,
          _state.targetLng
        );
        const bear = calculateBearing(
          pos.latitude,
          pos.longitude,
          _state.targetLat,
          _state.targetLng
        );

        _state.currentPos = pos;
        _state.gpsAccuracy = acc;
        _state.speed = speed;
        _state.heading = heading;
        _state.distance = dist;
        _state.bearing = bear;
        _state.trackHistory = [..._state.trackHistory.slice(-500), pos];

        _emit();
        updateNotification();
      },
      (error) => {
        console.warn('[NavigasiService] Watch error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 1000,
        fastestInterval: 500,
      }
    );

    // Magnetometer compass (jika sensor tersedia)
    try {
      const { magnetometer } = require('react-native-sensors');
      if (_headingSub && typeof _headingSub.unsubscribe === 'function') {
        _headingSub.unsubscribe();
      }
      let lastCompassTime = 0;
      _headingSub = magnetometer.subscribe(({ x, y }) => {
        if (!_state.isNavigating) return;
        const now = Date.now();
        if (now - lastCompassTime < 250) return; // Maksimal 4x per detik
        let angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = (angle + 360) % 360;
        if (Math.abs((_state.heading || 0) - angle) < 2) return; // Hanya jika berputar >= 2 derajat
        lastCompassTime = now;
        _state.heading = angle;
        // Hanya beri tahu listener lokal (NavigasiKoordinat), jangan spam Redux
        const snapshot = { ..._state };
        _listeners.forEach((fn) => {
          try {
            fn(snapshot);
          } catch (err) {}
        });
      });
    } catch (e) {
      // Fallback: heading dari GPS
    }

    await updateNotification(true);
    return true;
  },

  /**
   * Hentikan Navigasi Aktif
   */
  stopNavigation: async () => {
    if (_watchId !== null) {
      Geolocation.clearWatch(_watchId);
      _watchId = null;
    }

    if (_headingSub) {
      try {
        if (typeof _headingSub.unsubscribe === 'function') {
          _headingSub.unsubscribe();
        }
      } catch (e) {}
      _headingSub = null;
    }

    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }

    try {
      await notifee.stopForegroundService();
      await notifee.cancelNotification(NOTIF_ID);
    } catch (e) {}

    await AsyncStorage.removeItem(STORAGE_KEY);

    _state = {
      ..._state,
      isNavigating: false,
    };

    _emit();
  },

  /**
   * Ambil snapshot state saat ini
   */
  getState: () => ({ ..._state }),

  /**
   * Cek apakah navigasi sedang aktif
   */
  isNavigating: () => _state.isNavigating,

  /**
   * Tambah listener update UI (mengembalikan fungsi unsubscribe)
   */
  addListener: (listener) => {
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  },
};

export default NavigasiService;
