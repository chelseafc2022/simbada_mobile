/**
 * PlacemarkMap.js — Modul 5: Peta Semua Placemark
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';

const SYMBOL_EMOJI = {
  pin_merah:'📍', pin_biru:'📌', bangunan:'🏠', pohon:'🌳', air:'💧',
  jalan:'🛤', bahaya:'⚠️', temuan:'🔍', sampel:'🧪', fotografi:'📷',
  bintang:'⭐', titik:'●',
};

const PIN_COLOR = {
  pin_merah:'#EF4444', pin_biru:'#208DC0', bangunan:'#F59E0B',
  pohon:'#22C55E', air:'#06B6D4', jalan:'#94A3B8', bahaya:'#F97316',
  temuan:'#8B5CF6', sampel:'#EC4899', fotografi:'#0EA5E9',
  bintang:'#EAB308', titik:'#64748B',
};

const PlacemarkMap = ({ navigation, route }) => {
  const placemarks = route?.params?.placemarks ?? [];
  const mapRef = useRef(null);

  const region = useMemo(() => {
    if (!placemarks.length) return { latitude: -4.2, longitude: 122.35, latitudeDelta: 0.5, longitudeDelta: 0.5 };
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
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Peta Placemark ({placemarks.length})</Text>
      </LinearGradient>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {placemarks.map((pm) => (
          <Marker
            key={pm.id}
            coordinate={{ latitude: pm.lat, longitude: pm.lon }}
            pinColor={PIN_COLOR[pm.simbol] ?? '#208DC0'}
            title={pm.judul}
          >
            <Callout onPress={() => navigation.navigate('PlacemarkForm', { placemark: pm })}>
              <View style={styles.callout}>
                <Text style={styles.calloutEmoji}>{SYMBOL_EMOJI[pm.simbol] ?? '●'}</Text>
                <Text style={styles.calloutTitle} numberOfLines={2}>{pm.judul}</Text>
                <Text style={styles.calloutCoord}>{pm.lat.toFixed(5)}, {pm.lon.toFixed(5)}</Text>
                {pm.deskripsi ? <Text style={styles.calloutDesc} numberOfLines={2}>{pm.deskripsi}</Text> : null}
                <View style={styles.calloutActions}>
                  <Text style={styles.calloutEdit}>✏️ Edit</Text>
                  <TouchableOpacity onPress={() => {
                    navigation.navigate('NavigasiPlacemark');
                  }}>
                    <Text style={styles.calloutNav}>🧭 Navigasi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {placemarks.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>Belum ada placemark yang dibuat.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 },
  map: { flex: 1 },
  callout: { width: 200, padding: 12 },
  calloutEmoji: { fontSize: 24, textAlign: 'center' },
  calloutTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginTop: 4 },
  calloutCoord: { fontSize: 10, color: '#64748B', textAlign: 'center', fontFamily: 'monospace', marginTop: 2 },
  calloutDesc: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  calloutActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  calloutEdit: { fontSize: 13, color: '#208DC0', fontWeight: '700' },
  calloutNav: { fontSize: 13, color: '#22C55E', fontWeight: '700' },
  emptyOverlay: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 16, padding: 20, alignItems: 'center',
  },
  emptyText: { color: '#64748B', fontSize: 14 },
});

export default PlacemarkMap;
