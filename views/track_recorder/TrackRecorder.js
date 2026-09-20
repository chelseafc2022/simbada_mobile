/**
 * TrackRecorder.js — Modul 3: Rekam Jejak Lapangan
 *
 * Screen kontrol rekam trek dengan Foreground Service (GPS tetap aktif
 * saat layar mati), metrik real-time, dan preview polyline.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, Platform, AppState,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TelemetriPanel from '../telemetri/TelemetriPanel';
import TrackDB from '../library/TrackDB';

const CHANNEL_ID = 'simbada_track';
const NOTIF_ID = 'track_notif';

// Hitung jarak Haversine
const haversine = (la1, lo1, la2, lo2) => {
  const R = 6371000;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fmtDuration = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m ${s}d`;
};

const fmtDist = (m) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

// ─── Komponen Metrik ─────────────────────────────────────────────────────────
const MetricCard = React.memo(({ label, value, unit, color = '#208DC0' }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricUnit}>{unit}</Text>
  </View>
));

// ─── Screen Utama ─────────────────────────────────────────────────────────────
const TrackRecorder = ({ navigation }) => {
  const dispatch = useDispatch();
  const trackStatus = useSelector(s => s.TRACK_STATUS);
  const token = useSelector(s => s.TOKEN);
  const profile = useSelector(s => s.PROFILE);
  const urlTrack = useSelector(s => s.URL?.URL_TRACK);
  const userId = profile?.id || profile?._id || profile?.username;

  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('idle'); // idle|recording|paused
  const [metrics, setMetrics] = useState({ distance: 0, avgSpeed: 0, maxSpeed: 0, duration: 0 });
  const [previewPath, setPreviewPath] = useState([]);
  const [batterySave, setBatterySave] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [startPos, setStartPos] = useState(null);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const durationRef = useRef(0);
  const prevPosRef = useRef(null);
  const notifTimerRef = useRef(null);

  const stopAll = async () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (notifTimerRef.current) {
      clearInterval(notifTimerRef.current);
      notifTimerRef.current = null;
    }
    try {
      await notifee.stopForegroundService();
    } catch (e) {
      console.log('[TrackRecorder] Error stopping foreground service:', e);
    }
    try {
      await notifee.cancelNotification(NOTIF_ID);
    } catch (e) {
      console.log('[TrackRecorder] Error cancelling notification:', e);
    }
  };

  // Setup notifee channel (sekali saja)
  useEffect(() => {
    notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Track Recorder',
      importance: AndroidImportance.LOW,
    });
    return () => {
      stopAll();
    };
  }, []);

  const updateNotif = async (dist, dur) => {
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: '🔴 Trek Aktif — Simbada',
      body: `Jarak: ${fmtDist(dist)} | Waktu: ${fmtDuration(dur)}`,
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        actions: [{ title: 'Hentikan', pressAction: { id: 'stop' } }],
        smallIcon: 'ic_launcher',
      },
    });
  };

  // ─── MULAI REKAM ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (TrackDB.hasActiveSession()) {
      Alert.alert(
        'Sesi Sebelumnya',
        'Masih ada sesi trek yang belum selesai. Selesaikan dulu?',
        [
          { text: 'Batalkan Sesi Lama', onPress: async () => {
            await TrackDB.finishTrack();
            startRecording();
          }},
          { text: 'Lanjutkan Sesi Lama', style: 'cancel' },
        ]
      );
      return;
    }

    const id = await TrackDB.startNewTrack();
    setSessionId(id);
    setStatus('recording');
    setMetrics({ distance: 0, avgSpeed: 0, maxSpeed: 0, duration: 0 });
    setPreviewPath([]);
    durationRef.current = 0;
    prevPosRef.current = null;
    dispatch({ type: 'SET_TRACK_STATUS', payload: 'recording' });

    // Timer durasi
    timerRef.current = setInterval(() => {
      if (TrackDB.isPaused()) return;
      durationRef.current++;
      setMetrics(prev => ({ ...prev, duration: durationRef.current }));
    }, 1000);

    // Update notifikasi tiap 30 detik
    notifTimerRef.current = setInterval(() => {
      setMetrics(prev => {
        updateNotif(prev.distance, prev.duration);
        return prev;
      });
    }, 30000);
    await updateNotif(0, 0);

    // GPS Watch
    const interval = batterySave ? 10000 : 1000;
    watchIdRef.current = Geolocation.watchPosition(
      async (position) => {
        if (TrackDB.isPaused()) return;
        const { latitude: lat, longitude: lon,
                altitude: alt, speed, accuracy: accH } = position.coords;

        const wp = { lat, lon, alt: alt ?? 0, speed: speed ?? 0, accH: accH ?? 0 };
        const accepted = await TrackDB.addWaypoint(wp);
        if (!accepted) return;

        // Preview peta (max 200 titik terbaru)
        setPreviewPath(prev => {
          const next = [...prev, { latitude: lat, longitude: lon }];
          return next.length > 200 ? next.slice(-200) : next;
        });

        if (!startPos) setStartPos({ latitude: lat, longitude: lon });

        // Hitung metrik
        if (prevPosRef.current) {
          const delta = haversine(prevPosRef.current.lat, prevPosRef.current.lon, lat, lon);
          const speedKmh = (speed ?? 0) * 3.6;
          setMetrics(prev => {
            const newDist = prev.distance + delta;
            const newMax = Math.max(prev.maxSpeed, speedKmh);
            const newAvg = durationRef.current > 0
              ? (newDist / durationRef.current) * 3.6
              : 0;
            const m = { ...prev, distance: newDist, avgSpeed: newAvg, maxSpeed: newMax };
            TrackDB.updateMetrics({
              totalDistance: m.distance, avgSpeed: m.avgSpeed,
              maxSpeed: m.maxSpeed, duration: m.duration,
            });
            dispatch({ type: 'UPDATE_TRACK_METRICS', payload: {
              distance: m.distance, avgSpeed: m.avgSpeed,
              maxSpeed: m.maxSpeed, duration: m.duration,
            }});
            return m;
          });
        }
        prevPosRef.current = { lat, lon };
      },
      (err) => console.warn('[TrackRecorder] GPS error:', err.message),
      {
        enableHighAccuracy: true,
        distanceFilter: batterySave ? 10 : 3,
        interval,
        fastestInterval: batterySave ? 5000 : 500,
      }
    );
  };

  // ─── PAUSE / RESUME ────────────────────────────────────────────────────────
  const togglePause = () => {
    if (status === 'recording') {
      TrackDB.pauseTrack();
      setStatus('paused');
      dispatch({ type: 'SET_TRACK_STATUS', payload: 'paused' });
    } else if (status === 'paused') {
      TrackDB.resumeTrack();
      setStatus('recording');
      dispatch({ type: 'SET_TRACK_STATUS', payload: 'recording' });
    }
  };

  // ─── HENTIKAN ──────────────────────────────────────────────────────────────
  const stopRecording = () => {
    Alert.alert(
      'Hentikan Trek?',
      'Trek akan disimpan ke riwayat. Anda dapat mengekspornya nanti.',
      [
        {
          text: 'Ya, Hentikan',
          style: 'destructive',
          onPress: async () => {
            await stopAll();
            const serverOpts = {
              userId,
              token,
              urlTrack,
              ownerInfo: {
                userId,
                nama: profile?.nama || profile?.username || 'Pengguna',
                desa: profile?.nama_desa || '',
                kecamatan: profile?.nama_kecamatan || '',
              },
            };
            const finished = await TrackDB.finishTrack(serverOpts);
            setStatus('idle');
            dispatch({ type: 'SET_TRACK_STATUS', payload: 'idle' });
            setSessionId(null);
            Alert.alert(
              '✅ Trek Disimpan',
              `Jarak: ${fmtDist(finished?.metrics?.totalDistance || 0)}\nDurasi: ${fmtDuration(finished?.metrics?.duration || 0)}`,
              [{ text: 'OK' }, { text: 'Lihat Riwayat', onPress: () => navigation.navigate('TrackHistory') }]
            );
          },
        },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  };

  const mapRegion = startPos ? {
    latitude: startPos.latitude,
    longitude: startPos.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : null;

  const handleBack = () => {
    if (status === 'recording' || status === 'paused') {
      Alert.alert(
        'Perekaman Masih Berjalan',
        'Perekaman trek sedang aktif. Hentikan perekaman dan keluar?',
        [
          { text: 'Tetap di Sini', style: 'cancel' },
          {
            text: 'Hentikan & Keluar',
            style: 'destructive',
            onPress: async () => {
              await stopAll();
              const serverOpts = {
                userId,
                token,
                urlTrack,
                ownerInfo: {
                  userId,
                  nama: profile?.nama || profile?.username || 'Pengguna',
                  desa: profile?.nama_desa || '',
                  kecamatan: profile?.nama_kecamatan || '',
                },
              };
              await TrackDB.finishTrack(serverOpts);
              setStatus('idle');
              dispatch({ type: 'SET_TRACK_STATUS', payload: 'idle' });
              setSessionId(null);
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — Mengikuti style NavigasiKoordinat */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 15) }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>🛰️ Survei Lapangan</Text>
        </View>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => navigation.navigate('TrackHistory')}
        >
          <Text style={styles.historyLink}>Riwayat ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}>
        {/* Panel Telemetri */}
        <TelemetriPanel showBoundsAlert compact={status !== 'idle'} />

      {/* Metrik */}
      <View style={styles.metricsRow}>
        <MetricCard label="Jarak" value={fmtDist(metrics.distance)} unit="" color="#22C55E" />
        <MetricCard label="Waktu" value={fmtDuration(metrics.duration)} unit="" color="#F59E0B" />
        <MetricCard label="Kec. Avg" value={metrics.avgSpeed.toFixed(1)} unit="km/h" color="#208DC0" />
        <MetricCard label="Kec. Max" value={metrics.maxSpeed.toFixed(1)} unit="km/h" color="#A855F7" />
      </View>

      {/* Mini Map */}
      {mapRegion && (
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={mapRegion} scrollEnabled={false}>
            {previewPath.length > 1 && (
              <Polyline coordinates={previewPath} strokeColor="#EF4444" strokeWidth={3} geodesic />
            )}
            {startPos && <Marker coordinate={startPos} pinColor="green" title="Start" />}
          </MapView>
        </View>
      )}

      {/* Mode Hemat Baterai */}
      {status === 'idle' && (
        <TouchableOpacity
          style={[styles.saveModeBtn, batterySave && styles.saveModeBtnActive]}
          onPress={() => setBatterySave(!batterySave)}
        >
          <Text style={styles.saveModeTxt}>
            🔋 Mode Hemat Baterai: {batterySave ? 'AKTIF (10 detik)' : 'NONAKTIF (1 detik)'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Kontrol */}
      <View style={styles.controls}>
        {status === 'idle' && (
          <TouchableOpacity style={styles.btnStart} onPress={startRecording}>
            <Text style={styles.btnText}>▶ MULAI REKAM</Text>
          </TouchableOpacity>
        )}
        {status !== 'idle' && (
          <>
            <TouchableOpacity
              style={[styles.btnPause, status === 'paused' && styles.btnResume]}
              onPress={togglePause}
            >
              <Text style={styles.btnText}>{status === 'paused' ? '▶ LANJUT' : '⏸ PAUSE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnStop} onPress={stopRecording}>
              <Text style={styles.btnText}>⏹ HENTIKAN</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {status !== 'idle' && (
        <View style={styles.statusBadge}>
          <View style={[styles.recDot, status === 'paused' && { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.statusText}>
            {status === 'recording' ? 'MEREKAM' : 'DIJEDA'}
          </Text>
        </View>
      )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  screen: { flex: 1 },
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
  backButton: { flex: 1, justifyContent: 'center' },
  headerCenter: { flex: 3, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#208DC0' },
  headerRight: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  historyLink: { color: '#208DC0', fontSize: 14, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  metricCard: {
    width: '48%', margin: '1%', backgroundColor: '#fff',
    borderRadius: 16, padding: 14, alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8,
  },
  metricLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { fontSize: 26, fontWeight: '900', marginTop: 4 },
  metricUnit: { fontSize: 10, color: '#CBD5E1', marginTop: 2 },
  mapContainer: {
    margin: 16, borderRadius: 20, overflow: 'hidden',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
  },
  map: { height: 200 },
  saveModeBtn: {
    margin: 16, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  saveModeBtnActive: { borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)' },
  saveModeTxt: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  controls: { flexDirection: 'row', marginHorizontal: 16, gap: 12, marginTop: 8 },
  btnStart: {
    flex: 1, backgroundColor: '#22C55E', borderRadius: 16,
    padding: 18, alignItems: 'center',
    elevation: 6, shadowColor: '#22C55E', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
  },
  btnPause: {
    flex: 1, backgroundColor: '#F59E0B', borderRadius: 16,
    padding: 18, alignItems: 'center',
  },
  btnResume: { backgroundColor: '#208DC0' },
  btnStop: {
    flex: 1, backgroundColor: '#EF4444', borderRadius: 16,
    padding: 18, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 16,
  },
  recDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#EF4444', marginRight: 8,
  },
  statusText: { color: '#64748B', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
});

export default TrackRecorder;
