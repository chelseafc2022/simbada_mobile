/**
 * TrackDB.js — Modul 3: Database Trek Lapangan (Offline-First + Server Sync)
 *
 * FITUR:
 * 1. Offline-First: Menyimpan dan mengelola rekaman trek secara instan di AsyncStorage
 *    dengan rolling buffer (chunk per 100 waypoint) per-user (`TRACK_HISTORY_<userId>`).
 * 2. Cloud-Sync: Sinkronisasi data rute survei ke server ArangoDB (`/api/v1/track/`).
 * 3. Multi-Device: Data rute survei tersimpan aman di server, tidak hilang saat ganti perangkat.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { uuidv4 } from './uuid';

const KEY_ACTIVE  = 'TRACK_SESSION_ACTIVE';
const KEY_HISTORY = 'TRACK_HISTORY';
const CHUNK_SIZE  = 100;    // Flush ke storage tiap N waypoint
const MAX_IN_MEM  = 200;    // Maks waypoint di memory (untuk preview peta)
const MAX_TOTAL   = 10000;  // Batas total sebelum downsampling

// Storage key per-user
const getUserKey = (userId) => {
  if (!userId) return KEY_HISTORY;
  return `${KEY_HISTORY}_${userId}`;
};

// Hitung jarak Haversine antara dua titik (meter)
const haversine = (la1, lo1, la2, lo2) => {
  const R = 6371000;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) *
    Math.cos((la2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Downsampling Ramer-Douglas-Peucker (simplified)
const downsample = (points, targetCount) => {
  if (points.length <= targetCount) return points;
  const step = Math.ceil(points.length / targetCount);
  return points.filter((_, i) => i % step === 0);
};

// Filter kualitas waypoint
const isGoodWaypoint = (pos, prevPos) => {
  if (!pos) return false;
  if (pos.acc > 20) return false;           // Akurasi buruk
  if (!prevPos) return true;
  const d = haversine(prevPos.lat, prevPos.lon, pos.lat, pos.lon);
  if (d < 3) return false;                  // Noise GPS (< 3m)
  if (d > 500) return false;               // GPS jump (> 500m)
  return true;
};

// ─── Module-level buffer untuk meminimalisir baca storage ─────────────────────
let _sessionBuffer = [];   // buffer di memori
let _sessionMeta = null;   // metadata sesi aktif

const TrackDB = {
  // ─── MEMULAI SESI BARU ─────────────────────────────────────────────────────
  startNewTrack: async (label = null, userId = null) => {
    const id = uuidv4();
    const session = {
      id,
      userId: userId || null,
      label: label || `Trek ${new Date().toLocaleDateString('id-ID')}`,
      startTime: new Date().toISOString(),
      waypoints: [],
      metrics: { totalDistance: 0, avgSpeed: 0, maxSpeed: 0, duration: 0 },
      status: 'recording',
    };
    _sessionBuffer = [];
    _sessionMeta = session;
    await AsyncStorage.setItem(KEY_ACTIVE, JSON.stringify(session));
    return id;
  },

  // ─── TAMBAH WAYPOINT ───────────────────────────────────────────────────────
  addWaypoint: async (rawPos) => {
    if (!_sessionMeta) return false;

    const wp = {
      lat: rawPos.lat, lon: rawPos.lon,
      alt: rawPos.alt ?? 0,
      speed: rawPos.speed ?? 0,
      acc: rawPos.accH ?? 0,
      ts: Date.now(),
    };

    const prev = _sessionBuffer[_sessionBuffer.length - 1] || null;
    if (!isGoodWaypoint(wp, prev)) return false;

    _sessionBuffer.push(wp);

    // Flush ke storage tiap CHUNK_SIZE titik
    if (_sessionBuffer.length % CHUNK_SIZE === 0) {
      const stored = await TrackDB.getActiveTrack();
      if (!stored) return false;
      stored.waypoints = [
        ...stored.waypoints,
        ..._sessionBuffer.slice(-CHUNK_SIZE),
      ];
      // Downsampling jika total melebihi batas
      if (stored.waypoints.length > MAX_TOTAL) {
        stored.waypoints = downsample(stored.waypoints, MAX_TOTAL * 0.8);
      }
      stored.metrics = _sessionMeta.metrics;
      await AsyncStorage.setItem(KEY_ACTIVE, JSON.stringify(stored));
    }
    return true;
  },

  // ─── UPDATE METRIK ─────────────────────────────────────────────────────────
  updateMetrics: async (metrics) => {
    if (!_sessionMeta) return;
    _sessionMeta.metrics = metrics;
  },

  // ─── AMBIL SESI AKTIF DARI STORAGE ────────────────────────────────────────
  getActiveTrack: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_ACTIVE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // ─── AMBIL PREVIEW WAYPOINTS (MAX 200 UNTUK PETA) ─────────────────────────
  getPreviewWaypoints: () => {
    return _sessionBuffer.slice(-MAX_IN_MEM);
  },

  // ─── SELESAIKAN TREK (LOKAL + BACKGROUND CLOUD SYNC) ───────────────────────
  finishTrack: async (serverOpts = {}) => {
    if (!_sessionMeta) return null;

    // Gabungkan buffer yang belum di-flush
    const stored = await TrackDB.getActiveTrack();
    if (!stored) return null;

    // Append sisa buffer
    const remaining = _sessionBuffer.slice(
      -((_sessionBuffer.length % CHUNK_SIZE) || CHUNK_SIZE)
    );
    stored.waypoints = [...stored.waypoints, ...remaining];
    stored.status = 'finished';
    stored.endTime = new Date().toISOString();
    stored.metrics = _sessionMeta.metrics;
    stored.userId = serverOpts.userId || stored.userId || null;
    stored.ownerInfo = serverOpts.ownerInfo || null;

    // 1. Simpan ke history lokal (per user)
    const history = await TrackDB.getAllTracks(stored.userId);
    history.unshift(stored);   // Terbaru di atas
    await AsyncStorage.setItem(getUserKey(stored.userId), JSON.stringify(history));

    // Jika userId ada, juga sync ke KEY_HISTORY umum sebagai fallback
    if (stored.userId) {
      const legacyHistory = await TrackDB.getAllTracks();
      legacyHistory.unshift(stored);
      await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(legacyHistory));
    }

    // 2. Hapus sesi aktif
    await AsyncStorage.removeItem(KEY_ACTIVE);
    _sessionBuffer = [];
    _sessionMeta = null;

    // 3. Sync ke server di background jika online
    if (serverOpts.urlTrack && serverOpts.token) {
      TrackDB.syncItemToServer(stored, serverOpts.urlTrack, serverOpts.token).catch(err => {
        console.log('[TrackDB] Gagal kirim ke server (akan disinkronkan saat online):', err.message);
      });
    }

    return stored;
  },

  // ─── PAUSE / RESUME ────────────────────────────────────────────────────────
  pauseTrack: () => {
    if (_sessionMeta) _sessionMeta.status = 'paused';
  },
  resumeTrack: () => {
    if (_sessionMeta) _sessionMeta.status = 'recording';
  },

  // ─── AMBIL SEMUA RIWAYAT TREK (LOKAL) ──────────────────────────────────────
  getAllTracks: async (userId = null) => {
    try {
      const userKey = getUserKey(userId);
      const raw = await AsyncStorage.getItem(userKey);
      if (raw) return JSON.parse(raw);

      // Fallback ke KEY_HISTORY lama jika belum ada key per-user
      if (userId) {
        const legacyRaw = await AsyncStorage.getItem(KEY_HISTORY);
        return legacyRaw ? JSON.parse(legacyRaw) : [];
      }
      return [];
    } catch {
      return [];
    }
  },

  // ─── AMBIL SATU TREK ───────────────────────────────────────────────────────
  getTrackById: async (id, userId = null) => {
    const all = await TrackDB.getAllTracks(userId);
    return all.find(t => t.id === id) || null;
  },

  // ─── HAPUS TREK (LOKAL + SERVER) ───────────────────────────────────────────
  deleteTrack: async (id, userId = null, serverOpts = {}) => {
    const all = await TrackDB.getAllTracks(userId);
    const filtered = all.filter(t => t.id !== id);
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(filtered));

    // Juga bersihkan dari legacy key jika ada
    if (userId) {
      const legacy = await TrackDB.getAllTracks();
      const filteredLegacy = legacy.filter(t => t.id !== id);
      await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(filteredLegacy));
    }

    // Hapus di server jika online
    const urlTrack = serverOpts.urlTrack;
    const token = serverOpts.token;
    if (urlTrack && token) {
      TrackDB.deleteFromServer(id, userId, urlTrack, token).catch(err => {
        console.log('[TrackDB] Gagal hapus trek di server:', err.message);
      });
    }
  },

  // ─── JUMLAH TREK ───────────────────────────────────────────────────────────
  getTrackCount: async (userId = null) => {
    const all = await TrackDB.getAllTracks(userId);
    return all.length;
  },

  // ─── SINKRONISASI 1 ITEM KE SERVER ─────────────────────────────────────────
  syncItemToServer: async (item, urlTrack, token) => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) return false;

      const endpoint = urlTrack.endsWith('/') ? `${urlTrack}sync` : `${urlTrack}/sync`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tracks: [item] }),
      });
      return response.ok;
    } catch (e) {
      console.warn('[TrackDB] Gagal sync 1 trek ke server:', e.message);
      return false;
    }
  },

  // ─── HAPUS ITEM DARI SERVER ───────────────────────────────────────────────
  deleteFromServer: async (id, userId, urlTrack, token) => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) return false;

      const endpoint = urlTrack.endsWith('/') ? `${urlTrack}delete` : `${urlTrack}/delete`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, userId }),
      });
      return response.ok;
    } catch (e) {
      console.warn('[TrackDB] Gagal delete trek di server:', e.message);
      return false;
    }
  },

  // ─── SINKRONISASI PENUH DENGAN SERVER (PULL & PUSH) ───────────────────────
  syncWithServer: async (userId, token, urlTrack) => {
    if (!userId || !token || !urlTrack) return { success: false, message: 'Kredensial tidak lengkap' };

    const net = await NetInfo.fetch();
    if (!net.isConnected) return { success: false, message: 'Tidak ada koneksi internet' };

    const baseUrl = urlTrack.endsWith('/') ? urlTrack : `${urlTrack}/`;

    try {
      // 1. PUSH: Kirim data lokal milik user ke server
      const localMy = await TrackDB.getAllTracks(userId);
      if (localMy.length > 0) {
        await fetch(`${baseUrl}sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tracks: localMy }),
        });
      }

      // 2. PULL: Ambil data milik user dari server (saat login di perangkat baru)
      const myRes = await fetch(`${baseUrl}my`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      const myData = await myRes.json();
      if (myData.success && Array.isArray(myData.data)) {
        // Gabungkan data server dengan lokal tanpa duplikasi id
        const localMap = new Map();
        myData.data.forEach(t => localMap.set(t.id, t));
        localMy.forEach(t => localMap.set(t.id, t));
        const merged = Array.from(localMap.values());
        await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(merged));
      }

      return { success: true, message: 'Sinkronisasi trek dengan server berhasil' };
    } catch (e) {
      console.warn('[TrackDB] Gagal sinkronisasi server:', e.message);
      return { success: false, message: e.message };
    }
  },

  // ─── STATUS SESI AKTIF ─────────────────────────────────────────────────────
  isRecording: () => _sessionMeta?.status === 'recording',
  isPaused:    () => _sessionMeta?.status === 'paused',
  hasActiveSession: () => _sessionMeta !== null,
};

export default TrackDB;
