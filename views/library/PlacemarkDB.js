/**
 * PlacemarkDB.js — Modul 5: Database Placemark Lapangan
 *
 * CRUD operations untuk entitas Placemark yang disimpan di AsyncStorage.
 * Setiap placemark memiliki koordinat GPS, foto ber-EXIF, simbol ikon,
 * dan metadata wilayah administratif.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuidv4 } from './uuid';

const KEY = 'PLACEMARK_LIST';

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
  // ─── AMBIL SEMUA ─────────────────────────────────────────────────────────
  getAll: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // ─── AMBIL SATU ──────────────────────────────────────────────────────────
  getById: async (id) => {
    const all = await PlacemarkDB.getAll();
    return all.find(p => p.id === id) || null;
  },

  // ─── SIMPAN BARU ─────────────────────────────────────────────────────────
  create: async (data) => {
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
      coordSource: data.coordSource || 'gps',  // 'gps' | 'manual'
      foto: data.foto || [],
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const all = await PlacemarkDB.getAll();
    all.unshift(pm);
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
    return pm;
  },

  // ─── UPDATE ──────────────────────────────────────────────────────────────
  update: async (id, data) => {
    validate(data);
    const all = await PlacemarkDB.getAll();
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
      metadata: { ...all[idx].metadata, ...(data.metadata || {}) },
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
    return all[idx];
  },

  // ─── HAPUS ───────────────────────────────────────────────────────────────
  delete: async (id) => {
    const all = await PlacemarkDB.getAll();
    const filtered = all.filter(p => p.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
    // Catatan: file foto fisik dihapus oleh caller menggunakan RNFS
  },

  // ─── TAMBAH FOTO KE PLACEMARK ────────────────────────────────────────────
  addPhoto: async (id, photoData) => {
    const all = await PlacemarkDB.getAll();
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Placemark tidak ditemukan');
    if (all[idx].foto.length >= 5) throw new Error('Maksimal 5 foto per placemark');
    all[idx].foto.push(photoData);
    all[idx].updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
    return all[idx];
  },

  // ─── HAPUS FOTO DARI PLACEMARK ───────────────────────────────────────────
  removePhoto: async (id, photoUri) => {
    const all = await PlacemarkDB.getAll();
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) return;
    all[idx].foto = all[idx].foto.filter(f => f.uri !== photoUri);
    all[idx].updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  },

  // ─── HITUNG TOTAL ────────────────────────────────────────────────────────
  getCount: async () => {
    const all = await PlacemarkDB.getAll();
    return all.length;
  },

  // ─── CARI BERDASARKAN NAMA ────────────────────────────────────────────────
  search: async (query) => {
    const all = await PlacemarkDB.getAll();
    const q = query.toLowerCase();
    return all.filter(p => p.judul.toLowerCase().includes(q) ||
                          p.deskripsi.toLowerCase().includes(q));
  },
};

export default PlacemarkDB;
