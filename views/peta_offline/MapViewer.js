/**
 * MapViewer.js — Modul 1: Viewer Peta Offline dengan GeoTIFF Engine, Digitasi Polygon/Polyline,
 * Kalkulasi Luas Geodesik (m² & Ha), Manajemen Layer (Impor/Ekspor GeoJSON), dan Navigasi Titik Target.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  Modal, TextInput, ScrollView, Switch, FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import moment from 'moment';
import TelemetriPanel from '../telemetri/TelemetriPanel';
import OfflineLayerDB from '../library/OfflineLayerDB';

const fmtDist = (m) => {
  if (m == null) return '--';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
};

const getBearingText = (deg) => {
  if (deg == null) return '--';
  const directions = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  const idx = Math.round(deg / 45) % 8;
  return `${deg}° (${directions[idx]})`;
};

const MapViewer = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const mapMeta = route?.params?.map ?? null;
  const currentPos = useSelector(s => s.CURRENT_POSITION);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [telemetriVisible, setTelemetriVisible] = useState(false);
  const [mapBounds, setMapBounds] = useState(mapMeta?.bounds ?? null);

  // Mode Gambar & Navigasi
  const [drawMode, setDrawMode] = useState('NONE'); // 'NONE' | 'POLYGON' | 'POLYLINE' | 'NAV_TARGET'
  const [drawingMetrics, setDrawingMetrics] = useState({
    pointsCount: 0,
    coordinates: [],
    areaM2: 0,
    areaHa: 0,
    perimeterM: 0,
    lengthM: 0,
  });
  const [navState, setNavState] = useState({
    active: false,
    target: null,
    distance: null,
    bearing: null,
  });

  // Layer Tersimpan & Modals
  const [savedLayers, setSavedLayers] = useState([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [layerName, setLayerName] = useState('');
  const [layerNotes, setLayerNotes] = useState('');
  const [layersModalVisible, setLayersModalVisible] = useState(false);

  const webviewRef = useRef(null);
  const isPdf = mapMeta?.path?.toLowerCase().endsWith('.pdf') || mapMeta?.format === 'geopdf';

  // Ambil layer tersimpan dan sinkronkan ke webview
  const refreshSavedLayers = useCallback(async () => {
    try {
      const list = await OfflineLayerDB.getAll(mapMeta?.id);
      setSavedLayers(list);
      const msg = JSON.stringify({ type: 'LOAD_LAYERS', layers: list });
      webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
    } catch (e) {
      console.warn('[MapViewer] refreshSavedLayers error:', e);
    }
  }, [mapMeta]);

  // Kirim peta ke WebView setelah loaded
  const loadMap = useCallback(async () => {
    if (!mapMeta?.path) return;
    try {
      const exists = await RNFS.exists(mapMeta.path);
      if (!exists) {
        setLoadError('File peta tidak ditemukan. Mungkin sudah dihapus.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      const base64 = await RNFS.readFile(mapMeta.path, 'base64');
      const isPdfFile = mapMeta.path.toLowerCase().endsWith('.pdf') || mapMeta.format === 'geopdf';
      const msg = JSON.stringify({
        type: isPdfFile ? 'LOAD_GEOPDF' : 'LOAD_GEOTIFF',
        base64,
        name: mapMeta.nama,
      });
      webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
    } catch (e) {
      setLoadError(`Gagal membaca file: ${e.message}`);
      setIsLoading(false);
    }
  }, [mapMeta]);

  // Terima pesan dari WebView
  const handleWebViewMessage = useCallback(async (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'BOUNDS_EXTRACTED') {
        const bounds = msg.bounds;
        setMapBounds(bounds);
        setIsLoading(false);
        if (currentPos && webviewRef.current) {
          const posMsg = JSON.stringify({ type: 'UPDATE_POSITION', lat: currentPos.lat, lon: currentPos.lon });
          webviewRef.current.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(posMsg)} }); true;`);
        }
        if (mapMeta) {
          const updated = { ...mapMeta, bounds };
          const KEY_MAPS = 'IMPORTED_MAPS';
          const raw = await AsyncStorage.getItem(KEY_MAPS);
          if (raw) {
            const list = JSON.parse(raw).map(m => m.id === mapMeta.id ? updated : m);
            await AsyncStorage.setItem(KEY_MAPS, JSON.stringify(list));
          }
          dispatch({ type: 'SET_ACTIVE_MAP', payload: updated });
        }
        refreshSavedLayers();
      } else if (msg.type === 'LOAD_ERROR') {
        setLoadError(msg.message);
        setIsLoading(false);
      } else if (msg.type === 'DRAWING_UPDATE') {
        setDrawingMetrics({
          pointsCount: msg.pointsCount,
          coordinates: msg.coordinates || [],
          areaM2: msg.areaM2 || 0,
          areaHa: msg.areaHa || 0,
          perimeterM: msg.perimeterM || 0,
          lengthM: msg.lengthM || 0,
        });
      } else if (msg.type === 'DRAWING_CLEARED') {
        setDrawingMetrics({
          pointsCount: 0,
          coordinates: [],
          areaM2: 0,
          areaHa: 0,
          perimeterM: 0,
          lengthM: 0,
        });
      } else if (msg.type === 'NAV_UPDATE') {
        setNavState({
          active: true,
          target: msg.target,
          distance: msg.distance,
          bearing: msg.bearing,
        });
      } else if (msg.type === 'NAV_STOPPED') {
        setNavState({
          active: false,
          target: null,
          distance: null,
          bearing: null,
        });
      } else if (msg.type === 'MODE_CHANGED') {
        setDrawMode(msg.mode);
      }
    } catch {}
  }, [mapMeta, currentPos, dispatch, refreshSavedLayers]);

  // Update posisi di peta setiap ada update GPS
  useEffect(() => {
    if (!currentPos || !webviewRef.current) return;
    const msg = JSON.stringify({ type: 'UPDATE_POSITION', lat: currentPos.lat, lon: currentPos.lon });
    webviewRef.current.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
  }, [currentPos]);

  const flyToMyLocation = () => {
    if (!currentPos) { Alert.alert('GPS', 'Posisi GPS belum tersedia.'); return; }
    const msg = JSON.stringify({ type: 'FLY_TO', lat: currentPos.lat, lon: currentPos.lon, zoom: 15 });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
  };

  // -------------------------------------------------------------
  // HANDLERS GAMBAR & NAVIGASI
  // -------------------------------------------------------------
  const switchDrawMode = (mode) => {
    const nextMode = drawMode === mode ? 'NONE' : mode;
    setDrawMode(nextMode);
    const msg = JSON.stringify({ type: 'SET_DRAW_MODE', mode: nextMode });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
    if (nextMode === 'NAV_TARGET') {
      Alert.alert('Mode Navigasi', 'Ketuk titik mana saja pada peta untuk menentukan titik tujuan navigasi.');
    }
  };

  const handleAddGpsPoint = () => {
    if (!currentPos) {
      Alert.alert('GPS Belum Siap', 'Koordinat GPS perangkat belum tersedia.');
      return;
    }
    const msg = JSON.stringify({ type: 'ADD_GPS_POINT', lat: currentPos.lat, lon: currentPos.lon });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
  };

  const handleUndoPoint = () => {
    const msg = JSON.stringify({ type: 'UNDO_POINT' });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
  };

  const handleCancelDrawing = () => {
    const msg = JSON.stringify({ type: 'CLEAR_DRAWING' });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
    switchDrawMode('NONE');
  };

  const handleOpenSaveModal = () => {
    if (drawMode === 'POLYGON' && drawingMetrics.pointsCount < 3) {
      Alert.alert('Titik Kurang', 'Poligon membutuhkan minimal 3 titik sudut.');
      return;
    }
    if (drawMode === 'POLYLINE' && drawingMetrics.pointsCount < 2) {
      Alert.alert('Titik Kurang', 'Polyline membutuhkan minimal 2 titik garis.');
      return;
    }
    const prefix = drawMode === 'POLYGON' ? 'Batas Lahan' : 'Jalur Batas';
    setLayerName(`${prefix} ${mapMeta?.nama || ''} ${moment().format('DD/MM HH:mm')}`);
    setLayerNotes('');
    setSaveModalVisible(true);
  };

  const handleSaveLayer = async () => {
    if (!layerName.trim()) {
      Alert.alert('Nama Wajib Diisi', 'Silakan beri nama untuk objek gambar ini.');
      return;
    }
    try {
      await OfflineLayerDB.save({
        mapId: mapMeta?.id || null,
        mapName: mapMeta?.nama || 'Peta Offline',
        name: layerName.trim(),
        notes: layerNotes.trim(),
        type: drawMode.toLowerCase(),
        coordinates: drawingMetrics.coordinates,
        areaM2: drawingMetrics.areaM2,
        areaHa: drawingMetrics.areaHa,
        perimeterM: drawingMetrics.perimeterM,
        lengthM: drawingMetrics.lengthM,
        color: drawMode === 'POLYGON' ? '#06B6D4' : '#F59E0B',
      });
      setSaveModalVisible(false);
      handleCancelDrawing();
      await refreshSavedLayers();
      Alert.alert('Tersimpan!', `Layer "${layerName.trim()}" berhasil disimpan ke layer lapangan.`);
    } catch (e) {
      Alert.alert('Gagal Menyimpan', e.message);
    }
  };

  const handleStopNavigation = () => {
    const msg = JSON.stringify({ type: 'STOP_NAV' });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
    setNavState({ active: false, target: null, distance: null, bearing: null });
  };

  const handleImportGeoJSON = async () => {
    try {
      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });
      if (!res?.fileCopyUri && !res?.uri) return;
      const targetUri = res.fileCopyUri || res.uri;
      const path = decodeURIComponent(targetUri.replace(/^file:\/\//, ''));
      const content = await RNFS.readFile(path, 'utf8');

      const saved = await OfflineLayerDB.importFromGeoJsonText(content, mapMeta?.id, mapMeta?.nama);
      await refreshSavedLayers();
      Alert.alert('Impor Berhasil', `Berhasil mengimpor ${saved.length} objek ke dalam layer peta.`);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert('Gagal Impor', e.message);
      }
    }
  };

  const handleToggleLayerVisibility = async (id) => {
    await OfflineLayerDB.toggleVisibility(id);
    await refreshSavedLayers();
  };

  const handleDeleteLayer = (id, name) => {
    Alert.alert('Hapus Layer', `Yakin ingin menghapus "${name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await OfflineLayerDB.delete(id);
          await refreshSavedLayers();
        },
      },
    ]);
  };

  const handleExportLayer = async (layer) => {
    try {
      await OfflineLayerDB.exportToGeoJson(layer);
    } catch (e) {
      Alert.alert('Gagal Ekspor', e.message);
    }
  };

  const handleExportAllLayers = async () => {
    try {
      await OfflineLayerDB.exportToGeoJson(savedLayers);
    } catch (e) {
      Alert.alert('Gagal Ekspor', e.message);
    }
  };

  const handleNavToLayer = (layer) => {
    if (!layer.coordinates || !layer.coordinates.length) return;
    let target;
    if (layer.type === 'polygon') {
      let latSum = 0, lonSum = 0;
      layer.coordinates.forEach(c => {
        latSum += (c.lat || c[0]);
        lonSum += (c.lon || c[1]);
      });
      target = { lat: latSum / layer.coordinates.length, lon: lonSum / layer.coordinates.length };
    } else {
      const first = layer.coordinates[0];
      target = { lat: first.lat || first[0], lon: first.lon || first[1] };
    }

    const msg = JSON.stringify({ type: 'SET_NAV_TARGET', lat: target.lat, lon: target.lon });
    webviewRef.current?.injectJavaScript(`handleRNMessage({ data: ${JSON.stringify(msg)} }); true;`);
    setLayersModalVisible(false);
    setNavState({ active: true, target, distance: null, bearing: null });
    Alert.alert('Navigasi Dimulai', `Memandu menuju titik ${layer.name}`);
  };

  const isOutside = mapBounds && currentPos && (
    currentPos.lat < mapBounds.minLat || currentPos.lat > mapBounds.maxLat ||
    currentPos.lon < mapBounds.minLon || currentPos.lon > mapBounds.maxLon
  );

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{mapMeta?.nama ?? 'Peta Offline'}</Text>
        <View style={styles.headerRightSpacer} />
      </LinearGradient>

      {/* Banner di luar bounds */}
      {isOutside && (
        <View style={styles.outsideBanner}>
          <Text style={styles.outsideTxt}>⚠ Posisi GPS di luar area peta ini</Text>
        </View>
      )}

      {/* WebView Peta */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          source={{ uri: 'file:///android_asset/offline_map.html' }}
          style={styles.webview}
          onLoad={loadMap}
          onMessage={handleWebViewMessage}
          onError={(e) => setLoadError(e.nativeEvent.description)}
          javaScriptEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          mixedContentMode="always"
          originWhitelist={['*']}
          scrollEnabled={false}
        />

        {/* Floating Toolbar: Gambar & Navigasi */}
        <View style={styles.floatingToolbar}>
          <TouchableOpacity
            style={[styles.toolBtn, drawMode === 'POLYGON' && styles.toolBtnActivePolygon]}
            onPress={() => switchDrawMode('POLYGON')}
          >
            <Text style={styles.toolIcon}>⬡</Text>
            <Text style={[styles.toolTxt, drawMode === 'POLYGON' && styles.toolTxtActive]}>Polygon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, drawMode === 'POLYLINE' && styles.toolBtnActivePolyline]}
            onPress={() => switchDrawMode('POLYLINE')}
          >
            <Text style={styles.toolIcon}>〰️</Text>
            <Text style={[styles.toolTxt, drawMode === 'POLYLINE' && styles.toolTxtActive]}>Garis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, (drawMode === 'NAV_TARGET' || navState.active) && styles.toolBtnActiveNav]}
            onPress={() => switchDrawMode('NAV_TARGET')}
          >
            <Text style={styles.toolIcon}>🎯</Text>
            <Text style={[styles.toolTxt, (drawMode === 'NAV_TARGET' || navState.active) && styles.toolTxtActive]}>Navigasi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setLayersModalVisible(true)}
          >
            <Text style={styles.toolIcon}>📂</Text>
            <Text style={styles.toolTxt}>Layer ({savedLayers.length})</Text>
          </TouchableOpacity>
        </View>

        {/* HUD Real-Time: Digitasi Polygon / Polyline */}
        {(drawMode === 'POLYGON' || drawMode === 'POLYLINE') && (
          <View style={styles.drawingHud}>
            <View style={styles.drawingHudHeader}>
              <Text style={styles.drawingHudTitle}>
                {drawMode === 'POLYGON' ? '🔷 DIGITASI POLIGON (LAHAN)' : '〰️ DIGITASI POLYLINE (GARIS/RUTE)'}
              </Text>
              <Text style={styles.drawingHudSub}>Ketuk layar peta untuk menambah titik sudut</Text>
            </View>

            {/* Metrik Real-Time */}
            <View style={styles.metricsRow}>
              {drawMode === 'POLYGON' ? (
                <>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>LUAS (m²)</Text>
                    <Text style={styles.metricVal}>{drawingMetrics.areaM2.toLocaleString('id-ID')} m²</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>LUAS (HEKTAR)</Text>
                    <Text style={[styles.metricVal, { color: '#22C55E' }]}>{drawingMetrics.areaHa} ha</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>KELILING</Text>
                    <Text style={styles.metricVal}>{drawingMetrics.perimeterM.toLocaleString('id-ID')} m</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>PANJANG TOTAL</Text>
                    <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{fmtDist(drawingMetrics.lengthM)}</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>JUMLAH TITIK</Text>
                    <Text style={styles.metricVal}>{drawingMetrics.pointsCount} titik</Text>
                  </View>
                </>
              )}
            </View>

            {/* Tombol Aksi */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity style={styles.actBtnGps} onPress={handleAddGpsPoint}>
                <Text style={styles.actBtnTxt}>📍 + Titik GPS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actBtnUndo, drawingMetrics.pointsCount === 0 && { opacity: 0.5 }]}
                onPress={handleUndoPoint}
                disabled={drawingMetrics.pointsCount === 0}
              >
                <Text style={styles.actBtnTxt}>↩ Undo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actBtnSave, (drawMode === 'POLYGON' ? drawingMetrics.pointsCount < 3 : drawingMetrics.pointsCount < 2) && { opacity: 0.5 }]}
                onPress={handleOpenSaveModal}
              >
                <Text style={styles.actBtnTxt}>💾 Simpan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtnCancel} onPress={handleCancelDrawing}>
                <Text style={styles.actBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* HUD Real-Time: Navigasi ke Titik Target */}
        {navState.active && (
          <View style={styles.navHud}>
            <View style={styles.navHudHeader}>
              <Text style={styles.navHudTitle}>🎯 PANDUAN NAVIGASI KE TARGET</Text>
              <TouchableOpacity onPress={handleStopNavigation} style={styles.stopNavBtn}>
                <Text style={styles.stopNavTxt}>✕ Hentikan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.navMetricsRow}>
              <View style={styles.navMetricItem}>
                <Text style={styles.navMetricLbl}>JARAK SISA</Text>
                <Text style={styles.navMetricVal}>{fmtDist(navState.distance)}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.navMetricItem}>
                <Text style={styles.navMetricLbl}>ARAH KOMPAS</Text>
                <Text style={styles.navMetricVal}>{getBearingText(navState.bearing)}</Text>
              </View>
            </View>
            {navState.target && (
              <Text style={styles.navCoordTxt}>
                Target: {navState.target.lat.toFixed(6)}, {navState.target.lon.toFixed(6)}
              </Text>
            )}
          </View>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#208DC0" />
            <Text style={styles.loadingTxt}>{isPdf ? 'Memuat GeoPDF...' : 'Memuat GeoTIFF...'}</Text>
          </View>
        )}

        {/* Error overlay */}
        {loadError && !isLoading && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTxt}>⚠ {loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadMap}>
              <Text style={styles.retryTxt}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tombol Posisi Saya */}
        <TouchableOpacity style={styles.myLocBtn} onPress={flyToMyLocation}>
          <Text style={styles.myLocTxt}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* Panel Telemetri Collapsible */}
      <View style={[styles.telemetriContainer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={styles.telemetriToggleBtn}
          onPress={() => setTelemetriVisible(!telemetriVisible)}
          activeOpacity={0.7}
        >
          <Text style={styles.telemetriToggle}>{telemetriVisible ? '▼ Sembunyikan GPS' : '▲ Tampilkan GPS'}</Text>
        </TouchableOpacity>
        {telemetriVisible && (
          <TelemetriPanel compact={false} showBoundsAlert={!!mapBounds} />
        )}
      </View>

      {/* MODAL SIMPAN LAYER */}
      <Modal visible={saveModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💾 Simpan Objek Lapangan</Text>
            <Text style={styles.modalSub}>
              Tipe: <Text style={{ color: '#38BDF8', fontWeight: 'bold' }}>{drawMode === 'POLYGON' ? 'Polygon (Bidang/Lahan)' : 'Polyline (Garis/Rute)'}</Text>
            </Text>

            <View style={styles.modalMetricsCard}>
              {drawMode === 'POLYGON' ? (
                <>
                  <Text style={styles.modalMetricsTxt}>📐 Luas: <Text style={{ fontWeight: 'bold', color: '#fff' }}>{drawingMetrics.areaM2.toLocaleString('id-ID')} m²</Text></Text>
                  <Text style={styles.modalMetricsTxt}>🌿 Hektar: <Text style={{ fontWeight: 'bold', color: '#22C55E' }}>{drawingMetrics.areaHa} ha</Text></Text>
                  <Text style={styles.modalMetricsTxt}>📏 Keliling: <Text style={{ fontWeight: 'bold', color: '#fff' }}>{drawingMetrics.perimeterM.toLocaleString('id-ID')} m</Text></Text>
                </>
              ) : (
                <Text style={styles.modalMetricsTxt}>📏 Panjang: <Text style={{ fontWeight: 'bold', color: '#F59E0B' }}>{fmtDist(drawingMetrics.lengthM)}</Text></Text>
              )}
            </View>

            <Text style={styles.inputLabel}>Nama Objek / Lahan *</Text>
            <TextInput
              style={styles.textInput}
              value={layerName}
              onChangeText={setLayerName}
              placeholder="Contoh: Batas Lahan Blok A"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Catatan / Keterangan (Opsional)</Text>
            <TextInput
              style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
              value={layerNotes}
              onChangeText={setLayerNotes}
              placeholder="Catatan batas patok atau nama pemilik..."
              placeholderTextColor="#64748B"
              multiline
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSaveModalVisible(false)}>
                <Text style={styles.modalCancelTxt}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveLayer}>
                <Text style={styles.modalSubmitTxt}>Simpan Layer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL MANAJEMEN LAYER & IMPOR */}
      <Modal visible={layersModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.layersHeader}>
              <Text style={styles.modalTitle}>📂 Layer Lapangan ({savedLayers.length})</Text>
              <TouchableOpacity onPress={() => setLayersModalVisible(false)}>
                <Text style={styles.closeModalTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.importExportBar}>
              <TouchableOpacity style={styles.importBtn} onPress={handleImportGeoJSON}>
                <Text style={styles.importBtnTxt}>📥 Impor GeoJSON</Text>
              </TouchableOpacity>
              {savedLayers.length > 0 && (
                <TouchableOpacity style={styles.exportAllBtn} onPress={handleExportAllLayers}>
                  <Text style={styles.exportAllBtnTxt}>📤 Ekspor Semua</Text>
                </TouchableOpacity>
              )}
            </View>

            {savedLayers.length === 0 ? (
              <View style={styles.emptyLayersBox}>
                <Text style={styles.emptyLayersTxt}>Belum ada layer hasil gambar tersimpan.</Text>
                <Text style={styles.emptyLayersSub}>Gunakan menu Polygon atau Garis di toolbar untuk mulai menggambar batas lahan di atas peta offline.</Text>
              </View>
            ) : (
              <FlatList
                data={savedLayers}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.layerCard}>
                    <View style={styles.layerCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.layerName}>{item.name}</Text>
                        <Text style={styles.layerType}>
                          {item.type === 'polygon' ? `🔷 Polygon • ${item.areaM2?.toLocaleString('id-ID')} m² (${item.areaHa} ha)` : `〰️ Polyline • ${fmtDist(item.lengthM)}`}
                        </Text>
                      </View>
                      <Switch
                        value={item.visible !== false}
                        onValueChange={() => handleToggleLayerVisibility(item.id)}
                        thumbColor={item.visible !== false ? '#06B6D4' : '#64748B'}
                      />
                    </View>
                    {item.notes ? <Text style={styles.layerNotes}>{item.notes}</Text> : null}

                    <View style={styles.layerActionRow}>
                      <TouchableOpacity style={styles.layerActBtn} onPress={() => handleNavToLayer(item)}>
                        <Text style={styles.layerActTxt}>🎯 Navigasi</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.layerActBtn} onPress={() => handleExportLayer(item)}>
                        <Text style={styles.layerActTxt}>📤 Bagikan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.layerActBtn, { borderColor: '#EF4444' }]} onPress={() => handleDeleteLayer(item.id, item.name)}>
                        <Text style={[styles.layerActTxt, { color: '#EF4444' }]}>🗑️ Hapus</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    paddingBottom: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { paddingVertical: 4 },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerRightSpacer: { width: 60 },
  outsideBanner: {
    backgroundColor: '#EF4444', paddingVertical: 6, paddingHorizontal: 16,
    alignItems: 'center',
  },
  outsideTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  mapContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1 },

  // Floating Toolbar
  floatingToolbar: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 24, padding: 4, gap: 4,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8,
  },
  toolBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 6, borderRadius: 20, gap: 4,
  },
  toolBtnActivePolygon: { backgroundColor: 'rgba(6, 182, 212, 0.25)', borderWidth: 1, borderColor: '#06B6D4' },
  toolBtnActivePolyline: { backgroundColor: 'rgba(245, 158, 11, 0.25)', borderWidth: 1, borderColor: '#F59E0B' },
  toolBtnActiveNav: { backgroundColor: 'rgba(16, 185, 129, 0.25)', borderWidth: 1, borderColor: '#10B981' },
  toolIcon: { fontSize: 14 },
  toolTxt: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  toolTxtActive: { color: '#fff' },

  // Drawing HUD Card
  drawingHud: {
    position: 'absolute', bottom: 16, left: 12, right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10,
  },
  drawingHudHeader: { marginBottom: 8 },
  drawingHudTitle: { color: '#38BDF8', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  drawingHudSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  metricsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, marginVertical: 8,
  },
  metricItem: { alignItems: 'center' },
  metricLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  metricVal: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 2 },
  metricDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  actionBtnRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  actBtnGps: { flex: 1.5, backgroundColor: '#0284C7', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actBtnUndo: { flex: 1, backgroundColor: '#475569', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actBtnSave: { flex: 1.3, backgroundColor: '#10B981', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actBtnCancel: { width: 36, backgroundColor: '#EF4444', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Navigation HUD
  navHud: {
    position: 'absolute', top: 68, left: 12, right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: '#10B981',
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10,
  },
  navHudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navHudTitle: { color: '#10B981', fontSize: 11, fontWeight: '800' },
  stopNavBtn: { backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444' },
  stopNavTxt: { color: '#EF4444', fontSize: 10, fontWeight: '700' },
  navMetricsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  navMetricItem: { alignItems: 'center' },
  navMetricLbl: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  navMetricVal: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 2 },
  navCoordTxt: { color: '#64748B', fontSize: 10, textAlign: 'center' },

  // Overlay & Buttons
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingTxt: { color: '#94A3B8', marginTop: 12, fontSize: 14 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center', padding: 30,
  },
  errorTxt: { color: '#FCA5A5', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: 16, backgroundColor: '#208DC0', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryTxt: { color: '#fff', fontWeight: '700' },
  myLocBtn: {
    position: 'absolute', right: 16, bottom: 20, width: 48, height: 48,
    backgroundColor: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  myLocTxt: { fontSize: 22 },

  // Telemetri
  telemetriContainer: {
    backgroundColor: '#1E293B', maxHeight: 280,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  telemetriToggleBtn: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  telemetriToggle: { textAlign: 'center', color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalSub: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 12 },
  modalMetricsCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10, marginBottom: 14, gap: 4 },
  modalMetricsTxt: { color: '#94A3B8', fontSize: 12 },
  inputLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  textInput: {
    backgroundColor: '#0F172A', color: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancelBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalCancelTxt: { color: '#CBD5E1', fontWeight: '700' },
  modalSubmitBtn: { flex: 1.5, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSubmitTxt: { color: '#fff', fontWeight: '800' },

  // Layer Modal Items
  layersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeModalTxt: { color: '#94A3B8', fontSize: 18, fontWeight: 'bold' },
  importExportBar: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  importBtn: { flex: 1, backgroundColor: '#0284C7', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  importBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  exportAllBtn: { flex: 1, backgroundColor: '#6366F1', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  exportAllBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyLayersBox: { paddingVertical: 30, alignItems: 'center' },
  emptyLayersTxt: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  emptyLayersSub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  layerCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  layerCardHeader: { flexDirection: 'row', alignItems: 'center' },
  layerName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  layerType: { color: '#38BDF8', fontSize: 11, marginTop: 2 },
  layerNotes: { color: '#94A3B8', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  layerActionRow: { flexDirection: 'row', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8 },
  layerActBtn: {
    paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  layerActTxt: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
});

export default MapViewer;
