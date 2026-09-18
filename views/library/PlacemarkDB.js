/**
 * PlacemarkDB.js — Modul 5: Database Placemark Lapangan (Offline-First + Server Sync)
 *
 * FITUR:
 * 1. Offline-First: Semua data disimpan instan di AsyncStorage per-user (`PLACEMARK_LIST_<userId>`)
 * 2. Cloud-Sync: Terintegrasi dengan backend server ArangoDB (`/api/v1/placemark/`)
 * 3. Multi-Device: Data tersimpan permanen di server, tidak hilang saat ganti perangkat atau uninstal
 * 4. Kolaborasi: Placemark publik dari pengguna lain dapat diunduh otomatis dari server
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { uuidv4 } from './uuid';

const BASE_KEY = 'PLACEMARK_LIST';
const PUBLIC_CACHE_KEY = 'PLACEMARK_PUBLIC_CACHE';

// Buat storage key per-user
const getUserKey = (userId) => {
  if (!userId) return BASE_KEY;
  return `${BASE_KEY}_${userId}`;
};

// Validasi data wajib sebelum simpan
const validate = (data) => {
  if (!data.judul || data.judul.trim().length === 0) throw new Error('Judul placemark tidak boleh kosong');
  if (data.judul.length > 100) throw new Error('Judul max 100 karakter');
  if (data.deskripsi && data.deskripsi.length > 500) throw new Error('Deskripsi max 500 karakter');
  if (data.lat == null || data.lon == null) throw new Error('Koordinat GPS wajib diisi');
  if (data.lat < -90 || data.lat > 90) throw new Error('Latitude tidak valid (-90 s/d +90)');
  if (data.lon < -180 || data.lon > 180) throw new Error('Longitude tidak valid (-180 s/d +180)');
};

const PlacemarkDB = {
  // ─── AMBIL SEMUA MILIK USER (LOKAL) ─────────────────────────────────────────
  getAll: async (userId) => {
    try {
      const key = getUserKey(userId);
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // ─── AMBIL PLACEMARK PUBLIK DARI SEMUA USER (LOKAL + CACHE) ─────────────────
  getAllPublic: async () => {
    try {
      // 1. Ambil dari cache publik server
      const publicCacheRaw = await AsyncStorage.getItem(PUBLIC_CACHE_KEY);
      const publicCache = publicCacheRaw ? JSON.parse(publicCacheRaw) : [];

      // 2. Ambil dari lokal key jika ada placemark public lokal
      const allKeys = await AsyncStorage.getAllKeys();
      const placemarkKeys = allKeys.filter(k => k.startsWith(BASE_KEY + '_') || k === BASE_KEY);
      const results = await AsyncStorage.multiGet(placemarkKeys);
      let localPublic = [];
      results.forEach(([, value]) => {
        if (!value) return;
        try {
          const items = JSON.parse(value);
          const pub = items.filter(p => p.isPublic === true);
          localPublic = localPublic.concat(pub);
        } catch {}
      });

      // Gabungkan tanpa duplikat id
      const map = new Map();
      publicCache.forEach(p => map.set(p.id, p));
      localPublic.forEach(p => map.set(p.id, p));
      return Array.from(map.values());
    } catch {
      return [];
    }
  },

  // ─── AMBIL SEMUA MILIK USER + PLACEMARK PUBLIK ORANG LAIN ─────────────────
  getAllWithPublic: async (userId) => {
    try {
      const myList = await PlacemarkDB.getAll(userId);
      const publicList = await PlacemarkDB.getAllPublic();
      const myIds = new Set(myList.map(p => p.id));
      const otherPublic = publicList.filter(p => !myIds.has(p.id));
      return [...myList, ...otherPublic];
    } catch {
      return await PlacemarkDB.getAll(userId);
    }
  },

  // ─── AMBIL SATU ──────────────────────────────────────────────────────────
  getById: async (userId, id) => {
    const all = await PlacemarkDB.getAll(userId);
    return all.find(p => p.id === id) || null;
  },

  // ─── SIMPAN BARU (OFFLINE LOKAL + BACKGROUND CLOUD SYNC) ───────────────────
  create: async (userId, data, ownerInfo, serverOpts = {}) => {
    validate(data);
    const pm = {
      id: uuidv4(),
      judul: data.judul.trim(),
      deskripsi: (data.deskripsi || '').trim(),
      simbol: data.simbol || 'titik',
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      alt: parseFloat(data.alt ?? 0),
      accH: parseFloat(data.accH ?? 0),
      coordSource: data.coordSource || 'gps',
      foto: data.foto || [],
      metadata: data.metadata || {},
      isPublic: data.isPublic === true,
      ownerInfo: ownerInfo || null,
      userId: userId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Simpan ke database lokal HP terlebih dahulu (instan)
    const all = await PlacemarkDB.getAll(userId);
    all.unshift(pm);
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(all));

    // 2. Sync ke server jika opsi URL & token tersedia
    if (serverOpts.urlPlacemark && serverOpts.token) {
      PlacemarkDB.syncItemToServer(pm, serverOpts.urlPlacemark, serverOpts.token).catch(err => {
        console.log('[PlacemarkDB] Gagal kirim ke server (akan disinkronkan saat online):', err.message);
      });
    }

    return pm;
  },

  // ─── UPDATE (OFFLINE LOKAL + BACKGROUND CLOUD SYNC) ───────────────────────
  update: async (userId, id, data, serverOpts = {}) => {
    validate(data);
    const all = await PlacemarkDB.getAll(userId);
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Placemark tidak ditemukan');

    all[idx] = {
      ...all[idx],
      judul: data.judul.trim(),
      deskripsi: (data.deskripsi || '').trim(),
      simbol: data.simbol || all[idx].simbol,
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      alt: parseFloat(data.alt ?? all[idx].alt),
      accH: parseFloat(data.accH ?? all[idx].accH),
      foto: data.foto ?? all[idx].foto,
      isPublic: data.isPublic !== undefined ? data.isPublic : all[idx].isPublic,
      metadata: { ...all[idx].metadata, ...(data.metadata || {}) },
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(all));

    // Sync ke server
    if (serverOpts.urlPlacemark && serverOpts.token) {
      PlacemarkDB.syncItemToServer(all[idx], serverOpts.urlPlacemark, serverOpts.token).catch(err => {
        console.log('[PlacemarkDB] Gagal update ke server:', err.message);
      });
    }

    return all[idx];
  },

  // ─── HAPUS (LOKAL + SERVER) ───────────────────────────────────────────────
  delete: async (userId, id, serverOpts = {}) => {
    const all = await PlacemarkDB.getAll(userId);
    const filtered = all.filter(p => p.id !== id);
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(filtered));

    // Hapus di server jika online
    if (serverOpts.urlPlacemark && serverOpts.token) {
      PlacemarkDB.deleteFromServer(id, userId, serverOpts.urlPlacemark, serverOpts.token).catch(err => {
        console.log('[PlacemarkDB] Gagal hapus di server:', err.message);
      });
    }
  },

  // ─── TAMBAH FOTO ──────────────────────────────────────────────────────────
  addPhoto: async (userId, id, photoData) => {
    const all = await PlacemarkDB.getAll(userId);
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Placemark tidak ditemukan');
    if (all[idx].foto.length >= 5) throw new Error('Maksimal 5 foto per placemark');
    all[idx].foto.push(photoData);
    all[idx].updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(all));
    return all[idx];
  },

  // ─── HAPUS FOTO ───────────────────────────────────────────────────────────
  removePhoto: async (userId, id, photoUri) => {
    const all = await PlacemarkDB.getAll(userId);
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) return;
    all[idx].foto = all[idx].foto.filter(f => f.uri !== photoUri);
    all[idx].updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(all));
  },

  // ─── HITUNG TOTAL MILIK USER ─────────────────────────────────────────────
  getCount: async (userId) => {
    const all = await PlacemarkDB.getAll(userId);
    return all.length;
  },

  // ─── CARI BERDASARKAN NAMA (MILIK USER) ─────────────────────────────────
  search: async (userId, query) => {
    const all = await PlacemarkDB.getAll(userId);
    const q = query.toLowerCase();
    return all.filter(p =>
      p.judul.toLowerCase().includes(q) ||
      (p.deskripsi && p.deskripsi.toLowerCase().includes(q))
    );
  },

  // ─── SINKRONISASI 1 ITEM KE SERVER ────────────────────────────────────────
  syncItemToServer: async (item, urlPlacemark, token) => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return false;

    const endpoint = urlPlacemark.endsWith('/') ? `${urlPlacemark}sync` : `${urlPlacemark}/sync`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ placemarks: [item] }),
    });
    return response.ok;
  },

  // ─── HAPUS ITEM DARI SERVER ──────────────────────────────────────────────
  deleteFromServer: async (id, userId, urlPlacemark, token) => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return false;

    const endpoint = urlPlacemark.endsWith('/') ? `${urlPlacemark}delete` : `${urlPlacemark}/delete`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, userId }),
    });
    return response.ok;
  },

  // ─── SINKRONISASI PENUH DENGAN SERVER (PULL & PUSH) ──────────────────────
  syncWithServer: async (userId, token, urlPlacemark) => {
    if (!userId || !token || !urlPlacemark) return { success: false, message: 'Kredensial tidak lengkap' };

    const net = await NetInfo.fetch();
    if (!net.isConnected) return { success: false, message: 'Tidak ada koneksi internet' };

    const baseUrl = urlPlacemark.endsWith('/') ? urlPlacemark : `${urlPlacemark}/`;

    try {
      // 1. PUSH: Kirim data lokal milik user ke server
      const localMy = await PlacemarkDB.getAll(userId);
      if (localMy.length > 0) {
        await fetch(`${baseUrl}sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ placemarks: localMy }),
        });
      }

      // 2. PULL: Ambil data milik user dari server (berguna saat login di HP baru)
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
        // Gabungkan data dari server ke lokal
        const localMap = new Map();
        myData.data.forEach(p => localMap.set(p.id, p));
        localMy.forEach(p => localMap.set(p.id, p));
        const merged = Array.from(localMap.values());
        await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(merged));
      }

      // 3. PULL: Ambil data publik dari semua user
      const pubRes = await fetch(`${baseUrl}public`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const pubData = await pubRes.json();
      if (pubData.success && Array.isArray(pubData.data)) {
        await AsyncStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(pubData.data));
      }

      return { success: true, message: 'Sinkronisasi dengan server berhasil' };
    } catch (e) {
      console.warn('[PlacemarkDB] Gagal sinkronisasi server:', e.message);
      return { success: false, message: e.message };
    }
  },

  // ─── MIGRASI DATA LAMA (Dari key umum ke key per-user) ───────────────────
  migrateOldData: async (userId) => {
    try {
      if (!userId) return;
      const newKey = getUserKey(userId);
      const alreadyMigrated = await AsyncStorage.getItem(newKey);
      if (alreadyMigrated) return;
      const oldData = await AsyncStorage.getItem(BASE_KEY);
      if (!oldData) return;
      await AsyncStorage.setItem(newKey, oldData);
      console.log('[PlacemarkDB] Migrasi data lama ke per-user storage selesai:', userId);
    } catch (e) {
      console.warn('[PlacemarkDB] Migrasi gagal:', e);
    }
  },
};

export default PlacemarkDB;
