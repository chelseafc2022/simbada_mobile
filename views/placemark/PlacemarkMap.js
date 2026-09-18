/**
 * PlacemarkMap.js — Modul 5: Peta Semua Placemark (Redesign)
 *
 * Perubahan:
 * - Header disamakan dengan halaman lain (blue appbar modern)
 * - Tampilkan info pemilik di callout jika placemark publik dari user lain
 * - Layer selector (satelit/jalan/medan)
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MapView, { Marker, Callout } from 'react-native-maps';

const SYMBOL_EMOJI = {
  pin_merah:'📍', pin_biru:'📌', bangunan:'🏠', pohon:'🌳', air:'💧',
  jalan:'🛤', bahaya:'⚠️', temuan:'🔍', sampel:'🧪', fotografi:'📷',
  bintang:'⭐', titik:'●',
};

const PIN_COLOR = {
  pin_merah:'#EF4444', pin_biru:'#0284C7', bangunan:'#F59E0B',
  pohon:'#22C55E', air:'#06B6D4', jalan:'#94A3B8', bahaya:'#F97316',
  temuan:'#8B5CF6', sampel:'#EC4899', fotografi:'#0EA5E9',
  bintang:'#EAB308', titik:'#64748B',
};

const MAP_TYPES = [
  { id: 'satellite', label: '🛰 Satelit' },
  { id: 'standard', label: '🗺 Jalan' },
  { id: 'terrain', label: '🏔 Medan' },
];

const PlacemarkMap = ({ navigation, route }) => {
  const placemarks = route?.params?.placemarks ?? [];
  const mapRef = useRef(null);
  const [mapType, setMapType] = useState('satellite');

  const region = useMemo(() => {
    if (!placemarks.length)
      return { latitude: -4.2, longitude: 122.35, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    const lats = placemarks.map(p => p.lat);
    const lons = placemarks.map(p => p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.005) * 1.5,
      longitudeDelta: Math.max(maxLon - minLon, 0.005) * 1.5,
    };
  }, [placemarks]);

  return (
    <View style={styles.screen}>
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
          <Text style={styles.headerTitle}>📍 Peta Placemark</Text>
        </View>
        <View style={{ flex: 1 }} />
      </View>

      {/* LAYER SELECTOR */}
      <View style={styles.layerBar}>
        {MAP_TYPES.map(lt => (
          <TouchableOpacity
            key={lt.id}
            style={[styles.layerBtn, mapType === lt.id && styles.layerBtnActive]}
            onPress={() => setMapType(lt.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.layerBtnText, mapType === lt.id && styles.layerBtnTextActive]}>
              {lt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider="google"
        mapType={mapType}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {placemarks.map((pm) => (
          <Marker
            key={pm.id}
            coordinate={{ latitude: pm.lat, longitude: pm.lon }}
            pinColor={PIN_COLOR[pm.simbol] ?? '#0284C7'}
            title={pm.judul}
          >
            <Callout onPress={() => navigation.navigate('PlacemarkForm', { placemark: pm, readOnly: !!pm.ownerInfo && pm.userId !== null })}>
              <View style={styles.callout}>
                <Text style={styles.calloutEmoji}>{SYMBOL_EMOJI[pm.simbol] ?? '●'}</Text>
                <Text style={styles.calloutTitle} numberOfLines={2}>{pm.judul}</Text>
                <Text style={styles.calloutCoord}>
                  {pm.lat.toFixed(5)}, {pm.lon.toFixed(5)}
                </Text>
                {pm.deskripsi ? (
                  <Text style={styles.calloutDesc} numberOfLines={2}>{pm.deskripsi}</Text>
                ) : null}
                {/* Info pemilik jika placemark publik */}
                {pm.ownerInfo && (
                  <View style={styles.calloutOwner}>
                    <Text style={styles.calloutOwnerText}>
                      👤 {pm.ownerInfo.nama || 'Pengguna Lain'}
                      {pm.ownerInfo.desa ? `  ·  ${pm.ownerInfo.desa}` : ''}
                    </Text>
                  </View>
                )}
                {pm.isPublic && !pm.ownerInfo && (
                  <Text style={styles.calloutPublic}>🌐 Placemark Publik</Text>
                )}
                <View style={styles.calloutActions}>
                  <Text style={styles.calloutEdit}>✏️ Detail</Text>
                  <Text style={styles.calloutNav}>🧭 Navigasi</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {placemarks.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>📍 Belum ada placemark yang dibuat.</Text>
        </View>
      )}

      {/* Badge count */}
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>📍 {placemarks.length} Titik</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },

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

  // LAYER BAR
  layerBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  layerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerBtnActive: {
    backgroundColor: '#208DC0',
    borderColor: '#208DC0',
  },
  layerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  layerBtnTextActive: {
    color: '#FFFFFF',
  },

  map: { flex: 1 },

  // CALLOUT
  callout: { width: 200, padding: 12 },
  calloutEmoji: { fontSize: 24, textAlign: 'center' },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 4,
  },
  calloutCoord: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  calloutDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  calloutOwner: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  calloutOwnerText: {
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '600',
    textAlign: 'center',
  },
  calloutPublic: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  calloutActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  calloutEdit: { fontSize: 13, color: '#0284C7', fontWeight: '700' },
  calloutNav: { fontSize: 13, color: '#22C55E', fontWeight: '700' },

  // EMPTY OVERLAY
  emptyOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    elevation: 6,
  },
  emptyText: { color: '#64748B', fontSize: 14 },

  // COUNT BADGE
  countBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(2,132,199,0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 5,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default PlacemarkMap;
