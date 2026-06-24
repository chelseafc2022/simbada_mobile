/**
 * NavigasiKoordinat.js
 * Screen Navigasi Point-to-Point (Versi Lengkap)
 * 
 * 4 Fungsi Utama:
 * 1. Input koordinat target ATAU pilih langsung dari peta (tap on map)
 * 2. Kompas animasi menunjuk arah target real-time
 * 3. Jarak real-time ke target (update setiap pergerakan)
 * 4. Live GPS tracking dengan info posisi, akurasi, estimasi waktu
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform, Dimensions, Modal,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import FastImage from 'react-native-fast-image';
import { useSelector } from 'react-redux';
import CompassView from './CompassView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ====== Utility Functions ======

/** Haversine: jarak antara 2 titik (meter) */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/** Bearing (arah kompas) dari titik 1 ke titik 2 (0-360°) */
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
};

const toRad = (deg) => deg * (Math.PI / 180);

/** Estimasi waktu jalan kaki (5 km/h) */
const estimateWalkingTime = (distanceMeters) => {
  const speedMps = 5000 / 3600;
  const seconds = distanceMeters / speedMps;
  if (seconds < 60) return `${Math.round(seconds)} detik`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours} jam ${mins} menit`;
};

/** Format arah kompas ke teks Indonesia */
const getCompassDirection = (bearing) => {
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  const index = Math.round(bearing / 45) % 8;
  return dirs[index];
};

/** Format jarak ke text */
const formatDistance = (d) => {
  if (d >= 1000) return `${(d / 1000).toFixed(2)} km`;
  return `${Math.round(d)} m`;
};

// ====== Main Component ======

const NavigasiKoordinat = ({ navigation }) => {
  const TOKEN = useSelector(state => state.TOKEN);
  const URL = useSelector(state => state.URL);

  // Target state
  const [targetLat, setTargetLat] = useState('');
  const [targetLng, setTargetLng] = useState('');
  const [targetName, setTargetName] = useState('');

  // GPS state
  const [currentPos, setCurrentPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trackHistory, setTrackHistory] = useState([]);

  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerCoord, setMapPickerCoord] = useState(null);
  const [initialRegion, setInitialRegion] = useState({
    latitude: -4.234658,
    longitude: 122.353003,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  // View mode: 'input' | 'compass' | 'map'
  const [viewMode, setViewMode] = useState('input');

  const watchIdRef = useRef(null);
  const headingSubRef = useRef(null);
  const mapRef = useRef(null);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  // Ambil posisi awal untuk map picker
  useEffect(() => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPos({ latitude, longitude });
        setGpsAccuracy(position.coords.accuracy);
        setInitialRegion({
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      },
      () => { /* silent fail, use default region */ },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Hitung jarak & bearing setiap kali posisi atau target berubah
  useEffect(() => {
    if (currentPos && targetLat && targetLng) {
      const lat2 = parseFloat(targetLat);
      const lng2 = parseFloat(targetLng);
      if (!isNaN(lat2) && !isNaN(lng2)) {
        const dist = calculateDistance(currentPos.latitude, currentPos.longitude, lat2, lng2);
        const bear = calculateBearing(currentPos.latitude, currentPos.longitude, lat2, lng2);
        setDistance(dist);
        setBearing(bear);
      }
    }
  }, [currentPos, targetLat, targetLng]);

  /** ====== FUNGSI 4: Live GPS Tracking ====== */
  const startTracking = () => {
    const lat = parseFloat(targetLat);
    const lng = parseFloat(targetLng);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Pilih atau masukkan koordinat target terlebih dahulu.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Error', 'Koordinat di luar range valid.\nLatitude: -90 s/d 90\nLongitude: -180 s/d 180');
      return;
    }

    setIsTracking(true);
    setIsLoading(true);
    setTrackHistory([]);
    setViewMode('compass');

    // Posisi awal
    Geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentPos(pos);
        setGpsAccuracy(position.coords.accuracy);
        setTrackHistory([pos]);
        setIsLoading(false);
      },
      (error) => {
        Alert.alert('GPS Error', 'Gagal mendapatkan posisi GPS: ' + error.message);
        setIsLoading(false);
        setIsTracking(false);
        setViewMode('input');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Watch posisi real-time
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentPos(pos);
        setGpsAccuracy(position.coords.accuracy);
        setTrackHistory(prev => [...prev, pos]);

        // Gunakan heading dari GPS jika tersedia
        if (position.coords.heading != null && position.coords.heading >= 0) {
          setHeading(position.coords.heading);
        }
      },
      (error) => {
        console.warn('[NavigasiKoordinat] Watch error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 1000,
        fastestInterval: 500,
      }
    );

    // Compass heading dari magnetometer (fallback)
    try {
      const { magnetometer } = require('react-native-sensors');
      const subscription = magnetometer.subscribe(({ x, y }) => {
        let angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = (angle + 360) % 360;
        setHeading(angle);
      });
      headingSubRef.current = subscription;
    } catch (e) {
      console.log('[NavigasiKoordinat] Magnetometer fallback not available');
    }
  };

  /** Stop GPS tracking */
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (headingSubRef.current) {
      if (typeof headingSubRef.current.unsubscribe === 'function') {
        headingSubRef.current.unsubscribe();
      }
      headingSubRef.current = null;
    }
    setIsTracking(false);
  };

  /** ====== FUNGSI 1: Pilih Target dari Peta ====== */
  const openMapPicker = () => {
    // Gunakan posisi saat ini sebagai center map jika tersedia
    if (currentPos) {
      setInitialRegion({
        latitude: currentPos.latitude,
        longitude: currentPos.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
    setMapPickerCoord(null);
    setShowMapPicker(true);
  };

  const confirmMapPick = () => {
    if (mapPickerCoord) {
      setTargetLat(mapPickerCoord.latitude.toFixed(6));
      setTargetLng(mapPickerCoord.longitude.toFixed(6));
      setTargetName(`Titik Peta (${mapPickerCoord.latitude.toFixed(4)}, ${mapPickerCoord.longitude.toFixed(4)})`);
    }
    setShowMapPicker(false);
  };

  /** Lihat posisi saat ini */
  const showCurrentPosition = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentPos({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsAccuracy(position.coords.accuracy);
        Alert.alert(
          '📍 Posisi Anda Saat Ini',
          `Latitude: ${position.coords.latitude.toFixed(6)}\nLongitude: ${position.coords.longitude.toFixed(6)}\nAkurasi: ±${Math.round(position.coords.accuracy)}m`
        );
      },
      (error) => Alert.alert('Error', 'Gagal mendapatkan posisi: ' + error.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /** Kembali ke tampilan input */
  const backToInput = () => {
    stopTracking();
    setViewMode('input');
  };

  /** Pindah ke tampilan peta tracking */
  const switchToMapView = () => setViewMode('map');
  const switchToCompassView = () => setViewMode('compass');

  // ====== RENDER ======

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => {
          stopTracking();
          navigation.goBack();
        }}>
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>🧭 Navigasi Koordinat</Text>
        </View>
        {isTracking && (
          <TouchableOpacity onPress={backToInput} style={s.headerRight}>
            <Text style={s.headerRightText}>✕</Text>
          </TouchableOpacity>
        )}
        {!isTracking && <View style={{ flex: 1 }} />}
      </View>

      {/* ============ VIEW: INPUT MODE ============ */}
      {viewMode === 'input' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Section: Pilih Target */}
          <View style={s.card}>
            <Text style={s.cardTitle}>🎯 Pilih Lokasi Target</Text>
            <Text style={s.cardSubtitle}>Pilih dari peta atau masukkan koordinat manual</Text>

            {/* Tombol Pilih dari Peta */}
            <TouchableOpacity style={s.mapPickerButton} onPress={openMapPicker}>
              <Text style={s.mapPickerIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.mapPickerText}>Pilih dari Peta</Text>
                <Text style={s.mapPickerSubText}>Tap pada peta untuk menentukan titik tujuan</Text>
              </View>
              <Text style={{ fontSize: 16, color: '#208DC0' }}>›</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>atau masukkan manual</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Input Manual */}
            <View style={s.inputRow}>
              <View style={s.inputHalf}>
                <Text style={s.inputLabel}>Latitude</Text>
                <TextInput
                  style={s.input}
                  value={targetLat}
                  onChangeText={(val) => {
                    setTargetLat(val);
                    setTargetName('');
                  }}
                  placeholder="-4.2021"
                  placeholderTextColor="#bbb"
                  keyboardType="numeric"
                />
              </View>
              <View style={s.inputHalf}>
                <Text style={s.inputLabel}>Longitude</Text>
                <TextInput
                  style={s.input}
                  value={targetLng}
                  onChangeText={(val) => {
                    setTargetLng(val);
                    setTargetName('');
                  }}
                  placeholder="122.4819"
                  placeholderTextColor="#bbb"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Tombol posisi saat ini */}
            <TouchableOpacity style={s.currentLocButton} onPress={showCurrentPosition}>
              <Text style={s.currentLocText}>📍 Lihat Posisi Saya Saat Ini</Text>
            </TouchableOpacity>
          </View>

          {/* Preview Target */}
          {targetLat !== '' && targetLng !== '' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>📌 Target Terpilih</Text>
              {targetName !== '' && (
                <Text style={s.targetNameText}>{targetName}</Text>
              )}
              <View style={s.targetInfoRow}>
                <View style={s.targetInfoItem}>
                  <Text style={s.targetInfoLabel}>Latitude</Text>
                  <Text style={s.targetInfoValue}>{targetLat}</Text>
                </View>
                <View style={s.targetInfoItem}>
                  <Text style={s.targetInfoLabel}>Longitude</Text>
                  <Text style={s.targetInfoValue}>{targetLng}</Text>
                </View>
              </View>
              {currentPos && (
                <View style={s.previewDistance}>
                  <Text style={s.previewDistLabel}>Estimasi Jarak:</Text>
                  <Text style={s.previewDistValue}>
                    {formatDistance(calculateDistance(
                      currentPos.latitude, currentPos.longitude,
                      parseFloat(targetLat), parseFloat(targetLng)
                    ))}
                  </Text>
                </View>
              )}

              {/* Mini Map Preview */}
              <View style={s.miniMapContainer}>
                <MapView
                  style={s.miniMap}
                  provider="google"
                  region={{
                    latitude: parseFloat(targetLat) || -4.234658,
                    longitude: parseFloat(targetLng) || 122.353003,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: parseFloat(targetLat) || 0,
                      longitude: parseFloat(targetLng) || 0,
                    }}
                    pinColor="red"
                    title="Target"
                  />
                  {currentPos && (
                    <Marker
                      coordinate={currentPos}
                      pinColor="blue"
                      title="Posisi Anda"
                    />
                  )}
                </MapView>
              </View>
            </View>
          )}

          {/* Tombol Mulai Navigasi */}
          <TouchableOpacity
            style={[s.actionButton, s.startButton, (targetLat === '' || targetLng === '') && s.disabledButton]}
            onPress={startTracking}
            disabled={targetLat === '' || targetLng === ''}
          >
            <Text style={s.actionButtonText}>🧭 MULAI NAVIGASI</Text>
          </TouchableOpacity>

          {/* Petunjuk */}
          <View style={s.card}>
            <Text style={s.helpTitle}>📋 Petunjuk Penggunaan</Text>
            <Text style={s.helpText}>1. Pilih lokasi target dari peta atau ketik koordinat manual</Text>
            <Text style={s.helpText}>2. Periksa preview peta untuk memastikan titik target benar</Text>
            <Text style={s.helpText}>3. Tekan "Mulai Navigasi" untuk memulai tracking</Text>
            <Text style={s.helpText}>4. Ikuti arah panah merah pada kompas menuju target</Text>
            <Text style={s.helpText}>5. Gunakan tampilan Peta untuk melihat rute Anda</Text>
          </View>
        </ScrollView>
      )}

      {/* ============ VIEW: COMPASS MODE ============ */}
      {viewMode === 'compass' && isTracking && !isLoading && (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {/* Mode Switcher */}
          <View style={s.modeSwitcher}>
            <TouchableOpacity style={[s.modeTab, s.modeTabActive]}>
              <Text style={[s.modeTabText, s.modeTabTextActive]}>🧭 Kompas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modeTab} onPress={switchToMapView}>
              <Text style={s.modeTabText}>🗺️ Peta</Text>
            </TouchableOpacity>
          </View>

          {/* Target Info Bar */}
          <View style={s.targetBar}>
            <Text style={s.targetBarLabel}>Target:</Text>
            <Text style={s.targetBarValue} numberOfLines={1}>
              {targetName || `${targetLat}, ${targetLng}`}
            </Text>
          </View>

          {/* Compass */}
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <CompassView heading={heading} bearing={bearing} distance={distance} />
          </View>

          {/* Info Panel */}
          <View style={s.card}>
            <View style={s.infoPanelRow}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>📏 Jarak</Text>
                <Text style={s.infoValue}>{formatDistance(distance)}</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>🧭 Arah</Text>
                <Text style={s.infoValue}>{getCompassDirection(bearing)}</Text>
              </View>
            </View>
            <View style={s.infoPanelRow}>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>🔄 Bearing</Text>
                <Text style={s.infoValue}>{Math.round(bearing)}°</Text>
              </View>
              <View style={s.infoItem}>
                <Text style={s.infoLabel}>🚶 Est. Jalan Kaki</Text>
                <Text style={s.infoValue}>{estimateWalkingTime(distance)}</Text>
              </View>
            </View>

            {/* Posisi saat ini */}
            {currentPos && (
              <View style={s.positionSection}>
                <Text style={s.positionLabel}>📍 Posisi Anda:</Text>
                <Text style={s.positionValue}>
                  {currentPos.latitude.toFixed(6)}, {currentPos.longitude.toFixed(6)}
                </Text>
                {gpsAccuracy && (
                  <Text style={s.accuracyText}>Akurasi GPS: ±{Math.round(gpsAccuracy)}m</Text>
                )}
                <Text style={s.trackCountText}>
                  📊 {trackHistory.length} titik terlacak
                </Text>
              </View>
            )}
          </View>

          {/* Stop Button */}
          <TouchableOpacity style={[s.actionButton, s.stopButton]} onPress={backToInput}>
            <Text style={s.actionButtonText}>⏹ STOP NAVIGASI</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ============ VIEW: MAP TRACKING MODE ============ */}
      {viewMode === 'map' && isTracking && !isLoading && (
        <View style={{ flex: 1 }}>
          {/* Mode Switcher */}
          <View style={s.modeSwitcher}>
            <TouchableOpacity style={s.modeTab} onPress={switchToCompassView}>
              <Text style={s.modeTabText}>🧭 Kompas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeTab, s.modeTabActive]}>
              <Text style={[s.modeTabText, s.modeTabTextActive]}>🗺️ Peta</Text>
            </TouchableOpacity>
          </View>

          {/* Full Map */}
          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              provider="google"
              initialRegion={currentPos ? {
                latitude: currentPos.latitude,
                longitude: currentPos.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              } : initialRegion}
              showsUserLocation={false}
              showsCompass={true}
            >
              {/* Posisi saat ini */}
              {currentPos && (
                <>
                  <Circle
                    center={currentPos}
                    radius={gpsAccuracy || 10}
                    fillColor="rgba(32, 141, 192, 0.15)"
                    strokeColor="rgba(32, 141, 192, 0.3)"
                    strokeWidth={1}
                  />
                  <Marker coordinate={currentPos} title="Posisi Anda" pinColor="blue" />
                </>
              )}

              {/* Target */}
              <Marker
                coordinate={{
                  latitude: parseFloat(targetLat),
                  longitude: parseFloat(targetLng),
                }}
                title="Target"
                description={targetName || `${targetLat}, ${targetLng}`}
                pinColor="red"
              />

              {/* Garis lurus ke target */}
              {currentPos && (
                <Polyline
                  coordinates={[
                    currentPos,
                    { latitude: parseFloat(targetLat), longitude: parseFloat(targetLng) },
                  ]}
                  strokeColor="#E74C3C"
                  strokeWidth={2}
                  lineDashPattern={[10, 5]}
                />
              )}

              {/* Track history */}
              {trackHistory.length > 1 && (
                <Polyline
                  coordinates={trackHistory}
                  strokeColor="#208DC0"
                  strokeWidth={3}
                />
              )}
            </MapView>

            {/* Floating Info */}
            <View style={s.floatingInfo}>
              <View style={s.floatingRow}>
                <Text style={s.floatingLabel}>Jarak</Text>
                <Text style={s.floatingValue}>{formatDistance(distance)}</Text>
              </View>
              <View style={s.floatingDivider} />
              <View style={s.floatingRow}>
                <Text style={s.floatingLabel}>Arah</Text>
                <Text style={s.floatingValue}>{getCompassDirection(bearing)} ({Math.round(bearing)}°)</Text>
              </View>
              <View style={s.floatingDivider} />
              <View style={s.floatingRow}>
                <Text style={s.floatingLabel}>Waktu</Text>
                <Text style={s.floatingValue}>{estimateWalkingTime(distance)}</Text>
              </View>
            </View>

            {/* Floating Stop Button */}
            <TouchableOpacity style={s.floatingStop} onPress={backToInput}>
              <Text style={s.floatingStopText}>⏹ Stop</Text>
            </TouchableOpacity>

            {/* Floating Recenter */}
            {currentPos && (
              <TouchableOpacity
                style={s.floatingRecenter}
                onPress={() => {
                  mapRef.current?.animateToRegion({
                    latitude: currentPos.latitude,
                    longitude: currentPos.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }, 500);
                }}
              >
                <Text style={s.floatingRecenterText}>◎</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ============ LOADING ============ */}
      {isLoading && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color="#208DC0" />
            <Text style={s.loadingText}>Mencari sinyal GPS...</Text>
            <Text style={s.loadingSubText}>Pastikan GPS aktif dan berada di area terbuka</Text>
          </View>
        </View>
      )}

      {/* ============ MAP PICKER MODAL ============ */}
      <Modal visible={showMapPicker} animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={{ flex: 1 }}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)}>
              <Text style={s.modalCancel}>Batal</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Pilih Lokasi Target</Text>
            <TouchableOpacity
              onPress={confirmMapPick}
              disabled={!mapPickerCoord}
            >
              <Text style={[s.modalConfirm, !mapPickerCoord && { color: '#ccc' }]}>Pilih</Text>
            </TouchableOpacity>
          </View>

          {/* Instruction */}
          <View style={s.modalInstruction}>
            <Text style={s.modalInstructionText}>
              👆 Tap pada peta untuk menentukan titik tujuan
            </Text>
          </View>

          {/* Full Screen Map */}
          <MapView
            style={{ flex: 1 }}
            provider="google"
            initialRegion={initialRegion}
            onPress={(e) => {
              setMapPickerCoord(e.nativeEvent.coordinate);
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {/* Picked marker */}
            {mapPickerCoord && (
              <Marker
                coordinate={mapPickerCoord}
                pinColor="red"
                title="Target Tujuan"
                description={`${mapPickerCoord.latitude.toFixed(6)}, ${mapPickerCoord.longitude.toFixed(6)}`}
              />
            )}

            {/* Current pos marker */}
            {currentPos && (
              <Marker
                coordinate={currentPos}
                pinColor="blue"
                title="Posisi Anda"
              />
            )}

            {/* Line from current to target */}
            {mapPickerCoord && currentPos && (
              <Polyline
                coordinates={[currentPos, mapPickerCoord]}
                strokeColor="#E74C3C"
                strokeWidth={2}
                lineDashPattern={[10, 5]}
              />
            )}
          </MapView>

          {/* Picked coordinate info */}
          {mapPickerCoord && (
            <View style={s.modalPickedInfo}>
              <View style={s.modalPickedRow}>
                <Text style={s.modalPickedLabel}>Koordinat Terpilih:</Text>
                <Text style={s.modalPickedValue}>
                  {mapPickerCoord.latitude.toFixed(6)}, {mapPickerCoord.longitude.toFixed(6)}
                </Text>
              </View>
              {currentPos && (
                <View style={s.modalPickedRow}>
                  <Text style={s.modalPickedLabel}>Jarak dari posisi Anda:</Text>
                  <Text style={[s.modalPickedValue, { color: '#E74C3C' }]}>
                    {formatDistance(calculateDistance(
                      currentPos.latitude, currentPos.longitude,
                      mapPickerCoord.latitude, mapPickerCoord.longitude
                    ))}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

// ====== STYLES ======

const s = StyleSheet.create({
  // Header
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#208DC0' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  headerRightText: { fontSize: 18, color: '#E74C3C', fontWeight: 'bold' },

  // Card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    padding: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#208DC0', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#98A9B9', marginBottom: 14 },

  // Map Picker Button
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B8DDF0',
  },
  mapPickerIcon: { fontSize: 28, marginRight: 12 },
  mapPickerText: { fontSize: 15, fontWeight: 'bold', color: '#208DC0' },
  mapPickerSubText: { fontSize: 11, color: '#6BA5C0', marginTop: 2 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E8EF' },
  dividerText: { marginHorizontal: 10, fontSize: 11, color: '#98A9B9' },

  // Input
  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputHalf: { width: '48%' },
  inputLabel: { fontSize: 12, color: '#98A9B9', fontWeight: '600', marginBottom: 4 },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: '#D0D8E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAFBFC',
    color: '#000',
    fontSize: 14,
  },
  currentLocButton: {
    marginTop: 14,
    backgroundColor: '#F0F8FF',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0E8F0',
  },
  currentLocText: { color: '#208DC0', fontWeight: '600', fontSize: 13 },

  // Target Preview
  targetNameText: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  targetInfoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  targetInfoItem: { alignItems: 'center' },
  targetInfoLabel: { fontSize: 11, color: '#98A9B9', fontWeight: '600' },
  targetInfoValue: { fontSize: 15, color: '#208DC0', fontWeight: 'bold' },
  previewDistance: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  previewDistLabel: { fontSize: 12, color: '#E65100', marginRight: 6 },
  previewDistValue: { fontSize: 14, fontWeight: 'bold', color: '#E65100' },

  // Mini Map
  miniMapContainer: { height: 150, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  miniMap: { flex: 1 },

  // Action Button
  actionButton: {
    marginHorizontal: 15,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  startButton: { backgroundColor: '#208DC0' },
  stopButton: { backgroundColor: '#E74C3C' },
  disabledButton: { backgroundColor: '#B0C4D0', elevation: 0 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Help
  helpTitle: { fontSize: 14, fontWeight: 'bold', color: '#208DC0', marginBottom: 10 },
  helpText: { fontSize: 12, color: '#666', marginBottom: 5, lineHeight: 18 },

  // Mode Switcher
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  modeTabActive: { backgroundColor: '#208DC0' },
  modeTabText: { fontSize: 14, fontWeight: '600', color: '#98A9B9' },
  modeTabTextActive: { color: '#fff' },

  // Target Bar
  targetBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    marginHorizontal: 15,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  targetBarLabel: { fontSize: 12, fontWeight: 'bold', color: '#F57F17', marginRight: 6 },
  targetBarValue: { fontSize: 12, color: '#333', flex: 1 },

  // Info Panel
  infoPanelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#F5F8FA',
    borderRadius: 10,
    marginHorizontal: 4,
  },
  infoLabel: { fontSize: 11, color: '#98A9B9', fontWeight: '600', marginBottom: 3 },
  infoValue: { fontSize: 16, color: '#208DC0', fontWeight: 'bold' },

  // Position Section
  positionSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E8EF',
    paddingTop: 10,
    marginTop: 5,
    alignItems: 'center',
  },
  positionLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  positionValue: { fontSize: 13, color: '#208DC0', fontWeight: 'bold', marginTop: 2 },
  accuracyText: { fontSize: 11, color: '#98A9B9', marginTop: 2 },
  trackCountText: { fontSize: 11, color: '#6BA5C0', marginTop: 4, fontWeight: '600' },

  // Floating Map Overlay
  floatingInfo: {
    position: 'absolute',
    top: 10,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  floatingRow: { flex: 1, alignItems: 'center' },
  floatingLabel: { fontSize: 10, color: '#98A9B9', fontWeight: '600' },
  floatingValue: { fontSize: 12, color: '#208DC0', fontWeight: 'bold', marginTop: 2 },
  floatingDivider: { width: 1, backgroundColor: '#E0E8EF', marginVertical: 2 },
  floatingStop: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5,
  },
  floatingStopText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  floatingRecenter: {
    position: 'absolute',
    bottom: 100,
    right: 15,
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  floatingRecenterText: { fontSize: 22, color: '#208DC0', fontWeight: 'bold' },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(240, 244, 248, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
  },
  loadingText: { color: '#208DC0', fontWeight: 'bold', fontSize: 16, marginTop: 15 },
  loadingSubText: { color: '#98A9B9', fontSize: 12, marginTop: 5, textAlign: 'center' },

  // Modal
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E8EF',
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
  },
  modalCancel: { fontSize: 15, color: '#E74C3C', fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#208DC0' },
  modalConfirm: { fontSize: 15, color: '#208DC0', fontWeight: 'bold' },
  modalInstruction: {
    backgroundColor: '#FFF8E1',
    padding: 10,
    alignItems: 'center',
  },
  modalInstructionText: { fontSize: 13, color: '#F57F17', fontWeight: '600' },
  modalPickedInfo: {
    backgroundColor: '#fff',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E0E8EF',
  },
  modalPickedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalPickedLabel: { fontSize: 12, color: '#666' },
  modalPickedValue: { fontSize: 13, fontWeight: 'bold', color: '#208DC0' },
});

export default NavigasiKoordinat;
