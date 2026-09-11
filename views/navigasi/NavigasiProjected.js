/**
 * NavigasiProjected.js — Modul 4: Navigasi Metode Proyeksi
 * User input jarak (m) + bearing (°), sistem proyeksikan titik tujuan.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import CompassView from './CompassView';
import TelemetriPanel from '../telemetri/TelemetriPanel';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const R = 6371000; // Radius bumi

const projectDestination = (lat1, lon1, distM, bearDeg) => {
  const d = distM / R;
  const b = bearDeg * DEG;
  const lat1r = lat1 * DEG, lon1r = lon1 * DEG;
  const lat2r = Math.asin(
    Math.sin(lat1r) * Math.cos(d) + Math.cos(lat1r) * Math.sin(d) * Math.cos(b)
  );
  const lon2r = lon1r + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(lat1r),
    Math.cos(d) - Math.sin(lat1r) * Math.sin(lat2r)
  );
  return { lat: lat2r * RAD, lon: ((lon2r * RAD + 540) % 360) - 180 };
};

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

const BEARING_PRESETS = [
  { l: 'U', v: '0' }, { l: 'TL', v: '45' }, { l: 'T', v: '90' }, { l: 'TG', v: '135' },
  { l: 'S', v: '180' }, { l: 'BD', v: '225' }, { l: 'B', v: '270' }, { l: 'BL', v: '315' },
];

const NavigasiProjected = ({ navigation }) => {
  const [jarak, setJarak] = useState('');
  const [bearing, setBearing] = useState('');
  const [currentPos, setCurrentPos] = useState(null);
  const [target, setTarget] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distToTarget, setDistToTarget] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const watchIdRef = useRef(null);
  const sensorRef = useRef(null);

  // Hitung target saat input berubah
  const recalcTarget = useCallback((pos, j, b) => {
    const d = parseFloat(j), bear = parseFloat(b);
    if (!pos || isNaN(d) || isNaN(bear) || d <= 0 || d > 999999) return;
    if (bear < 0 || bear > 360) return;
    setTarget(projectDestination(pos.lat, pos.lon, d, bear));
  }, []);

  useEffect(() => {
    // Ambil posisi awal
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lon: coords.longitude };
        setCurrentPos(p);
        recalcTarget(p, jarak, bearing);
      },
      (err) => console.warn('[NavProjected] GPS init error:', err.message),
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
      if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
      sensorRef.current?.unsubscribe?.();
    };
  }, []);

  const startTracking = () => {
    if (!target) { Alert.alert('Error', 'Isi jarak dan bearing terlebih dahulu'); return; }
    setIsTracking(true);
    watchIdRef.current = Geolocation.watchPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lon: coords.longitude };
        setCurrentPos(p);
        if (coords.heading != null && coords.heading >= 0) setHeading(coords.heading);
        const dist = haversine(p.lat, p.lon, target.lat, target.lon);
        setDistToTarget(dist);
        if (dist < 5) {
          Alert.alert('🎯 Target Tercapai!', `Anda telah tiba di titik proyeksi (±5m).`);
          stopTracking();
        }
      },
      err => console.warn('[NavProjected] Watch error:', err.message),
      { enableHighAccuracy: true, distanceFilter: 1, interval: 1000, fastestInterval: 500 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) { Geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setIsTracking(false);
  };

  const targetBearing = (currentPos && target)
    ? bearingTo(currentPos.lat, currentPos.lon, target.lat, target.lon) : 0;

  const mapRegion = currentPos ? {
    latitude: currentPos.lat, longitude: currentPos.lon,
    latitudeDelta: 0.01, longitudeDelta: 0.01,
  } : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹ Kembali</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Navigasi Proyeksi</Text>
        </LinearGradient>

        <TelemetriPanel compact />

        {/* Input Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parameter Proyeksi</Text>

          <Text style={styles.label}>Jarak (meter)</Text>
          <TextInput
            style={styles.input}
            value={jarak}
            onChangeText={v => { setJarak(v); if (currentPos) recalcTarget(currentPos, v, bearing); }}
            keyboardType="numeric"
            placeholder="Contoh: 500"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Bearing / Azimuth (0–360°)</Text>
          <TextInput
            style={styles.input}
            value={bearing}
            onChangeText={v => { setBearing(v); if (currentPos) recalcTarget(currentPos, jarak, v); }}
            keyboardType="numeric"
            placeholder="Contoh: 90 (Timur)"
            placeholderTextColor="#94A3B8"
          />
          <View style={styles.presets}>
            {BEARING_PRESETS.map(p => (
              <TouchableOpacity
                key={p.l}
                style={[styles.preset, bearing === p.v && styles.presetActive]}
                onPress={() => { setBearing(p.v); if (currentPos) recalcTarget(currentPos, jarak, p.v); }}
              >
                <Text style={[styles.presetText, bearing === p.v && styles.presetTextActive]}>{p.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {target && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Koordinat Target</Text>
              <Text style={styles.resultValue}>{target.lat.toFixed(6)}°, {target.lon.toFixed(6)}°</Text>
              {distToTarget != null && (
                <Text style={styles.distText}>
                  Sisa jarak: {distToTarget >= 1000 ? `${(distToTarget / 1000).toFixed(2)} km` : `${Math.round(distToTarget)} m`}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Kompas */}
        {target && currentPos && (
          <View style={styles.card}>
            <CompassView heading={heading} bearing={targetBearing} distance={distToTarget ?? parseFloat(jarak) || 0} />
          </View>
        )}

        {/* Peta */}
        {mapRegion && target && (
          <View style={styles.mapCard}>
            <MapView style={styles.map} region={mapRegion}>
              <Marker coordinate={{ latitude: currentPos.lat, longitude: currentPos.lon }}
                pinColor="blue" title="Posisi Saya" />
              <Marker coordinate={{ latitude: target.lat, longitude: target.lon }}
                pinColor="red" title="Target Proyeksi" />
              <Polyline
                coordinates={[
                  { latitude: currentPos.lat, longitude: currentPos.lon },
                  { latitude: target.lat, longitude: target.lon },
                ]}
                strokeColor="#208DC0" strokeWidth={2} lineDashPattern={[8, 4]}
              />
            </MapView>
          </View>
        )}

        {/* Kontrol */}
        <View style={styles.controls}>
          {!isTracking ? (
            <TouchableOpacity style={styles.btnStart} onPress={startTracking}>
              <Text style={styles.btnText}>▶ Mulai Navigasi</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnStop} onPress={stopTracking}>
              <Text style={styles.btnText}>⏹ Hentikan</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  card: {
    margin: 16, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  presetActive: { borderColor: '#208DC0', backgroundColor: 'rgba(32,141,192,0.1)' },
  presetText: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  presetTextActive: { color: '#208DC0' },
  resultBox: {
    marginTop: 16, backgroundColor: 'rgba(32,141,192,0.08)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(32,141,192,0.3)',
  },
  resultLabel: { fontSize: 10, fontWeight: '700', color: '#208DC0', letterSpacing: 0.5 },
  resultValue: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 4,
    fontFamily: Platform.select({ android: 'monospace' }) },
  distText: { fontSize: 13, color: '#22C55E', fontWeight: '700', marginTop: 8 },
  mapCard: {
    margin: 16, borderRadius: 20, overflow: 'hidden',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  map: { height: 220 },
  controls: { margin: 16 },
  btnStart: {
    backgroundColor: '#22C55E', borderRadius: 16, padding: 18, alignItems: 'center',
    elevation: 6, shadowColor: '#22C55E', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
  },
  btnStop: {
    backgroundColor: '#EF4444', borderRadius: 16, padding: 18, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

export default NavigasiProjected;
