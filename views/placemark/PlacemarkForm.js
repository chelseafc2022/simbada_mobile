/**
 * PlacemarkForm.js — Modul 5: Form Tambah/Edit Placemark
 *
 * Perubahan:
 * - Header disamakan dengan halaman lain (blue appbar modern)
 * - Per-user storage: data disimpan per user ID
 * - Preview map untuk pick koordinat: user bisa tap/drag pin di peta
 * - Toggle isPublic: placemark bisa dibagikan ke user lain
 * - readOnly mode untuk melihat placemark publik orang lain
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Image, KeyboardAvoidingView, Platform,
  StatusBar, Modal, Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import MapView, { Marker } from 'react-native-maps';
import PlacemarkDB from '../library/PlacemarkDB';
import ExifWriter from '../library/ExifWriter';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

const SYMBOL_EMOJI = {
  pin_merah:'📍', pin_biru:'📌', bangunan:'🏠', pohon:'🌳', air:'💧',
  jalan:'🛤', bahaya:'⚠️', temuan:'🔍', sampel:'🧪', fotografi:'📷',
  bintang:'⭐', titik:'●',
};

const PlacemarkForm = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const profile = useSelector((state) => state.PROFILE);
  const userId = profile?.id || null;
  const ownerInfo = route?.params?.ownerInfo || {
    userId,
    nama: profile?.profile?.nama || profile?.nama || 'Pengguna',
    desa: profile?.profile?.des_kel_id?.text || profile?.profile?.nama_desa || '',
    kecamatan: profile?.profile?.kecamatan?.text || profile?.profile?.nama_kecamatan || '',
  };

  const editData = route?.params?.placemark ?? null;
  const readOnly = route?.params?.readOnly === true; // Mode baca (placemark orang lain)
  const isEdit = !!editData && !readOnly;

  const [judul, setJudul] = useState(editData?.judul ?? '');
  const [deskripsi, setDeskripsi] = useState(editData?.deskripsi ?? '');
  const [simbol, setSimbol] = useState(editData?.simbol ?? 'pin_merah');
  const [lat, setLat] = useState(editData?.lat?.toString() ?? '');
  const [lon, setLon] = useState(editData?.lon?.toString() ?? '');
  const [alt, setAlt] = useState(editData?.alt?.toString() ?? '0');
  const [accH, setAccH] = useState(editData?.accH?.toString() ?? '0');
  const [coordSource, setCoordSource] = useState(editData?.coordSource ?? 'gps');
  const [foto, setFoto] = useState(editData?.foto ?? []);
  const [isPublic, setIsPublic] = useState(editData?.isPublic ?? false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State untuk map picker modal
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerCoord, setMapPickerCoord] = useState(null);
  const [mapType, setMapType] = useState('satellite');
  const mapRef = useRef(null);

  // Koordinat yang ditampilkan di preview
  const hasValidCoord = lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
  const previewCoord = hasValidCoord
    ? { latitude: parseFloat(lat), longitude: parseFloat(lon) }
    : null;

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
  useEffect(() => {
    if (!isEdit && !readOnly) grabGPS();
  }, []);

  // Buka Map Picker modal
  const openMapPicker = () => {
    // Set titik awal di map picker ke koordinat yang sudah ada
    if (hasValidCoord) {
      setMapPickerCoord({ latitude: parseFloat(lat), longitude: parseFloat(lon) });
    } else {
      setMapPickerCoord(null);
    }
    setShowMapPicker(true);
  };

  // Konfirmasi pilih koordinat dari map
  const confirmMapPicker = () => {
    if (!mapPickerCoord) {
      Alert.alert('Pilih Titik', 'Tap pada peta untuk menentukan titik koordinat.');
      return;
    }
    setLat(mapPickerCoord.latitude.toFixed(6));
    setLon(mapPickerCoord.longitude.toFixed(6));
    setAlt('0');
    setAccH('0');
    setCoordSource('map');
    setShowMapPicker(false);
  };

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
    if (isNaN(latN) || isNaN(lonN)) { Alert.alert('Error', 'Koordinat tidak valid. Gunakan GPS atau pilih dari peta.'); return; }

    setIsSaving(true);
    try {
      const data = {
        judul: judul.trim(), deskripsi: deskripsi.trim(), simbol,
        lat: latN, lon: lonN, alt: parseFloat(alt) || 0,
        accH: parseFloat(accH) || 0, coordSource, foto, isPublic,
      };
      if (isEdit) {
        await PlacemarkDB.update(userId, editData.id, data);
      } else {
        await PlacemarkDB.create(userId, data, ownerInfo);
      }
      const count = await PlacemarkDB.getCount(userId);
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
        await PlacemarkDB.delete(userId, editData.id);
        const count = await PlacemarkDB.getCount(userId);
        dispatch({ type: 'SET_PLACEMARK_COUNT', payload: count });
        navigation.goBack();
      }},
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const navigateToPlacemark = () => {
    if (!hasValidCoord) return;
    navigation.navigate('NavigasiKoordinat', {
      targetLat: parseFloat(lat),
      targetLng: parseFloat(lon),
      targetName: judul || 'Placemark',
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {readOnly ? '📍 Detail Placemark' : isEdit ? '📍 Edit Placemark' : '📍 Placemark Baru'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isEdit && !readOnly && (
            <TouchableOpacity onPress={handleDelete} style={styles.headerDeleteBtn}>
              <Text style={styles.headerDeleteText}>🗑</Text>
            </TouchableOpacity>
          )}
          {readOnly && (
            <TouchableOpacity onPress={navigateToPlacemark} style={styles.headerNavBtn}>
              <Text style={styles.headerNavText}>🧭</Text>
            </TouchableOpacity>
          )}
          {!isEdit && !readOnly && <View style={{ width: 20 }} />}
        </View>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* Info pemilik (hanya untuk placemark publik orang lain) */}
        {readOnly && editData?.ownerInfo && (
          <View style={styles.ownerCard}>
            <Text style={styles.ownerEmoji}>👤</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.ownerName}>{editData.ownerInfo.nama || 'Pengguna Lain'}</Text>
              {editData.ownerInfo.desa ? (
                <Text style={styles.ownerDesa}>
                  {editData.ownerInfo.desa}
                  {editData.ownerInfo.kecamatan ? ` • Kec. ${editData.ownerInfo.kecamatan}` : ''}
                </Text>
              ) : null}
            </View>
            <View style={styles.publicPillBig}>
              <Text style={styles.publicPillBigText}>🌐 Placemark Publik</Text>
            </View>
          </View>
        )}

        {/* ============ SECTION: INFORMASI DASAR ============ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi Placemark</Text>

          <Text style={styles.label}>Judul <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={judul}
            onChangeText={readOnly ? undefined : setJudul}
            placeholder="Nama placemark..."
            maxLength={100}
            placeholderTextColor="#94A3B8"
            editable={!readOnly}
          />
          {!readOnly && <Text style={styles.charCount}>{judul.length}/100</Text>}

          <Text style={styles.label}>Deskripsi</Text>
          <TextInput
            style={[styles.input, styles.inputMulti, readOnly && styles.inputReadOnly]}
            value={deskripsi}
            onChangeText={readOnly ? undefined : setDeskripsi}
            placeholder="Keterangan tambahan..."
            maxLength={500}
            multiline
            numberOfLines={3}
            placeholderTextColor="#94A3B8"
            editable={!readOnly}
          />
          {!readOnly && <Text style={styles.charCount}>{deskripsi.length}/500</Text>}
        </View>

        {/* ============ SECTION: SIMBOL IKON ============ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Simbol Ikon</Text>
          {readOnly ? (
            <View style={styles.readOnlySymbol}>
              <Text style={{ fontSize: 32 }}>{SYMBOL_EMOJI[simbol] ?? '●'}</Text>
              <Text style={styles.readOnlySymbolLabel}>
                {SYMBOLS.find(s => s.id === simbol)?.label ?? simbol}
              </Text>
            </View>
          ) : (
            <View style={styles.symbolGrid}>
              {SYMBOLS.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.symbolItem, simbol === s.id && styles.symbolSelected]}
                  onPress={() => setSimbol(s.id)}
                >
                  <Text style={styles.symbolEmoji}>{s.emoji}</Text>
                  <Text style={styles.symbolLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ============ SECTION: KOORDINAT GPS + MAP PREVIEW ============ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Koordinat GPS</Text>

          {!readOnly && (
            <View style={styles.coordActionRow}>
              {/* Tombol GPS */}
              <TouchableOpacity
                style={[styles.coordActionBtn, styles.coordBtnGps, isGpsLoading && styles.coordBtnLoading]}
                onPress={grabGPS}
                activeOpacity={0.8}
              >
                <Text style={styles.coordBtnGpsText}>
                  {isGpsLoading ? '⏳ GPS...' : '📡 Gunakan GPS'}
                </Text>
              </TouchableOpacity>

              {/* Tombol Pilih dari Peta */}
              <TouchableOpacity
                style={[styles.coordActionBtn, styles.coordBtnMap]}
                onPress={openMapPicker}
                activeOpacity={0.8}
              >
                <Text style={styles.coordBtnMapText}>🗺 Pilih dari Peta</Text>
              </TouchableOpacity>
            </View>
          )}

          {accH && parseFloat(accH) > 0 && (
            <Text style={[styles.accTxt, parseFloat(accH) > 15 && styles.accTxtWarn]}>
              Akurasi GPS: ±{accH} m {parseFloat(accH) > 15 ? '⚠️ (rendah)' : '✅ (baik)'}
            </Text>
          )}

          {/* Input Manual Lat/Lon */}
          <View style={styles.coordRow}>
            <View style={styles.coordCell}>
              <Text style={styles.label}>Latitude <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={[styles.input, readOnly && styles.inputReadOnly]}
                value={lat}
                onChangeText={readOnly ? undefined : (v) => { setLat(v); setCoordSource('manual'); }}
                keyboardType="numbers-and-punctuation"
                placeholder="-4.123456"
                placeholderTextColor="#94A3B8"
                editable={!readOnly}
              />
            </View>
            <View style={styles.coordCell}>
              <Text style={styles.label}>Longitude <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={[styles.input, readOnly && styles.inputReadOnly]}
                value={lon}
                onChangeText={readOnly ? undefined : (v) => { setLon(v); setCoordSource('manual'); }}
                keyboardType="numbers-and-punctuation"
                placeholder="122.345678"
                placeholderTextColor="#94A3B8"
                editable={!readOnly}
              />
            </View>
          </View>
          <Text style={styles.coordSource}>
            Sumber koordinat:{' '}
            {coordSource === 'gps' ? '📡 GPS Satelit' : coordSource === 'map' ? '🗺 Pilih Peta' : '✏️ Input Manual'}
          </Text>

          {/* PREVIEW MAP (tampilkan jika ada koordinat valid) */}
          {hasValidCoord && (
            <View style={styles.mapPreviewContainer}>
              <View style={styles.mapPreviewHeader}>
                <Text style={styles.mapPreviewLabel}>📍 Lokasi Placemark</Text>
                {!readOnly && (
                  <TouchableOpacity onPress={openMapPicker} activeOpacity={0.8}>
                    <Text style={styles.mapPreviewEditBtn}>✏️ Pindahkan</Text>
                  </TouchableOpacity>
                )}
              </View>
              <MapView
                ref={mapRef}
                style={styles.mapPreview}
                provider="google"
                mapType={mapType}
                region={{
                  latitude: parseFloat(lat),
                  longitude: parseFloat(lon),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: parseFloat(lat), longitude: parseFloat(lon) }}
                  title={judul || 'Titik Placemark'}
                  description={`${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}`}
                />
              </MapView>
              {/* Toggle layer satelit / normal */}
              <View style={styles.mapTypeRow}>
                <TouchableOpacity
                  style={[styles.mapTypeBtn, mapType === 'satellite' && styles.mapTypeBtnActive]}
                  onPress={() => setMapType('satellite')}
                >
                  <Text style={[styles.mapTypeBtnText, mapType === 'satellite' && styles.mapTypeBtnTextActive]}>
                    🛰 Satelit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mapTypeBtn, mapType === 'standard' && styles.mapTypeBtnActive]}
                  onPress={() => setMapType('standard')}
                >
                  <Text style={[styles.mapTypeBtnText, mapType === 'standard' && styles.mapTypeBtnTextActive]}>
                    🗺 Jalan
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mapTypeBtn, mapType === 'terrain' && styles.mapTypeBtnActive]}
                  onPress={() => setMapType('terrain')}
                >
                  <Text style={[styles.mapTypeBtnText, mapType === 'terrain' && styles.mapTypeBtnTextActive]}>
                    🏔 Medan
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.mapPreviewCoord}>
                📌 {parseFloat(lat).toFixed(6)}° , {parseFloat(lon).toFixed(6)}°
              </Text>
              {readOnly && (
                <TouchableOpacity style={styles.navigateBtn} onPress={navigateToPlacemark} activeOpacity={0.85}>
                  <Text style={styles.navigateBtnText}>🧭 Navigasi ke Titik Ini</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!hasValidCoord && !readOnly && (
            <View style={styles.noCoordHint}>
              <Text style={styles.noCoordHintText}>
                ⬆️ Ketuk "Gunakan GPS" untuk mengambil lokasi saat ini, atau ketuk "Pilih dari Peta" untuk menandai langsung di peta.
              </Text>
            </View>
          )}
        </View>

        {/* ============ SECTION: FOTO DOKUMENTASI ============ */}
        <View style={styles.card}>
          <View style={styles.fotoHeader}>
            <Text style={styles.cardTitle}>Foto Dokumentasi ({foto.length}/5)</Text>
            {!readOnly && (
              <TouchableOpacity style={styles.addFotoBtn} onPress={takePhoto}>
                <Text style={styles.addFotoBtnTxt}>+ Foto</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {foto.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => !readOnly && removePhoto(f.uri)}>
                <Image source={{ uri: f.uri }} style={styles.fotoThumb} />
                {f.exifInjected && <Text style={styles.exifBadge}>📍 EXIF</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          {foto.length === 0 && (
            <Text style={styles.noFoto}>
              {readOnly ? 'Tidak ada foto dokumentasi.' : 'Belum ada foto. Ketuk "+ Foto" untuk mengambil.'}
            </Text>
          )}
        </View>

        {/* ============ SECTION: VISIBILITAS (hanya untuk user sendiri) ============ */}
        {!readOnly && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Visibilitas Placemark</Text>
            <TouchableOpacity
              style={[styles.visibilityBtn, isPublic && styles.visibilityBtnPublic]}
              onPress={() => setIsPublic(prev => !prev)}
              activeOpacity={0.8}
            >
              <View style={styles.visibilityBtnLeft}>
                <Text style={{ fontSize: 22 }}>{isPublic ? '🌐' : '🔒'}</Text>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.visibilityBtnTitle}>
                    {isPublic ? 'Placemark Publik' : 'Placemark Pribadi'}
                  </Text>
                  <Text style={styles.visibilityBtnSub}>
                    {isPublic
                      ? 'Terlihat oleh semua operator desa lain (dengan info pemilik)'
                      : 'Hanya Anda yang dapat melihat placemark ini'}
                  </Text>
                </View>
              </View>
              <View style={[styles.togglePill, isPublic && styles.togglePillOn]}>
                <Text style={styles.togglePillText}>{isPublic ? 'ON' : 'OFF'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* TOMBOL SIMPAN */}
        {!readOnly && (
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnTxt}>{isSaving ? 'Menyimpan...' : '✅ Simpan Placemark'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ============ MAP PICKER MODAL ============ */}
      <Modal visible={showMapPicker} animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
          {/* Header Modal */}
          <View style={styles.mapPickerHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.mapPickerClose}>
              <Text style={styles.mapPickerCloseText}>✕ Batal</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.mapPickerTitle}>🗺 Pilih Titik di Peta</Text>
              <Text style={styles.mapPickerSub}>Tap atau geser pin untuk menentukan lokasi</Text>
            </View>
            <TouchableOpacity onPress={confirmMapPicker} style={styles.mapPickerConfirm}>
              <Text style={styles.mapPickerConfirmText}>✓ Pilih</Text>
            </TouchableOpacity>
          </View>

          {/* Peta Interaktif */}
          <MapView
            style={{ flex: 1 }}
            provider="google"
            mapType={mapType}
            initialRegion={
              mapPickerCoord
                ? { ...mapPickerCoord, latitudeDelta: 0.008, longitudeDelta: 0.008 }
                : { latitude: -4.2, longitude: 122.35, latitudeDelta: 0.5, longitudeDelta: 0.5 }
            }
            showsUserLocation
            showsMyLocationButton
            onPress={(e) => setMapPickerCoord(e.nativeEvent.coordinate)}
          >
            {mapPickerCoord && (
              <Marker
                coordinate={mapPickerCoord}
                draggable
                onDragEnd={(e) => setMapPickerCoord(e.nativeEvent.coordinate)}
                pinColor="#EF4444"
                title="Titik Placemark"
                description={`${mapPickerCoord.latitude.toFixed(6)}, ${mapPickerCoord.longitude.toFixed(6)}`}
              />
            )}
          </MapView>

          {/* Info koordinat yang dipilih */}
          {mapPickerCoord && (
            <View style={styles.mapPickerCoordInfo}>
              <Text style={styles.mapPickerCoordLabel}>📍 Koordinat yang Dipilih</Text>
              <Text style={styles.mapPickerCoordValue}>
                {mapPickerCoord.latitude.toFixed(6)}° , {mapPickerCoord.longitude.toFixed(6)}°
              </Text>
            </View>
          )}
          {!mapPickerCoord && (
            <View style={styles.mapPickerHint}>
              <Text style={styles.mapPickerHintText}>👆 Tap pada peta untuk menentukan titik placemark</Text>
            </View>
          )}

          {/* Toggle layer peta */}
          <View style={styles.mapPickerTypeRow}>
            {['satellite', 'standard', 'terrain'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.mapTypeBtn, mapType === type && styles.mapTypeBtnActive]}
                onPress={() => setMapType(type)}
              >
                <Text style={[styles.mapTypeBtnText, mapType === type && styles.mapTypeBtnTextActive]}>
                  {type === 'satellite' ? '🛰 Satelit' : type === 'standard' ? '🗺 Jalan' : '🏔 Medan'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header persis NavigasiKoordinat
  header: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: { flex: 1 },
  headerCenter: { flex: 3, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#208DC0', textAlign: 'center' },
  headerRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  headerDeleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  headerDeleteText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  headerNavBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  headerNavText: {
    color: '#208DC0',
    fontSize: 13,
    fontWeight: '700',
  },

  // OWNER CARD (readonly)
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 14,
    marginBottom: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  ownerEmoji: { fontSize: 28, marginRight: 12 },
  ownerName: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  ownerDesa: { fontSize: 11, color: '#3B82F6', marginTop: 2 },
  publicPillBig: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  publicPillBigText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },

  // CARD
  card: {
    margin: 14,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 10 },
  req: { color: '#EF4444' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  inputReadOnly: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
    color: '#475569',
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 10, color: '#CBD5E1', textAlign: 'right', marginTop: 4 },

  // SYMBOL
  symbolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symbolItem: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  symbolSelected: { borderColor: '#0284C7', backgroundColor: 'rgba(2,132,199,0.1)' },
  symbolEmoji: { fontSize: 22 },
  symbolLabel: { fontSize: 9, color: '#64748B', marginTop: 4, fontWeight: '600' },
  readOnlySymbol: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readOnlySymbolLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

  // KOORDINAT
  coordActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  coordActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  coordBtnGps: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2,132,199,0.08)',
  },
  coordBtnLoading: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  coordBtnGpsText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 12,
  },
  coordBtnMap: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5,150,105,0.08)',
  },
  coordBtnMapText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 12,
  },
  accTxt: { fontSize: 11, color: '#22C55E', fontWeight: '600', marginBottom: 8 },
  accTxtWarn: { color: '#F59E0B' },
  coordRow: { flexDirection: 'row', gap: 12 },
  coordCell: { flex: 1 },
  coordSource: { fontSize: 11, color: '#94A3B8', marginTop: 8 },

  // MAP PREVIEW (inline dalam form)
  mapPreviewContainer: {
    marginTop: 14,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mapPreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  mapPreviewEditBtn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  mapPreview: {
    height: 200,
  },
  mapTypeRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  mapTypeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapTypeBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  mapTypeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  mapTypeBtnTextActive: {
    color: '#FFFFFF',
  },
  mapPreviewCoord: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    fontFamily: 'monospace',
  },
  navigateBtn: {
    backgroundColor: '#059669',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  noCoordHint: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  noCoordHintText: {
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 18,
    textAlign: 'center',
  },

  // FOTO
  fotoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addFotoBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addFotoBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  fotoThumb: { width: 90, height: 90, borderRadius: 12, marginRight: 10 },
  exifBadge: { fontSize: 9, color: '#22C55E', fontWeight: '700', textAlign: 'center', marginTop: 2 },
  noFoto: { color: '#94A3B8', fontSize: 12, textAlign: 'center', paddingVertical: 12 },

  // VISIBILITAS TOGGLE
  visibilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  visibilityBtnPublic: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  visibilityBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  visibilityBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  visibilityBtnSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  togglePillOn: {
    backgroundColor: '#3B82F6',
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // SIMPAN
  saveBtn: {
    margin: 14,
    backgroundColor: '#0284C7',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0284C7',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  saveBtnDisabled: { backgroundColor: '#94A3B8' },
  saveBtnTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },

  // MAP PICKER MODAL
  mapPickerHeader: {
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  mapPickerClose: {
    paddingRight: 12,
  },
  mapPickerCloseText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  mapPickerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  mapPickerSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  mapPickerConfirm: {
    paddingLeft: 12,
  },
  mapPickerConfirmText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '700',
  },
  mapPickerCoordInfo: {
    backgroundColor: '#0F172A',
    padding: 14,
    alignItems: 'center',
  },
  mapPickerCoordLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  mapPickerCoordValue: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginTop: 3,
  },
  mapPickerHint: {
    backgroundColor: '#0F172A',
    padding: 14,
    alignItems: 'center',
  },
  mapPickerHintText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  mapPickerTypeRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 14,
    paddingBottom: 20,
    gap: 8,
    justifyContent: 'center',
  },
});

export default PlacemarkForm;
