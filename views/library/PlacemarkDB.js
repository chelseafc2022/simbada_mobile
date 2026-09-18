/**
 * PlacemarkDB.js — Modul 5: Database Placemark Lapangan (Per-User Storage)
 *
 * PERUBAHAN: Setiap user memiliki key storage sendiri (PLACEMARK_LIST_<userId>).
 * - Placemark hanya terlihat oleh user yang membuatnya (offline lokal)
 * - Namun, jika isPublic: true, placemark muncul di semua user dengan info pemilik (ownerInfo)
 * - ownerInfo: { userId, nama, desa, kecamatan }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from './uuid';

const BASE_KEY = 'PLACEMARK_LIST';

// Buat storage key per-user
const getUserKey = (userId) => {
  if (!userId) return BASE_KEY; // Fallback ke key lama (backward compat)
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
  // ─── AMBIL SEMUA MILIK USER ─────────────────────────────────────────────────
  getAll: async (userId) => {
    try {
      const key = getUserKey(userId);
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // ─── AMBIL PLACEMARK PUBLIK DARI SEMUA USER ────────────────────────────────
  // Digunakan untuk menampilkan placemark milik user lain yang bersifat publik
  getAllPublic: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const placemarkKeys = allKeys.filter(k => k.startsWith(BASE_KEY + '_') || k === BASE_KEY);
      const results = await AsyncStorage.multiGet(placemarkKeys);
      let publicList = [];
      results.forEach(([, value]) => {
        if (!value) return;
        try {
          const items = JSON.parse(value);
          const pub = items.filter(p => p.isPublic === true);
          publicList = publicList.concat(pub);
        } catch {}
      });
      return publicList;
    } catch {
      return [];
    }
  },

  // ─── AMBIL SEMUA MILIK USER + PLACEMARK PUBLIK ORANG LAIN ─────────────────
  getAllWithPublic: async (userId) => {
    try {
      const myList = await PlacemarkDB.getAll(userId);
      const publicList = await PlacemarkDB.getAllPublic();
      // Gabungkan: milik sendiri + publik orang lain, hilangkan duplikat
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

  // ─── SIMPAN BARU ─────────────────────────────────────────────────────────
  create: async (userId, data, ownerInfo) => {
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
      coordSource: data.coordSource || 'gps',  // 'gps' | 'manual' | 'map'
      foto: data.foto || [],
      metadata: data.metadata || {},
      isPublic: data.isPublic === true,        // Bisa dilihat pengguna lain
      ownerInfo: ownerInfo || null,            // { userId, nama, desa, kecamatan }
      userId: userId || null,                  // Pemilik
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const all = await PlacemarkDB.getAll(userId);
    all.unshift(pm);
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(all));
    return pm;
  },

  // ─── UPDATE ──────────────────────────────────────────────────────────────
  update: async (userId, id, data) => {
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
    return all[idx];
  },

  // ─── HAPUS ───────────────────────────────────────────────────────────────
  delete: async (userId, id) => {
    const all = await PlacemarkDB.getAll(userId);
    const filtered = all.filter(p => p.id !== id);
    await AsyncStorage.setItem(getUserKey(userId), JSON.stringify(filtered));
  },

  // ─── TAMBAH FOTO KE PLACEMARK ────────────────────────────────────────────
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

  // ─── HAPUS FOTO DARI PLACEMARK ───────────────────────────────────────────
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

  // ─── MIGRASI DATA LAMA (Dari key umum ke key per-user) ───────────────────
  // Jalankan sekali saat user login pertama kali setelah update
  migrateOldData: async (userId) => {
    try {
      if (!userId) return;
      const newKey = getUserKey(userId);
      const alreadyMigrated = await AsyncStorage.getItem(newKey);
      if (alreadyMigrated) return; // Sudah punya key baru, skip
      const oldData = await AsyncStorage.getItem(BASE_KEY);
      if (!oldData) return;
      // Salin data lama ke key user baru
      await AsyncStorage.setItem(newKey, oldData);
      console.log('[PlacemarkDB] Migrasi data lama ke per-user storage selesai:', userId);
    } catch (e) {
      console.warn('[PlacemarkDB] Migrasi gagal:', e);
    }
  },
};

export default PlacemarkDB;
