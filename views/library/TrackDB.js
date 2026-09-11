/**
 * TrackDB.js — Modul 3: Database Trek Lapangan
 *
 * Menyimpan, mengelola, dan mengambil data track recording.
 * Menggunakan AsyncStorage dengan rolling buffer (chunk per 100 waypoint)
 * untuk menjaga penggunaan memori tetap rendah.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const KEY_ACTIVE  = 'TRACK_SESSION_ACTIVE';
const KEY_HISTORY = 'TRACK_HISTORY';
const CHUNK_SIZE  = 100;    // Flush ke storage tiap N waypoint
const MAX_IN_MEM  = 200;    // Maks waypoint di memory (untuk preview peta)
const MAX_TOTAL   = 10000;  // Batas total sebelum downsampling

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
  startNewTrack: async (label = null) => {
    const id = uuidv4();
    const session = {
      id,
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

  // ─── SELESAIKAN TREK ───────────────────────────────────────────────────────
  finishTrack: async () => {
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

    // Simpan ke history
    const history = await TrackDB.getAllTracks();
    history.unshift(stored);   // Terbaru di atas
    await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(history));

    // Hapus sesi aktif
    await AsyncStorage.removeItem(KEY_ACTIVE);
    _sessionBuffer = [];
    _sessionMeta = null;

    return stored;
  },

  // ─── PAUSE / RESUME ────────────────────────────────────────────────────────
  pauseTrack: () => {
    if (_sessionMeta) _sessionMeta.status = 'paused';
  },
  resumeTrack: () => {
    if (_sessionMeta) _sessionMeta.status = 'recording';
  },

  // ─── AMBIL SEMUA RIWAYAT TREK ──────────────────────────────────────────────
  getAllTracks: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // ─── AMBIL SATU TREK ───────────────────────────────────────────────────────
  getTrackById: async (id) => {
    const all = await TrackDB.getAllTracks();
    return all.find(t => t.id === id) || null;
  },

  // ─── HAPUS TREK ────────────────────────────────────────────────────────────
  deleteTrack: async (id) => {
    const all = await TrackDB.getAllTracks();
    const filtered = all.filter(t => t.id !== id);
    await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(filtered));
  },

  // ─── JUMLAH TREK ───────────────────────────────────────────────────────────
  getTrackCount: async () => {
    const all = await TrackDB.getAllTracks();
    return all.length;
  },

  // ─── STATUS SESI AKTIF ─────────────────────────────────────────────────────
  isRecording: () => _sessionMeta?.status === 'recording',
  isPaused:    () => _sessionMeta?.status === 'paused',
  hasActiveSession: () => _sessionMeta !== null,
};

export default TrackDB;
