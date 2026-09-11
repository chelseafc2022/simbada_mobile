/**
 * TelemetriPanel.js — Modul 2: Penginderaan Lokasi & Telemetri Real-Time
 *
 * Komponen reusable yang menampilkan data GPS dan kompas secara real-time.
 * Dapat di-embed di screen manapun yang membutuhkan data sensor.
 *
 * Props:
 *   showBoundsAlert: boolean — aktifkan cek posisi vs area peta aktif
 *   compact: boolean         — tampilan ringkas (1 baris) vs full
 *   onPositionUpdate: fn     — callback setiap ada update posisi baru
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useDispatch, useSelector } from 'react-redux';

// Helper: hitung heading dari vektor magnetometer x,y
const computeCompassHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

// Helper: label mata angin dari derajat
const getCardinal = (deg) => {
  const dirs = ['U','TL','T','TG','S','BD','B','BL'];
  return dirs[Math.round(deg / 45) % 8];
};

// Helper: format kecepatan m/s -> km/h
const fmtSpeed = (ms) => ms != null ? (ms * 3.6).toFixed(1) : '0.0';

// Helper: format jarak akurasi
const fmtAcc = (m) => m != null ? `±${Math.round(m)}m` : '±?m';

// ─── Komponen Utama ───────────────────────────────────────────────────────────
const TelemetriPanel = ({ showBoundsAlert = false, compact = false, onPositionUpdate }) => {
  const dispatch = useDispatch();
  const activeMap = useSelector(s => s.ACTIVE_MAP);

  const [pos, setPos] = useState(null);
  const [compass, setCompass] = useState(0);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle|acquiring|active|error
  const [outsideBounds, setOutsideBounds] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const watchIdRef = useRef(null);
  const sensorSubRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const lastPosRef = useRef(null);

  // ── Cek posisi vs bounding box peta aktif ──
  const checkBounds = useCallback((lat, lon) => {
    if (!showBoundsAlert || !activeMap?.bounds) return;
    const { minLat, maxLat, minLon, maxLon } = activeMap.bounds;
    const inside = lat >= minLat && lat <= maxLat &&
                   lon >= minLon && lon <= maxLon;
    setOutsideBounds(!inside);
  }, [showBoundsAlert, activeMap]);

  // ── Haversine filter: apakah bergerak >= 1 meter ──
  const hasMoved = (newLat, newLon) => {
    if (!lastPosRef.current) return true;
    const { lat: la, lon: lo } = lastPosRef.current;
    const R = 6371000;
    const dLat = ((newLat - la) * Math.PI) / 180;
    const dLon = ((newLon - lo) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos((la * Math.PI) / 180) * Math.cos((newLat * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) >= 1;
  };

  useEffect(() => {
    setGpsStatus('acquiring');
    dispatch({ type: 'SET_GPS_STATUS', payload: 'acquiring' });

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        // Throttle: max 1 update/detik
        if (now - lastUpdateRef.current < 1000) return;
        lastUpdateRef.current = now;

        const { latitude: lat, longitude: lon, altitude: alt,
                speed, accuracy: accH, altitudeAccuracy: accV,
                heading } = position.coords;

        // Deadband: abaikan jika belum bergerak >=1m
        if (!hasMoved(lat, lon)) return;
        lastPosRef.current = { lat, lon };

        const newPos = {
          lat, lon,
          alt: alt ?? 0,
          speed: speed ?? 0,
          accH: accH ?? 0,
          accV: accV ?? 0,
          heading: heading ?? compass,
        };

        setPos(newPos);
        setGpsStatus('active');
        dispatch({ type: 'SET_GPS_STATUS', payload: 'active' });
        dispatch({ type: 'UPDATE_POSITION', payload: newPos });
        checkBounds(lat, lon);
        onPositionUpdate?.(newPos);
      },
      (err) => {
        console.warn('[TelemetriPanel] GPS error:', err.message);
        setGpsStatus('error');
        dispatch({ type: 'SET_GPS_STATUS', payload: 'error' });
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 1000,
        fastestInterval: 500,
      }
    );

    // Kompas dari magnetometer
    try {
      const { magnetometer } = require('react-native-sensors');
      sensorSubRef.current = magnetometer.subscribe(({ x, y }) => {
        const h = computeCompassHeading(x, y);
        setCompass(h);
        // Jika GPS tidak memberikan heading, pakai magnetometer
        setPos(prev => prev && prev.speed < 0.5
          ? { ...prev, heading: h }
          : prev
        );
      });
    } catch (e) {
      console.log('[TelemetriPanel] Magnetometer tidak tersedia');
    }

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (sensorSubRef.current?.unsubscribe) {
        sensorSubRef.current.unsubscribe();
        sensorSubRef.current = null;
      }
      dispatch({ type: 'SET_GPS_STATUS', payload: 'idle' });
    };
  }, []);

  // Re-check bounds saat peta aktif berubah
  useEffect(() => {
    if (pos) checkBounds(pos.lat, pos.lon);
  }, [activeMap]);

  const statusColor = {
    idle: '#94A3B8',
    acquiring: '#F59E0B',
    active: '#22C55E',
    error: '#EF4444',
  }[gpsStatus];

  if (compact && !expanded) {
    return (
      <TouchableOpacity style={styles.compact} onPress={() => setExpanded(true)}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        {pos ? (
          <Text style={styles.compactText}>
            {pos.lat.toFixed(5)}, {pos.lon.toFixed(5)}
            {'  '}{fmtAcc(pos.accH)}
            {'  '}{fmtSpeed(pos.speed)} km/h
          </Text>
        ) : (
          <Text style={styles.compactText}>Memperoleh GPS...</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header status GPS */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => compact && setExpanded(false)}
      >
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={styles.headerText}>
          GPS{' '}
          {{idle:'IDLE',acquiring:'MEMPEROLEH...',active:'AKTIF',error:'ERROR'}[gpsStatus]}
        </Text>
        {pos && (
          <Text style={[styles.accBadge, pos.accH > 15 && styles.accBadgeWarn]}>
            {fmtAcc(pos.accH)}
          </Text>
        )}
        {compact && (
          <Text style={styles.collapseBtn}>▲</Text>
        )}
      </TouchableOpacity>

      {/* Grid koordinat */}
      {pos ? (
        <>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Lintang</Text>
              <Text style={styles.cellValue}>{pos.lat.toFixed(6)}°</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Bujur</Text>
              <Text style={styles.cellValue}>{pos.lon.toFixed(6)}°</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Ketinggian</Text>
              <Text style={styles.cellValue}>{Math.round(pos.alt)} m</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Kecepatan</Text>
              <Text style={styles.cellValue}>{fmtSpeed(pos.speed)} km/h</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Arah</Text>
              <Text style={styles.cellValue}>
                {Math.round(pos.heading)}° ({getCardinal(pos.heading)})
              </Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.cellLabel}>Acc-V</Text>
              <Text style={styles.cellValue}>{fmtAcc(pos.accV)}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.acquiring}>
          <Text style={styles.acquiringText}>Memperoleh sinyal GPS...</Text>
        </View>
      )}

      {/* Peringatan di luar area peta */}
      {outsideBounds && (
        <View style={styles.boundsAlert}>
          <Text style={styles.boundsAlertText}>
            ⚠ Posisi di luar area Peta Aktif
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    padding: 10,
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(32,141,192,0.4)',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 8,
  },
  compactText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: Platform.select({ android: 'monospace' }),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    flex: 1,
  },
  accBadge: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    color: '#22C55E',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '700',
  },
  accBadgeWarn: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    color: '#F59E0B',
  },
  collapseBtn: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 6,
  },
  grid: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  cellLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cellValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.select({ android: 'monospace' }),
    marginTop: 1,
  },
  acquiring: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  acquiringText: {
    color: '#F59E0B',
    fontSize: 12,
  },
  boundsAlert: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    padding: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  boundsAlertText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default memo(TelemetriPanel);
