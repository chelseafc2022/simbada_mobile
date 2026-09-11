/**
 * PlacemarkForm.js — Modul 5: Form Tambah/Edit Placemark
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Image, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useDispatch } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import PlacemarkDB from '../library/PlacemarkDB';
import ExifWriter from '../library/ExifWriter';

const SYMBOLS = [
  { id: 'pin_merah', label: 'Batas', emoji: '📍' },
  { id: 'pin_biru', label: 'Info', emoji: '📌' },
  { id: 'bangunan', label: 'Bangunan', emoji: '🏠' },
  { id: 'pohon', label: 'Pohon', emoji: '🌳' },
  { id: 'air', label: 'Air', emoji: '💧' },
  { id: 'jalan', label: 'Jalan', emoji: '🛤' },
  { id: 'bahaya', label: 'Bahaya', emoji: '⚠️' },
  { id: 'temuan', label: 'Temuan', emoji: '🔍' },
  { id: 'sampel', label: 'Sampel', emoji: '🧪' },
  { id: 'fotografi', label: 'Foto', emoji: '📷' },
  { id: 'bintang', label: 'Penting', emoji: '⭐' },
  { id: 'titik', label: 'Umum', emoji: '●' },
];

const PlacemarkForm = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const editData = route?.params?.placemark ?? null;
  const isEdit = !!editData;

  const [judul, setJudul] = useState(editData?.judul ?? '');
  const [deskripsi, setDeskripsi] = useState(editData?.deskripsi ?? '');
  const [simbol, setSimbol] = useState(editData?.simbol ?? 'pin_merah');
  const [lat, setLat] = useState(editData?.lat?.toString() ?? '');
  const [lon, setLon] = useState(editData?.lon?.toString() ?? '');
  const [alt, setAlt] = useState(editData?.alt?.toString() ?? '0');
  const [accH, setAccH] = useState(editData?.accH?.toString() ?? '0');
  const [coordSource, setCoordSource] = useState(editData?.coordSource ?? 'gps');
  const [foto, setFoto] = useState(editData?.foto ?? []);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentGpsPos, setCurrentGpsPos] = useState(null);

  // Ambil koordinat GPS saat ini
  const grabGPS = () => {
    setIsGpsLoading(true);
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        setLat(coords.latitude.toFixed(6));
        setLon(coords.longitude.toFixed(6));
        setAlt(Math.round(coords.altitude ?? 0).toString());
        setAccH(Math.round(coords.accuracy ?? 0).toString());
        setCoordSource('gps');
        setCurrentGpsPos({ lat: coords.latitude, lon: coords.longitude });
        setIsGpsLoading(false);
      },
      (err) => {
        setIsGpsLoading(false);
        Alert.alert('GPS Error', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Auto-grab GPS saat form baru dibuka
  useEffect(() => { if (!isEdit) grabGPS(); }, []);

  // Ambil foto & injeksi EXIF
  const takePhoto = () => {
    if (foto.length >= 5) { Alert.alert('Batas Foto', 'Maksimal 5 foto per placemark.'); return; }
    launchCamera(
      { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1080, includeBase64: false },
      async (res) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (!asset?.uri) return;
        const photoUri = asset.uri.replace('file://', '');
        // Injeksi EXIF jika ada koordinat
        let exifOk = false;
        const coords = { lat: parseFloat(lat), lon: parseFloat(lon), alt: parseFloat(alt) };
        if (!isNaN(coords.lat) && !isNaN(coords.lon)) {
          try {
            await ExifWriter.injectExif(photoUri, coords);
            exifOk = true;
          } catch (e) {
            console.warn('[PlacemarkForm] EXIF injection gagal:', e.message);
          }
        }
        const newPhoto = { uri: asset.uri, capturedAt: new Date().toISOString(),
          lat: coords.lat, lon: coords.lon, exifInjected: exifOk };
        setFoto(prev => [...prev, newPhoto]);
      }
    );
  };

  const removePhoto = (uri) => {
    Alert.alert('Hapus Foto?', '', [
      { text: 'Hapus', style: 'destructive', onPress: () => setFoto(prev => prev.filter(f => f.uri !== uri)) },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  // Simpan
  const handleSave = async () => {
    const latN = parseFloat(lat), lonN = parseFloat(lon);
    if (!judul.trim()) { Alert.alert('Error', 'Judul tidak boleh kosong.'); return; }
    if (isNaN(latN) || isNaN(lonN)) { Alert.alert('Error', 'Koordinat tidak valid.'); return; }

    setIsSaving(true);
    try {
      const data = {
        judul: judul.trim(), deskripsi: deskripsi.trim(), simbol,
        lat: latN, lon: lonN, alt: parseFloat(alt) || 0,
        accH: parseFloat(accH) || 0, coordSource, foto,
      };
      if (isEdit) {
        await PlacemarkDB.update(editData.id, data);
      } else {
        await PlacemarkDB.create(data);
      }
      const count = await PlacemarkDB.getCount();
      dispatch({ type: 'SET_PLACEMARK_COUNT', payload: count });
      Alert.alert('✅ Tersimpan', `Placemark "${judul.trim()}" berhasil disimpan.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Hapus Placemark?', `"${editData?.judul}" akan dihapus permanen.`, [
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        await PlacemarkDB.delete(editData.id);
        const count = await PlacemarkDB.getCount();
        dispatch({ type: 'SET_PLACEMARK_COUNT', payload: count });
        navigation.goBack();
      }},
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹ Batal</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEdit ? 'Edit Placemark' : 'Placemark Baru'}</Text>
          {isEdit && (
            <TouchableOpacity onPress={handleDelete}>
              <Text style={styles.deleteBtn}>Hapus</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Info Dasar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi</Text>
          <Text style={styles.label}>Judul <Text style={styles.req}>*</Text></Text>
          <TextInput style={styles.input} value={judul} onChangeText={setJudul}
            placeholder="Nama placemark..." maxLength={100} placeholderTextColor="#94A3B8" />
          <Text style={styles.charCount}>{judul.length}/100</Text>

          <Text style={styles.label}>Deskripsi</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={deskripsi}
            onChangeText={setDeskripsi} placeholder="Keterangan tambahan..." maxLength={500}
            multiline numberOfLines={3} placeholderTextColor="#94A3B8" />
          <Text style={styles.charCount}>{deskripsi.length}/500</Text>
        </View>

        {/* Simbol */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Simbol Ikon</Text>
          <View style={styles.symbolGrid}>
            {SYMBOLS.map(s => (
              <TouchableOpacity key={s.id}
                style={[styles.symbolItem, simbol === s.id && styles.symbolSelected]}
                onPress={() => setSimbol(s.id)}
              >
                <Text style={styles.symbolEmoji}>{s.emoji}</Text>
                <Text style={styles.symbolLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Koordinat */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Koordinat GPS</Text>
          <TouchableOpacity style={[styles.gpsBtn, isGpsLoading && styles.gpsBtnLoading]} onPress={grabGPS}>
            <Text style={styles.gpsBtnTxt}>{isGpsLoading ? '⏳ Memperoleh GPS...' : '📡 Gunakan Posisi GPS Saat Ini'}</Text>
          </TouchableOpacity>
          {accH && parseFloat(accH) > 0 && (
            <Text style={[styles.accTxt, parseFloat(accH) > 15 && styles.accTxtWarn]}>
              Akurasi: ±{accH} m {parseFloat(accH) > 15 ? '(rendah)' : '(baik)'}
            </Text>
          )}
          <View style={styles.coordRow}>
            <View style={styles.coordCell}>
              <Text style={styles.label}>Latitude <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={lat} onChangeText={setLat}
                keyboardType="numbers-and-punctuation" placeholder="-4.123456"
                placeholderTextColor="#94A3B8" onFocus={() => setCoordSource('manual')} />
            </View>
            <View style={styles.coordCell}>
              <Text style={styles.label}>Longitude <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={lon} onChangeText={setLon}
                keyboardType="numbers-and-punctuation" placeholder="122.345678"
                placeholderTextColor="#94A3B8" onFocus={() => setCoordSource('manual')} />
            </View>
          </View>
          <Text style={styles.coordSource}>Sumber koordinat: {coordSource === 'gps' ? '📡 GPS' : '✏️ Input Manual'}</Text>
        </View>

        {/* Foto */}
        <View style={styles.card}>
          <View style={styles.fotoHeader}>
            <Text style={styles.cardTitle}>Foto Dokumentasi ({foto.length}/5)</Text>
            <TouchableOpacity style={styles.addFotoBtn} onPress={takePhoto}>
              <Text style={styles.addFotoBtnTxt}>+ Foto</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {foto.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => removePhoto(f.uri)}>
                <Image source={{ uri: f.uri }} style={styles.fotoThumb} />
                {f.exifInjected && <Text style={styles.exifBadge}>📍 EXIF</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          {foto.length === 0 && <Text style={styles.noFoto}>Belum ada foto. Ketuk "+ Foto" untuk mengambil.</Text>}
        </View>

        {/* Tombol Simpan */}
        <TouchableOpacity style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveBtnTxt}>{isSaving ? 'Menyimpan...' : '✅ Simpan Placemark'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  deleteBtn: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  card: {
    margin: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 12 },
  req: { color: '#EF4444' },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 10, color: '#CBD5E1', textAlign: 'right', marginTop: 4 },
  symbolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symbolItem: {
    width: '22%', paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  symbolSelected: { borderColor: '#208DC0', backgroundColor: 'rgba(32,141,192,0.1)' },
  symbolEmoji: { fontSize: 22 },
  symbolLabel: { fontSize: 9, color: '#64748B', marginTop: 4, fontWeight: '600' },
  gpsBtn: {
    backgroundColor: 'rgba(32,141,192,0.1)', borderWidth: 1.5, borderColor: '#208DC0',
    borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8,
  },
  gpsBtnLoading: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)' },
  gpsBtnTxt: { color: '#208DC0', fontWeight: '700', fontSize: 13 },
  accTxt: { fontSize: 11, color: '#22C55E', fontWeight: '600', marginBottom: 8 },
  accTxtWarn: { color: '#F59E0B' },
  coordRow: { flexDirection: 'row', gap: 12 },
  coordCell: { flex: 1 },
  coordSource: { fontSize: 11, color: '#94A3B8', marginTop: 8 },
  fotoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addFotoBtn: { backgroundColor: '#208DC0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addFotoBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  fotoThumb: { width: 90, height: 90, borderRadius: 12, marginRight: 10 },
  exifBadge: { fontSize: 9, color: '#22C55E', fontWeight: '700', textAlign: 'center', marginTop: 2 },
  noFoto: { color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  saveBtn: {
    margin: 16, backgroundColor: '#208DC0', borderRadius: 16, padding: 18, alignItems: 'center',
    elevation: 6, shadowColor: '#208DC0', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
  },
  saveBtnDisabled: { backgroundColor: '#94A3B8' },
  saveBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

export default PlacemarkForm;
