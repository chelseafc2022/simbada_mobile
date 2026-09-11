/**
 * MapViewer.js — Modul 1: Viewer Peta Offline dengan GeoTIFF Engine
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import TelemetriPanel from '../telemetri/TelemetriPanel';

const MapViewer = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const mapMeta = route?.params?.map ?? null;
  const currentPos = useSelector(s => s.CURRENT_POSITION);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [telemetriVisible, setTelemetriVisible] = useState(true);
  const [mapBounds, setMapBounds] = useState(mapMeta?.bounds ?? null);

  const webviewRef = useRef(null);

  // Kirim GeoTIFF ke WebView setelah loaded
  const loadGeoTIFF = useCallback(async () => {
    if (!mapMeta?.path) return;
    try {
      // Validasi file masih ada
      const exists = await RNFS.exists(mapMeta.path);
      if (!exists) {
        setLoadError('File peta tidak ditemukan. Mungkin sudah dihapus.');
        return;
      }
      setIsLoading(true);
      const base64 = await RNFS.readFile(mapMeta.path, 'base64');
      const msg = JSON.stringify({ type: 'LOAD_GEOTIFF', base64, name: mapMeta.nama });
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
        // Update metadata bounds di storage
        if (mapMeta) {
          const updated = { ...mapMeta, bounds };
          const KEY_MAPS = 'IMPORTED_MAPS';
          const raw = await AsyncStorage.getItem(KEY_MAPS);
          if (raw) {
            const list = JSON.parse(raw).map(m => m.id === mapMeta.id ? updated : m);
            await AsyncStorage.setItem(KEY_MAPS, JSON.stringify(list));
          }
          // Jika ini peta aktif, update redux juga
          dispatch({ type: 'SET_ACTIVE_MAP', payload: updated });
        }
      } else if (msg.type === 'LOAD_ERROR') {
        setLoadError(msg.message);
        setIsLoading(false);
      }
    } catch {}
  }, [mapMeta]);

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

  const isOutside = mapBounds && currentPos && (
    currentPos.lat < mapBounds.minLat || currentPos.lat > mapBounds.maxLat ||
    currentPos.lon < mapBounds.minLon || currentPos.lon > mapBounds.maxLon
  );

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{mapMeta?.nama ?? 'Peta Offline'}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PlacemarkForm', {})}>
          <Text style={styles.addPm}>+ Placemark</Text>
        </TouchableOpacity>
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
          onLoad={loadGeoTIFF}
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

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#208DC0" />
            <Text style={styles.loadingTxt}>Memuat GeoTIFF...</Text>
          </View>
        )}

        {/* Error overlay */}
        {loadError && !isLoading && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTxt}>⚠ {loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadGeoTIFF}>
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
      <View style={styles.telemetriContainer}>
        <TouchableOpacity onPress={() => setTelemetriVisible(!telemetriVisible)}>
          <Text style={styles.telemetriToggle}>{telemetriVisible ? '▼ Sembunyikan GPS' : '▲ Tampilkan GPS'}</Text>
        </TouchableOpacity>
        {telemetriVisible && (
          <TelemetriPanel compact={false} showBoundsAlert={!!mapBounds} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 },
  addPm: { color: '#22C55E', fontSize: 13, fontWeight: '700' },
  outsideBanner: {
    backgroundColor: '#EF4444', paddingVertical: 6, paddingHorizontal: 16,
    alignItems: 'center',
  },
  outsideTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  mapContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
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
    position: 'absolute', right: 16, bottom: 16, width: 48, height: 48,
    backgroundColor: '#fff', borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  myLocTxt: { fontSize: 22 },
  telemetriContainer: { maxHeight: 220 },
  telemetriToggle: {
    textAlign: 'center', color: '#64748B', fontSize: 11, paddingVertical: 6,
    backgroundColor: '#1E293B', fontWeight: '700', letterSpacing: 0.5,
  },
});

export default MapViewer;
