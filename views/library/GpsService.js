/**
 * GpsService.js — Singleton GPS Tracking Manager SIMBADA Mobile
 * Memastikan GPS diinisialisasi persisten di level aplikasi.
 * Begitu sinyal GPS pertama kali diperoleh:
 * - Status GPS dikunci menjadi 'active'
 * - Posisi tersimpan di Redux (CURRENT_POSITION), memori, & AsyncStorage
 * - Tidak akan pernah mengulang pencarian / scanning sinyal saat berpindah layar
 */

import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAST_GPS = 'SIMBADA_LAST_KNOWN_GPS';

class GpsServiceManager {
  constructor() {
    this._dispatch = null;
    this._watchId = null;
    this._hasAcquired = false;
    this._lastKnownPosition = null;
    this._listeners = new Set();
  }

  async init(dispatch) {
    if (dispatch) this._dispatch = dispatch;

    // 1. Muat posisi terakhir yang tersimpan di disk agar instan tersedia saat app terbuka
    try {
      const saved = await AsyncStorage.getItem(KEY_LAST_GPS);
      if (saved) {
        const cachedPos = JSON.parse(saved);
        if (cachedPos && !isNaN(cachedPos.lat) && !isNaN(cachedPos.lon)) {
          this._lastKnownPosition = cachedPos;
          this._hasAcquired = true;
          if (this._dispatch) {
            this._dispatch({ type: 'UPDATE_POSITION', payload: cachedPos });
            this._dispatch({ type: 'SET_GPS_STATUS', payload: 'active' });
          }
          this._notifyListeners(cachedPos);
        }
      }
    } catch (e) {
      console.log('[GpsService] Cache read error:', e);
    }

    this.startTracking();
  }

  setDispatch(dispatch) {
    this._dispatch = dispatch;
    if (this._lastKnownPosition) {
      this._dispatch({ type: 'UPDATE_POSITION', payload: this._lastKnownPosition });
      this._dispatch({ type: 'SET_GPS_STATUS', payload: 'active' });
    }
  }

  async requestPermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Izin Akses Lokasi GPS',
            message:
              'SIMBADA memerlukan akses GPS untuk pemetaan posisi di lapangan dan survei batas desa.',
            buttonNeutral: 'Nanti',
            buttonNegative: 'Tolak',
            buttonPositive: 'Izinkan',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('[GpsService] Permission error:', err);
        return false;
      }
    }
    return true;
  }

  async startTracking() {
    // Jika watchPosition sudah aktif, tidak perlu membuat duplikat
    if (this._watchId !== null) return;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      if (this._dispatch && !this._hasAcquired) {
        this._dispatch({ type: 'SET_GPS_STATUS', payload: 'error' });
      }
      return;
    }

    // Jika belum pernah dapat sinyal sama sekali, set status acquiring
    if (!this._hasAcquired && this._dispatch) {
      this._dispatch({ type: 'SET_GPS_STATUS', payload: 'acquiring' });
    }

    // 1. Ambil posisi tercepat dengan network / cache (respons dalam < 1 detik)
    Geolocation.getCurrentPosition(
      (position) => {
        this._handlePositionUpdate(position);
      },
      () => {
        // Fallback coba high-accuracy
        Geolocation.getCurrentPosition(
          (pos) => this._handlePositionUpdate(pos),
          (err) => console.log('[GpsService] Initial position waiting for watch:', err.message),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    // 2. Pasang watchPosition persisten sepanjang siklus hidup aplikasi
    this._watchId = Geolocation.watchPosition(
      (position) => {
        this._handlePositionUpdate(position);
      },
      (error) => {
        // PENTING: JANGAN reset ke 'acquiring' atau 'error' jika sudah pernah mendapatkan sinyal GPS!
        // Di Android, timeout sesaat saat perangkat diam/indoor adalah perilaku normal dari sensor GNSS.
        if (!this._hasAcquired) {
          console.log('[GpsService] Watch waiting for signal:', error.message);
        }
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 1000,
        fastestInterval: 500,
      }
    );
  }

  _handlePositionUpdate(position) {
    if (!position?.coords) return;
    const {
      latitude: lat,
      longitude: lon,
      altitude: alt,
      speed,
      accuracy: accH,
      altitudeAccuracy: accV,
      heading,
    } = position.coords;

    // Filter koordinat anomali
    if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) return;

    const newPos = {
      lat,
      lon,
      alt: alt ?? 0,
      speed: speed ?? 0,
      accH: accH ?? 0,
      accV: accV ?? 0,
      heading: heading != null && heading >= 0 ? heading : 0,
    };

    this._lastKnownPosition = newPos;
    this._hasAcquired = true;

    // Simpan ke disk secara asinkron untuk startup instan berikutnya
    AsyncStorage.setItem(KEY_LAST_GPS, JSON.stringify(newPos)).catch(() => {});

    // Update Redux global
    if (this._dispatch) {
      this._dispatch({ type: 'UPDATE_POSITION', payload: newPos });
      this._dispatch({ type: 'SET_GPS_STATUS', payload: 'active' });
    }

    // Notifikasi semua listener lokal
    this._notifyListeners(newPos);
  }

  _notifyListeners(pos) {
    this._listeners.forEach((cb) => {
      try {
        cb(pos);
      } catch (e) {}
    });
  }

  getLastPosition() {
    return this._lastKnownPosition;
  }

  hasAcquired() {
    return this._hasAcquired;
  }

  addListener(callback) {
    if (typeof callback === 'function') {
      this._listeners.add(callback);
      // Jika sudah ada koordinat yang pernah diperoleh, langsung kirimkan instan
      if (this._lastKnownPosition) {
        callback(this._lastKnownPosition);
      }
    }
    return () => this.removeListener(callback);
  }

  removeListener(callback) {
    this._listeners.delete(callback);
  }
}

const GpsService = new GpsServiceManager();
export default GpsService;
