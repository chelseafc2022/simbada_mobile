/**
 * NavigasiPlacemark.js — Modul 4: Navigasi ke Placemark Tersimpan
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import CompassView from './CompassView';
import PlacemarkDB from '../library/PlacemarkDB';

const DEG = Math.PI / 180, RAD = 180 / Math.PI, R = 6371000;

const haversine = (la1, lo1, la2, lo2) => {
  const dLat = (la2 - la1) * DEG, dLon = (lo2 - lo1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * DEG) * Math.cos(la2 * DEG) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const bearingTo = (la1, lo1, la2, lo2) => {
  const dLon = (lo2 - lo1) * DEG;
  const y = Math.sin(dLon) * Math.cos(la2 * DEG);
  const x = Math.cos(la1 * DEG) * Math.sin(la2 * DEG) - Math.sin(la1 * DEG) * Math.cos(la2 * DEG) * Math.cos(dLon);
  return ((Math.atan2(y, x) * RAD) + 360) % 360;
};

const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

const NavigasiPlacemark = ({ navigation }) => {
  const [placemarks, setPlacemarks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const watchIdRef = useRef(null);
  const sensorRef = useRef(null);

  useFocusEffect(useCallback(() => {
    PlacemarkDB.getAll().then(list => {
      setPlacemarks(list);
      setFiltered(list);
    });
    // Posisi awal
    Geolocation.getCurrentPosition(
      ({ coords }) => setCurrentPos({ lat: coords.latitude, lon: coords.longitude }),
      err => console.warn('[NavPM] GPS init:', err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    // Kompas
    try {
      const { magnetometer } = require('react-native-sensors');
      sensorRef.current = magnetometer.subscribe(({ x, y }) => {
        let a = Math.atan2(y, x) * RAD;
        setHeading((a + 360) % 360);
      });
    } catch (e) {}

    return () => {
      stopTracking();
      sensorRef.current?.unsubscribe?.();
    };
  }, []));

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? placemarks.filter(p => p.judul.toLowerCase().includes(q)) : placemarks);
  }, [search, placemarks]);

  const selectTarget = (pm) => {
    setSelected(pm);
    if (currentPos) {
      const d = haversine(currentPos.lat, currentPos.lon, pm.lat, pm.lon);
      setDistance(d);
    }
  };

  const startTracking = () => {
    if (!selected) { Alert.alert('Pilih Target', 'Pilih placemark dari daftar terlebih dahulu.'); return; }
    setIsTracking(true);
    watchIdRef.current = Geolocation.watchPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lon: coords.longitude };
        setCurrentPos(p);
        if (coords.heading != null && coords.heading >= 0) setHeading(coords.heading);
        const d = haversine(p.lat, p.lon, selected.lat, selected.lon);
        setDistance(d);
        if (d < 5) {
          Alert.alert('🎯 Tiba!', `Anda telah sampai di "${selected.judul}"`);
          stopTracking();
        }
      },
      err => console.warn('[NavPM] Watch:', err.message),
      { enableHighAccuracy: true, distanceFilter: 1, interval: 1000, fastestInterval: 500 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) { Geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setIsTracking(false);
  };

  const targetBearing = (currentPos && selected)
    ? bearingTo(currentPos.lat, currentPos.lon, selected.lat, selected.lon) : 0;

  const mapRegion = currentPos ? {
    latitude: (currentPos.lat + (selected?.lat ?? currentPos.lat)) / 2,
    longitude: (currentPos.lon + (selected?.lon ?? currentPos.lon)) / 2,
    latitudeDelta: 0.02, longitudeDelta: 0.02,
  } : null;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Navigasi ke Placemark</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Daftar Placemark */}
        <View style={styles.listPanel}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Cari placemark..."
            placeholderTextColor="#94A3B8"
          />
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pmItem, selected?.id === item.id && styles.pmItemSelected]}
                onPress={() => selectTarget(item)}
              >
                <Text style={styles.pmName} numberOfLines={1}>{item.judul}</Text>
                <Text style={styles.pmDist}>
                  {currentPos ? fmtDist(haversine(currentPos.lat, currentPos.lon, item.lat, item.lon)) : '...'}
                </Text>
              </TouchableOpacity>
            )}
            getItemLayout={(_, i) => ({ length: 60, offset: 60 * i, index: i })}
            maxToRenderPerBatch={15}
            windowSize={5}
            removeClippedSubviews
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyTxt}>Belum ada placemark. Buat di menu Placemark.</Text>
              </View>
            }
          />
        </View>

        {/* Panel Navigasi */}
        {selected && (
          <View style={styles.navPanel}>
            <View style={styles.targetInfo}>
              <Text style={styles.targetName} numberOfLines={1}>{selected.judul}</Text>
              {distance != null && (
                <Text style={styles.targetDist}>{fmtDist(distance)}</Text>
              )}
            </View>

            <CompassView heading={heading} bearing={targetBearing} distance={distance ?? 0} />

            {mapRegion && (
              <View style={styles.mapCard}>
                <MapView style={styles.map} region={mapRegion} scrollEnabled={false}>
                  {currentPos && <Marker coordinate={{ latitude: currentPos.lat, longitude: currentPos.lon }}
                    pinColor="blue" title="Posisi Saya" />}
                  <Marker coordinate={{ latitude: selected.lat, longitude: selected.lon }}
                    pinColor="red" title={selected.judul} />
                  {currentPos && (
                    <Polyline
                      coordinates={[
                        { latitude: currentPos.lat, longitude: currentPos.lon },
                        { latitude: selected.lat, longitude: selected.lon },
                      ]}
                      strokeColor="#EF4444" strokeWidth={2} lineDashPattern={[8, 4]}
                    />
                  )}
                </MapView>
              </View>
            )}

            <View style={styles.btnRow}>
              {!isTracking ? (
                <TouchableOpacity style={styles.btnStart} onPress={startTracking}>
                  <Text style={styles.btnTxt}>▶ Mulai Navigasi</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.btnStop} onPress={stopTracking}>
                  <Text style={styles.btnTxt}>⏹ Hentikan</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
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
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  content: { flex: 1, flexDirection: 'row' },
  listPanel: { width: 180, borderRightWidth: 1, borderRightColor: '#E2E8F0', backgroundColor: '#fff' },
  search: {
    margin: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    fontSize: 13, color: '#0F172A',
  },
  pmItem: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  pmItemSelected: { backgroundColor: 'rgba(32,141,192,0.1)' },
  pmName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  pmDist: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  emptyList: { padding: 20 },
  emptyTxt: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },
  navPanel: { flex: 1, alignItems: 'center', padding: 12 },
  targetInfo: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  targetName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  targetDist: { fontSize: 22, fontWeight: '900', color: '#EF4444', marginTop: 4 },
  mapCard: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 12,
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  map: { height: 150 },
  btnRow: { width: '100%', marginTop: 12 },
  btnStart: { backgroundColor: '#22C55E', borderRadius: 14, padding: 14, alignItems: 'center' },
  btnStop: { backgroundColor: '#EF4444', borderRadius: 14, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default NavigasiPlacemark;
