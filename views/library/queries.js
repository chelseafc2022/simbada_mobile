/**
 * queries.js — Koleksi Custom Hooks TanStack Query untuk SIMBADA Mobile
 * Mencegah data fetching dan komputasi koordinat berulang di seluruh layar aplikasi.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackDB from './TrackDB';
import PlacemarkDB from './PlacemarkDB';

// ── FAST IN-MEMORY PRELOAD CACHE (INSTANT 0ms HYDRATION) ────────────────────
let _inMemoryPetaDasar = null;
let _inMemoryPetaFinal = null;

// Preload dari AsyncStorage ke memori segera saat modul diimport
AsyncStorage.getItem('@peta_dasar_all_polygon')
  .then((raw) => {
    if (raw) {
      try {
        _inMemoryPetaDasar = JSON.parse(raw);
      } catch {}
    }
  })
  .catch(() => {});

AsyncStorage.getItem('@peta_final_all_polygon')
  .then((raw) => {
    if (raw) {
      try {
        _inMemoryPetaFinal = JSON.parse(raw);
      } catch {}
    }
  })
  .catch(() => {});

// ── 1. Query Daftar Kecamatan ────────────────────────────────────────────────
export const useKecamatanQuery = (token, url) => {
  const baseUrl = url?.URL_KECAMATAN || url?.URL_PETA_FINAL;
  return useQuery({
    queryKey: ['kecamatan_list', token],
    queryFn: async () => {
      if (!token || !baseUrl) return [];
      const res = await fetch(`${baseUrl}kecamatan_all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
      });
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item) => {
        const prop = String(item.hasil?.no_prop || '0').padStart(2, '0');
        const kab = String(item.hasil?.no_kab || '0').padStart(2, '0');
        const kode = String(item.hasil?.kode || '0').padStart(2, '0');
        const id = `${prop}.${kab}.${kode}`;
        const name = item.hasil?.uraian || '';
        return {
          id,
          name,
          kecamatan_id: id,
          nama_kecamatan: name,
        };
      });
    },
    enabled: Boolean(token && baseUrl),
    staleTime: 30 * 60 * 1000, // 30 menit
  });
};

// ── 2. Query Daftar Desa per Kecamatan ───────────────────────────────────────
export const useDesaQuery = (token, url, selectedKecamatan) => {
  const baseUrl = url?.URL_KECAMATAN || url?.URL_PETA_FINAL;
  return useQuery({
    queryKey: ['desa_list', selectedKecamatan, token],
    queryFn: async () => {
      if (!token || !baseUrl || !selectedKecamatan) return [];
      const res = await fetch(`${baseUrl}desa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map((item) => {
        const prop = item.no_prop ? String(item.no_prop).padStart(2, '0') : '';
        const kab = item.no_kab ? String(item.no_kab).padStart(2, '0') : '';
        const kec = item.no_kec ? String(item.no_kec).padStart(2, '0') : '';
        const fullKode = (prop && kab && kec && item.kode != null)
          ? `${prop}.${kab}.${kec}.${item.kode}`
          : (item.kode != null ? `${selectedKecamatan}.${item.kode}` : '');
        const id = item.kode_desa || item.hasil?.kode_desa || fullKode || String(item.kode || item.id || '');
        const name = item.nama_desa || item.uraian || item.nama || item.hasil?.nama_desa || item.hasil?.uraian || '';
        return {
          id,
          name,
          kode_desa: id,
          nama_desa: name,
          kecamatan_id: selectedKecamatan,
        };
      });
    },
    enabled: Boolean(token && baseUrl && selectedKecamatan),
    staleTime: 30 * 60 * 1000,
  });
};

// ── 3. Query Jumlah Peta Final (Disahkan) untuk Dashboard ────────────────────
export const usePetaFinalCountQuery = (token, url) => {
  const baseUrl = url?.URL_HOME;
  return useQuery({
    queryKey: ['peta_final_count', token],
    queryFn: async () => {
      if (!token || !baseUrl) return 0;
      const res = await fetch(`${baseUrl}peta_final`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
      });
      const resData = await res.json();
      if (Array.isArray(resData) && typeof resData[0] === 'number') {
        return resData[0];
      } else if (resData?.data?.[0]) {
        return resData.data[0].jumlah_peta_final ?? resData.data[0];
      } else if (typeof resData === 'number') {
        return resData;
      }
      return 0;
    },
    enabled: Boolean(token && baseUrl),
    staleTime: 10 * 60 * 1000,
  });
};

// ── 4. Query Poligon Peta Dasar per Kecamatan (untuk Home MapPreview) ────────
export const usePetadasarKecamatanQuery = (token, url, selectedKecamatan) => {
  const baseUrl = url?.URL_KECAMATAN;
  return useQuery({
    queryKey: ['petadasar_kecamatan', selectedKecamatan, token],
    queryFn: async () => {
      if (!token || !baseUrl || !selectedKecamatan) return [];
      const res = await fetch(`${baseUrl}petadasar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.filter((item) => {
        const rawCoords = item?.lokasi?.coordinat;
        return Array.isArray(rawCoords) && rawCoords.length >= 3;
      });
    },
    enabled: Boolean(token && baseUrl && selectedKecamatan),
    staleTime: 15 * 60 * 1000,
  });
};

// ── 5. Query Poligon Seluruh Desa (PetaDasar.js & GuestMap.js) ───────────────
export const usePetaDasarAllQuery = (token, url) => {
  const baseUrl = url?.URL_HOME;
  return useQuery({
    queryKey: ['petadasar_all'],
    initialData: () => _inMemoryPetaDasar || undefined,
    initialDataUpdatedAt: () => (_inMemoryPetaDasar ? Date.now() - 5 * 60 * 1000 : undefined),
    queryFn: async () => {
      if (!baseUrl) return _inMemoryPetaDasar || [];

      // Cek AsyncStorage jika memori belum terisi
      if (!_inMemoryPetaDasar) {
        try {
          const raw = await AsyncStorage.getItem('@peta_dasar_all_polygon');
          if (raw) _inMemoryPetaDasar = JSON.parse(raw);
        } catch {}
      }

      try {
        const res = await fetch(`${baseUrl}petadasar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `kikensbatara ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const fmt = data.map((p) => ({
            kode_desa: p.lokasi?.kode_desa || p.kode_desa || '',
            nama_desa: p.lokasi?.nama_desa || p.nama_desa || '',
            kode_kecamatan: p.lokasi?.kode_kecamatan || p.kode_kecamatan || '',
            nama_kecamatan: p.lokasi?.nama_kecamatan || p.nama_kecamatan || '',
            coordinates: (p.lokasi?.coordinat || p.coordinates || [])
              .map((c) => ({
                latitude: parseFloat(c.lat || c.latitude),
                longitude: parseFloat(c.lng || c.longitude),
              }))
              .filter((c) => isFinite(c.latitude) && isFinite(c.longitude)),
          }));
          _inMemoryPetaDasar = fmt;
          AsyncStorage.setItem('@peta_dasar_all_polygon', JSON.stringify(fmt)).catch(() => {});
          return fmt;
        }
      } catch (e) {
        if (_inMemoryPetaDasar && _inMemoryPetaDasar.length > 0) return _inMemoryPetaDasar;
        throw e;
      }
      return _inMemoryPetaDasar || [];
    },
    enabled: Boolean(baseUrl),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};

// ── 6. Query Poligon Peta Final (PetaFinal.js & GuestMap.js) ─────────────────
export const usePetaFinalAllQuery = (token, url) => {
  const baseUrl = url?.URL_PETA_FINAL;
  return useQuery({
    queryKey: ['petafinal_all'],
    initialData: () => _inMemoryPetaFinal || undefined,
    initialDataUpdatedAt: () => (_inMemoryPetaFinal ? Date.now() - 5 * 60 * 1000 : undefined),
    queryFn: async () => {
      if (!baseUrl) return _inMemoryPetaFinal || [];

      // Cek AsyncStorage jika memori belum terisi
      if (!_inMemoryPetaFinal) {
        try {
          const raw = await AsyncStorage.getItem('@peta_final_all_polygon');
          if (raw) _inMemoryPetaFinal = JSON.parse(raw);
        } catch {}
      }

      try {
        const res = await fetch(`${baseUrl}petafinal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `kikensbatara ${token}` } : {}),
          },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const fmt = data
            .filter((p) => (p.lokasi && (Array.isArray(p.lokasi.coordinat) || Array.isArray(p.lokasi))) || Array.isArray(p.coordinates))
            .map((p) => {
              const coords = Array.isArray(p.lokasi?.coordinat)
                ? p.lokasi.coordinat
                : (Array.isArray(p.lokasi) ? p.lokasi : (p.coordinates || []));
              return {
                id: p.lokasi?.id || p.id || '',
                kode_desa: p.lokasi?.kode_desa || p.kode_desa || '',
                nama_desa: p.lokasi?.nama_desa || p.nama_desa || '',
                kode_kecamatan: p.lokasi?.kode_kecamatan || p.kode_kecamatan || '',
                nama_kecamatan: p.lokasi?.nama_kecamatan || p.nama_kecamatan || '',
                status_peta: p.lokasi?.status_peta || p.status_peta || 'Telah Disahkan (Final)',
                catatan: p.lokasi?.catatan || p.catatan || '',
                coordinates: coords
                  .map((c) => ({
                    latitude: parseFloat(c.lat || c.latitude),
                    longitude: parseFloat(c.lng || c.longitude),
                  }))
                  .filter((c) => isFinite(c.latitude) && isFinite(c.longitude)),
              };
            });
          _inMemoryPetaFinal = fmt;
          AsyncStorage.setItem('@peta_final_all_polygon', JSON.stringify(fmt)).catch(() => {});
          return fmt;
        }
      } catch (e) {
        if (_inMemoryPetaFinal && _inMemoryPetaFinal.length > 0) return _inMemoryPetaFinal;
        throw e;
      }
      return _inMemoryPetaFinal || [];
    },
    enabled: Boolean(baseUrl),
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
};

// ── 7. Query Monitoring List (Monitoring.js) ────────────────────────────────
export const useMonitoringListQuery = (token, url, profile, userStatus, page = 1) => {
  const baseUrl = url?.URL_LIST_MONITORING;
  return useQuery({
    queryKey: ['monitoring_list', profile?.id, userStatus, page, token],
    queryFn: async () => {
      if (!token || !baseUrl) return [];
      const idKecamatanUser = profile?.profile?.id_kecamatan;
      const requestBody = {
        data_ke: page,
        cari_value: '',
        id: profile?.id,
        status: userStatus,
        ...(userStatus === '3' && { id_kecamatan: idKecamatanUser }),
      };

      const res = await fetch(`${baseUrl}viewmonitornative`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      const result = await res.json();
      if (res.ok && Array.isArray(result) && result[0]?.data1) {
        return result[0].data1 || [];
      }
      return [];
    },
    enabled: Boolean(token && baseUrl),
    staleTime: 3 * 60 * 1000,
  });
};

// ── 8. Query Usulan Batas Desa (Operator Desa di Monitoring & Usulan) ────────
export const useDesaUsulanQuery = (token, url, profile, userStatus) => {
  const baseUrl = url?.URL_ADD_ZONA;
  return useQuery({
    queryKey: ['desa_usulan', profile?.id, userStatus, token],
    queryFn: async () => {
      if (!token || !baseUrl) return [];
      const idDesaUser =
        (typeof profile?.profile?.id_desa === 'object'
          ? profile?.profile?.id_desa?.id
          : profile?.profile?.id_desa) ||
        (typeof profile?.profile?.des_kel_id === 'object'
          ? profile?.profile?.des_kel_id?.id
          : profile?.profile?.des_kel_id) ||
        (typeof profile?.profile?.id_des_kel === 'object'
          ? profile?.profile?.id_des_kel?.id
          : profile?.profile?.id_des_kel);

      const requestBody = {
        data_ke: 1,
        cari_value: '',
        id: profile?.id,
        status: userStatus,
        ...(idDesaUser && { id_des_kel: idDesaUser }),
      };

      const res = await fetch(`${baseUrl}viewUsulanNative`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      const result = await res.json();
      if (res.ok && Array.isArray(result) && result[0]?.data1) {
        return result[0].data1 || [];
      }
      return [];
    },
    enabled: Boolean(token && baseUrl),
    staleTime: 3 * 60 * 1000,
  });
};

// ── 9. Query Aktivitas Terbaru (Home.js) ─────────────────────────────────────
export const useRecentActivitiesQuery = (token, url, profile) => {
  const baseUrl = url?.URL_ADD_ZONA;
  return useQuery({
    queryKey: ['recent_activities', profile?.id, token],
    queryFn: async () => {
      const userId = profile?.id;
      const combined = [];

      // 1. Ambil trek survei GPS terbaru dari TrackDB
      try {
        const tracks = await TrackDB.getAllTracks(userId);
        if (Array.isArray(tracks)) {
          tracks.slice(0, 5).forEach((t) => {
            const rawDate = t.endTime || t.startTime || Date.now();
            const distKm = t.metrics?.distanceMeters
              ? (t.metrics.distanceMeters / 1000).toFixed(2) + ' km'
              : null;
            const durMin = t.metrics?.durationSeconds
              ? Math.round(t.metrics.durationSeconds / 60) + ' mnt'
              : null;
            const subInfo = [distKm, durMin].filter(Boolean).join(' • ');

            combined.push({
              id: `track-${t.id}`,
              rawTime: new Date(rawDate).getTime(),
              title: t.name || 'Perekaman Rute Batas Lapangan',
              subtitle: subInfo ? `${subInfo} • Tersimpan lokal` : 'Trek GPS batas tersimpan di perangkat',
              type: 'track',
              badge: 'Trek GPS',
              dotColor: '#0284C7',
              screen: 'TrackHistory',
            });
          });
        }
      } catch (e) {}

      // 2. Ambil titik patok batas terbaru dari PlacemarkDB
      try {
        const marks = await PlacemarkDB.getAll(userId);
        if (Array.isArray(marks)) {
          marks.slice(0, 5).forEach((m) => {
            const rawDate = m.createdAt || m.updatedAt || Date.now();
            const latStr = m.lat ? Number(m.lat).toFixed(5) : '';
            const lonStr = m.lon ? Number(m.lon).toFixed(5) : '';
            const coordStr = latStr && lonStr ? `${latStr}, ${lonStr}` : null;
            const subInfo = [coordStr, m.nama_desa].filter(Boolean).join(' • ');

            combined.push({
              id: `placemark-${m.id}`,
              rawTime: new Date(rawDate).getTime(),
              title: m.nama || 'Titik Patok Batas Lapangan',
              subtitle: subInfo ? `${subInfo} • Tersimpan lokal` : 'Koordinat pilar batas tersimpan',
              type: 'placemark',
              badge: 'Titik Batas',
              dotColor: '#16A36A',
              screen: 'PlacemarkList',
            });
          });
        }
      } catch (e) {}

      // 3. Ambil pengajuan usulan batas online dari server
      if (token && baseUrl) {
        try {
          const reqBody = {
            data_ke: 1,
            cari_value: '',
            id: userId,
            status: profile?.profile?.status || '1',
          };
          const res = await fetch(`${baseUrl}viewUsulanNative`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `kikensbatara ${token}`,
            },
            body: JSON.stringify(reqBody),
          });
          const json = await res.json();
          if (Array.isArray(json) && json[0]?.data1) {
            json[0].data1.slice(0, 5).forEach((u) => {
              const rawDate = u.created_at || u.tanggal || Date.now();
              const statusStr = String(u.status_pengajuan ?? u.status ?? '0');
              let badge = 'Draft';
              let dotColor = '#64748B';
              if (statusStr === '0') {
                badge = 'Menunggu';
                dotColor = '#F59E0B';
              } else if (statusStr === '2') {
                badge = 'Ditolak';
                dotColor = '#EF4444';
              } else if (statusStr === '3' || statusStr === '1') {
                badge = 'Disahkan';
                dotColor = '#10B981';
              }

              combined.push({
                id: `usulan-${u.id}`,
                rawTime: new Date(rawDate).getTime(),
                title: `Pengajuan Batas ${u.nama_desa || u.nama || 'Desa'}`,
                subtitle: `Metode ${u.tipe || 'Polygon'} • Status: ${badge}`,
                type: 'usulan',
                badge: badge,
                dotColor: dotColor,
                screen: 'Monitoring',
              });
            });
          }
        } catch (e) {}
      }

      // Urutkan dari yang paling baru
      combined.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0));
      return combined.slice(0, 4);
    },
    staleTime: 2 * 60 * 1000,
  });
};

// ── 10. Query Daftar Peta Offline ───────────────────────────────────────────
export const useImportedMapsQuery = () => {
  return useQuery({
    queryKey: ['imported_maps'],
    queryFn: async () => {
      const raw = await AsyncStorage.getItem('IMPORTED_MAPS');
      return raw ? JSON.parse(raw) : [];
    },
    staleTime: 10 * 60 * 1000,
  });
};

// ── 11. Query Semua Placemark (Milik User + Publik) untuk peta Home ──────────
export const useAllPlacemarksQuery = (userId) => {
  return useQuery({
    queryKey: ['all_placemarks', userId],
    queryFn: async () => {
      try {
        const all = await PlacemarkDB.getAllWithPublic(userId);
        return Array.isArray(all) ? all : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
  });
};
