/**
 * NavigasiRuteManual.js — Modul 4: Rute Manual Touch-to-Draw
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import GpsService from '../library/GpsService';

const DEG = Math.PI / 180, R = 6371000;
const haversine = (la1, lo1, la2, lo2) => {
  const dLat = (la2 - la1) * DEG, dLon = (lo2 - lo1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(la1 * DEG) * Math.cos(la2 * DEG) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

const NavigasiRuteManual = ({ navigation }) => {
  const [waypoints, setWaypoints] = useState([]);
  const initialGps = GpsService.getLastPosition();
  const [currentPos, setCurrentPos] = useState(
    initialGps ? { lat: initialGps.lat, lon: initialGps.lon } : null
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [isNavMode, setIsNavMode] = useState(false);
  const [distToNext, setDistToNext] = useState(null);
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);

  const totalDistance = useMemo(() =>
    waypoints.reduce((acc, wp, i) => {
      if (i === 0) return 0;
      return acc + haversine(waypoints[i - 1].lat, waypoints[i - 1].lon, wp.lat, wp.lon);
    }, 0),
  [waypoints]);

  useEffect(() => {
    const p = GpsService.getLastPosition();
    if (p) {
      setCurrentPos({ lat: p.lat, lon: p.lon });
      mapRef.current?.animateToRegion({
        latitude: p.lat, longitude: p.lon,
        latitudeDelta: 0.01, longitudeDelta: 0.01,
      });
    } else {
      Geolocation.getCurrentPosition(
        ({ coords }) => {
          const pos = { lat: coords.latitude, lon: coords.longitude };
          setCurrentPos(pos);
          mapRef.current?.animateToRegion({
            latitude: pos.lat, longitude: pos.lon,
            latitudeDelta: 0.01, longitudeDelta: 0.01,
          });
        },
        err => console.warn('[NavRute] GPS init:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    }
    return () => {
      if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleMapPress = useCallback((e) => {
    if (isNavMode) return;
    const { latitude: lat, longitude: lon } = e.nativeEvent.coordinate;
    setWaypoints(prev => [...prev, { lat, lon }]);
  }, [isNavMode]);

  const undoLast = () => setWaypoints(prev => prev.slice(0, -1));
  const resetAll = () => {
    Alert.alert('Reset Rute?', 'Semua titik rute akan dihapus.', [
      { text: 'Reset', style: 'destructive', onPress: () => { setWaypoints([]); setActiveIdx(0); setIsNavMode(false); } },
      { text: 'Batal', style: 'cancel' },
    ]);
  };

  const startNavigation = () => {
    if (waypoints.length < 2) { Alert.alert('Tambah Titik', 'Rute butuh minimal 2 titik.'); return; }
    setIsNavMode(true);
    setActiveIdx(0);
    watchIdRef.current = Geolocation.watchPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lon: coords.longitude };
        setCurrentPos(p);
        const target = waypoints[activeIdx];
        if (!target) { finishNavigation(); return; }
        const d = haversine(p.lat, p.lon, target.lat, target.lon);
        setDistToNext(d);
        if (d < 10) {
          // Maju ke titik berikutnya
          setActiveIdx(prev => {
            const next = prev + 1;
            if (next >= waypoints.length) {
              Alert.alert('🏁 Rute Selesai!', 'Anda telah melewati semua titik rute.');
              finishNavigation();
              return prev;
            }
            return next;
          });
        }
      },
      err => console.warn('[NavRute] Watch:', err.message),
      { enableHighAccuracy: true, distanceFilter: 2, interval: 1000, fastestInterval: 500 }
    );
  };

  const finishNavigation = () => {
    if (watchIdRef.current !== null) { Geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setIsNavMode(false);
  };

  const polylineCoords = waypoints.map(w => ({ latitude: w.lat, longitude: w.lon }));
  const activeTarget = waypoints[activeIdx];

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => { finishNavigation(); navigation.goBack(); }}>
          <Text style={styles.back}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Rute Manual</Text>
        <Text style={styles.hint}>
          {isNavMode ? `Menuju Titik ${activeIdx + 1}/${waypoints.length}` : 'Tap peta → tambah titik'}
        </Text>
      </LinearGradient>

      <MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {polylineCoords.length > 1 && (
          <Polyline coordinates={polylineCoords} strokeColor="#208DC0" strokeWidth={3} geodesic />
        )}
        {waypoints.map((wp, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: wp.lat, longitude: wp.lon }}
            pinColor={i === activeIdx && isNavMode ? '#EF4444' : i === 0 ? '#22C55E' : '#208DC0'}
            title={`Titik ${i + 1}`}
            description={i === 0 ? 'Start' : i === waypoints.length - 1 ? 'Finish' : ''}
          />
        ))}
        {currentPos && isNavMode && (
          <Polyline
            coordinates={[
              { latitude: currentPos.lat, longitude: currentPos.lon },
              ...(activeTarget ? [{ latitude: activeTarget.lat, longitude: activeTarget.lon }] : []),
            ]}
            strokeColor="#EF4444" strokeWidth={2} lineDashPattern={[6, 3]}
          />
        )}
      </MapView>

      {/* Panel bawah */}
      <View style={styles.panel}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Titik</Text>
            <Text style={styles.statValue}>{waypoints.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total Jarak</Text>
            <Text style={styles.statValue}>{fmtDist(totalDistance)}</Text>
          </View>
          {isNavMode && distToNext != null && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Ke Titik {activeIdx + 1}</Text>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{fmtDist(distToNext)}</Text>
            </View>
          )}
        </View>

        {!isNavMode ? (
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnUndo} onPress={undoLast} disabled={!waypoints.length}>
              <Text style={styles.btnUndoTxt}>↩ Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnReset} onPress={resetAll} disabled={!waypoints.length}>
              <Text style={styles.btnResetTxt}>✕ Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnNav} onPress={startNavigation}>
              <Text style={styles.btnNavTxt}>▶ Mulai Navigasi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.btnStop} onPress={finishNavigation}>
            <Text style={styles.btnNavTxt}>⏹ Hentikan Navigasi</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 50, paddingBottom: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  back: { color: '#208DC0', fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  hint: { color: '#94A3B8', fontSize: 11 },
  map: { flex: 1 },
  panel: {
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -4 }, shadowRadius: 12,
  },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnUndo: {
    flex: 1, backgroundColor: '#F1F5F9', borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  btnUndoTxt: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  btnReset: {
    flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  btnResetTxt: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  btnNav: {
    flex: 2, backgroundColor: '#22C55E', borderRadius: 14,
    padding: 14, alignItems: 'center',
    elevation: 4, shadowColor: '#22C55E', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  btnNavTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnStop: {
    backgroundColor: '#EF4444', borderRadius: 14, padding: 16, alignItems: 'center',
  },
});

export default NavigasiRuteManual;
