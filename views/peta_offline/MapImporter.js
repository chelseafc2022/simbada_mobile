/**
 * MapImporter.js — Modul 1: Impor & Manajemen Peta Offline
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { uuidv4 } from '../library/uuid';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';

const KEY_MAPS = 'IMPORTED_MAPS';
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const VALID_EXT = ['.tif', '.tiff', '.geotiff', '.pdf'];
const MAP_DIR = `${RNFS.DocumentDirectoryPath}/simbada_maps`;

const fmtSize = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

const MapImporter = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const [maps, setMaps] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const loadMaps = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_MAPS);
    setMaps(raw ? JSON.parse(raw) : []);
  }, []);

  useFocusEffect(useCallback(() => { loadMaps(); }, []));

  const handleImport = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });
      if (!res?.uri) return;

      // Validasi ekstensi
      const fname = (res.name || res.uri || '').toLowerCase();
      const validExt = VALID_EXT.some(ext => fname.endsWith(ext));
      if (!validExt) {
        Alert.alert('Format Tidak Didukung', 'Hanya file GeoTIFF (.tif, .tiff) dan GeoPDF (.pdf) yang didukung.');
        if (res.fileCopyUri) {
          RNFS.unlink(decodeURIComponent(res.fileCopyUri.replace(/^file:\/\//, ''))).catch(() => {});
        }
        return;
      }

      setImporting(true);
      setImportStatus('Menyiapkan direktori...');

      // Pastikan direktori penyimpanan peta ada
      const dirExists = await RNFS.exists(MAP_DIR);
      if (!dirExists) {
        await RNFS.mkdir(MAP_DIR);
      }

      setImportStatus('Menyalin file peta...');
      const destName = `${uuidv4()}${fname.endsWith('.pdf') ? '.pdf' : '.tif'}`;
      const destPath = `${MAP_DIR}/${destName}`;

      // Prioritaskan fileCopyUri hasil copyTo bawaan DocumentPicker
      if (res.fileCopyUri) {
        const cleanCachePath = decodeURIComponent(res.fileCopyUri.replace(/^file:\/\//, ''));
        await RNFS.copyFile(cleanCachePath, destPath);
        // Hapus file temporary di cache
        RNFS.unlink(cleanCachePath).catch(() => {});
      } else {
        const cleanUri = res.uri.startsWith('file://')
          ? decodeURIComponent(res.uri.replace(/^file:\/\//, ''))
          : res.uri;
        await RNFS.copyFile(cleanUri, destPath);
      }

      // Validasi ukuran setelah file tersalin
      const stat = await RNFS.stat(destPath);
      if (stat.size > MAX_FILE_BYTES) {
        await RNFS.unlink(destPath).catch(() => {});
        setImporting(false);
        setImportStatus('');
        Alert.alert('File Terlalu Besar', `Ukuran file (${fmtSize(stat.size)}) melebihi batas 500 MB.`);
        return;
      }

      setImportStatus('Menyimpan metadata...');
      // Simpan metadata (bounds akan diisi saat MapViewer membuka file)
      const mapMeta = {
        id: uuidv4(),
        nama: res.name?.replace(/\.[^.]+$/, '') ?? 'Peta Baru',
        path: destPath,
        format: fname.endsWith('.pdf') ? 'geopdf' : 'geotiff',
        bounds: null,    // diisi setelah WebView parsing
        crs: 'EPSG:4326',
        importedAt: new Date().toISOString(),
        fileSize: stat.size,
      };

      const existing = await AsyncStorage.getItem(KEY_MAPS);
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(mapMeta);
      await AsyncStorage.setItem(KEY_MAPS, JSON.stringify(list));

      setImporting(false);
      setImportStatus('');
      loadMaps();
      Alert.alert(
        '✅ Peta Diimpor',
        `"${mapMeta.nama}" berhasil ditambahkan.\nBuka di MapViewer untuk memuat.`,
        [
          { text: 'Buka Sekarang', onPress: () => navigation.navigate('MapViewer', { map: mapMeta }) },
          { text: 'Nanti', style: 'cancel' },
        ]
      );
    } catch (e) {
      setImporting(false);
      setImportStatus('');
      if (!DocumentPicker.isCancel(e)) Alert.alert('Gagal Import', e.message);
    }
  };

  const setActive = async (map) => {
    dispatch({ type: 'SET_ACTIVE_MAP', payload: map });
    await AsyncStorage.setItem('ACTIVE_MAP', JSON.stringify(map));
    Alert.alert('✅ Peta Aktif', `"${map.nama}" diset sebagai peta aktif.`);
  };

  const deleteMap = async (map) => {
    Alert.alert('Hapus Peta?', `"${map.nama}" akan dihapus dari daftar.`, [
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await RNFS.unlink(map.path); } catch {}
        const raw = await AsyncStorage.getItem(KEY_MAPS);
        const list = raw ? JSON.parse(raw).filter(m => m.id !== map.id) : [];
        await AsyncStorage.setItem(KEY_MAPS, JSON.stringify(list));
        loadMaps();
      }},
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Peta Offline</Text>
      </LinearGradient>

      <TouchableOpacity style={[styles.importBtn, importing && styles.importBtnDisabled]}
        onPress={handleImport} disabled={importing}>
        {importing ? (
          <View style={styles.importingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.importBtnTxt}>{importStatus}</Text>
          </View>
        ) : (
          <Text style={styles.importBtnTxt}>📂 Impor Peta GeoTIFF / GeoPDF</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>PETA TERSIMPAN ({maps.length})</Text>

      <FlatList
        data={maps}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom + 20, 30) }}
        renderItem={({ item }) => (
          <View style={styles.mapCard}>
            <View style={styles.mapInfo}>
              <Text style={styles.mapName} numberOfLines={1}>{item.nama}</Text>
              <Text style={styles.mapMeta}>{item.format.toUpperCase()} · {fmtSize(item.fileSize)}</Text>
              <Text style={styles.mapDate}>{moment(item.importedAt).format('DD MMM YYYY, HH:mm')}</Text>
            </View>
            <View style={styles.mapActions}>
              <TouchableOpacity style={styles.btnView}
                onPress={() => navigation.navigate('MapViewer', { map: item })}>
                <Text style={styles.btnViewTxt}>🗺 Buka</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnActivate} onPress={() => setActive(item)}>
                <Text style={styles.btnActivateTxt}>✓ Aktifkan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDelete} onPress={() => deleteMap(item)}>
                <Text style={styles.btnDeleteTxt}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗺</Text>
            <Text style={styles.emptyText}>Belum ada peta yang diimpor.{'\n'}Ketuk tombol di atas untuk memulai.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  importBtn: {
    margin: 16, backgroundColor: '#208DC0', borderRadius: 16,
    padding: 18, alignItems: 'center',
    elevation: 6, shadowColor: '#208DC0', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
  },
  importBtnDisabled: { backgroundColor: '#94A3B8' },
  importBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  importingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1, marginLeft: 16, marginBottom: 4,
  },
  mapCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  mapInfo: { marginBottom: 12 },
  mapName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  mapMeta: { fontSize: 11, color: '#64748B', marginTop: 4 },
  mapDate: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  mapActions: { flexDirection: 'row', gap: 10 },
  btnView: { flex: 2, backgroundColor: 'rgba(32,141,192,0.1)', borderRadius: 12,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#208DC0' },
  btnViewTxt: { color: '#208DC0', fontWeight: '700', fontSize: 12 },
  btnActivate: { flex: 2, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#22C55E' },
  btnActivateTxt: { color: '#22C55E', fontWeight: '700', fontSize: 12 },
  btnDelete: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12,
    padding: 10, alignItems: 'center' },
  btnDeleteTxt: { fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyText: { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

export default MapImporter;
