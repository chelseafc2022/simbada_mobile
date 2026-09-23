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

import GpsService from '../library/GpsService';

// Helper: format jarak akurasi
const fmtAcc = (m) => m != null ? `±${Math.round(m)}m` : '±?m';

// ─── Komponen Utama ───────────────────────────────────────────────────────────
const TelemetriPanel = ({ showBoundsAlert = false, compact = false, onPositionUpdate }) => {
  const dispatch = useDispatch();
  const activeMap = useSelector(s => s.ACTIVE_MAP);
  const currentPos = useSelector(s => s.CURRENT_POSITION);
  const globalGpsStatus = useSelector(s => s.GPS_STATUS);

  const initialPos = currentPos || GpsService.getLastPosition();
  const [pos, setPos] = useState(initialPos);
  const [compass, setCompass] = useState(0);
  const [gpsStatus, setGpsStatus] = useState(
    initialPos || GpsService.hasAcquired() ? 'active' : (globalGpsStatus || 'acquiring')
  );
  const [outsideBounds, setOutsideBounds] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const sensorSubRef = useRef(null);

  // ── Cek posisi vs bounding box peta aktif ──
  const checkBounds = useCallback((lat, lon) => {
    if (!showBoundsAlert || !activeMap?.bounds) return;
    const { minLat, maxLat, minLon, maxLon } = activeMap.bounds;
    const inside = lat >= minLat && lat <= maxLat &&
                   lon >= minLon && lon <= maxLon;
    setOutsideBounds(!inside);
  }, [showBoundsAlert, activeMap]);

  // Sinkronisasi posisi langsung dari Redux/GpsService
  useEffect(() => {
    if (currentPos) {
      setPos(currentPos);
      setGpsStatus('active');
      checkBounds(currentPos.lat, currentPos.lon);
      onPositionUpdate?.(currentPos);
    }
  }, [currentPos, checkBounds, onPositionUpdate]);

  useEffect(() => {
    // Pastikan GpsService aktif berjalan
    GpsService.startTracking();

    if (currentPos || GpsService.hasAcquired()) {
      const p = currentPos || GpsService.getLastPosition();
      if (p) {
        setPos(p);
        setGpsStatus('active');
        checkBounds(p.lat, p.lon);
        onPositionUpdate?.(p);
      }
    } else {
      setGpsStatus('acquiring');
      dispatch({ type: 'SET_GPS_STATUS', payload: 'acquiring' });
    }

    // Kompas dari magnetometer
    try {
      const { magnetometer } = require('react-native-sensors');
      sensorSubRef.current = magnetometer.subscribe(({ x, y }) => {
        const h = computeCompassHeading(x, y);
        setCompass(h);
        setPos(prev => prev && prev.speed < 0.5
          ? { ...prev, heading: h }
          : prev
        );
      });
    } catch (e) {
      console.log('[TelemetriPanel] Magnetometer tidak tersedia');
    }

    return () => {
      if (sensorSubRef.current?.unsubscribe) {
        sensorSubRef.current.unsubscribe();
        sensorSubRef.current = null;
      }
      // PENTING: Jangan matikan GPS global dan jangan set status 'idle'
      // agar koordinat GPS tetap terkunci saat panel ditutup/dibuka kembali.
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
