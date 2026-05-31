/**
 * NavigasiKoordinat.js
 * Screen Navigasi Point-to-Point
 * 
 * Fitur:
 * - Input koordinat target (lat, lng)
 * - Kompas animasi menunjuk arah target
 * - Jarak real-time ke target
 * - Live GPS tracking
 * - Pilih desa sebagai target dari picker
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, ImageBackground, Platform,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import FastImage from 'react-native-fast-image';
import { useSelector } from 'react-redux';
import CompassView from './CompassView';

// ====== Utility Functions (Pure JS, no extra deps) ======

/**
 * Hitung jarak antara 2 titik koordinat (Haversine formula)
 * @returns jarak dalam meter
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Hitung bearing (arah kompas) dari titik 1 ke titik 2
 * @returns bearing dalam derajat (0-360)
 */
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
};

const toRad = (deg) => deg * (Math.PI / 180);

/**
 * Estimasi waktu jalan kaki (asumsi 5 km/h)
 */
const estimateWalkingTime = (distanceMeters) => {
  const speedMps = 5000 / 3600; // 5 km/h dalam m/s
  const seconds = distanceMeters / speedMps;
  if (seconds < 60) return `${Math.round(seconds)} detik`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours} jam ${mins} menit`;
};

/**
 * Format arah kompas ke teks
 */
const getCompassDirection = (bearing) => {
  const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  const index = Math.round(bearing / 45) % 8;
  return dirs[index];
};

// ====== Main Component ======

const NavigasiKoordinat = ({ navigation }) => {
  // Redux state
  const TOKEN = useSelector(state => state.TOKEN);
  const URL = useSelector(state => state.URL);

  // State
  const [targetLat, setTargetLat] = useState('');
  const [targetLng, setTargetLng] = useState('');
  const [currentPos, setCurrentPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [distance, setDistance] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const watchIdRef = useRef(null);
  const headingIntervalRef = useRef(null);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
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

  /**
   * Mulai GPS tracking
   */
  const startTracking = () => {
    const lat = parseFloat(targetLat);
    const lng = parseFloat(targetLng);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Masukkan koordinat target yang valid (format desimal)');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Error', 'Koordinat di luar range valid.\nLatitude: -90 sampai 90\nLongitude: -180 sampai 180');
      return;
    }

    setIsTracking(true);
    setIsLoading(true);

    // Ambil posisi awal
    Geolocation.getCurrentPosition(
      (position) => {
        setCurrentPos({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsAccuracy(position.coords.accuracy);
        setIsLoading(false);
      },
      (error) => {
        Alert.alert('GPS Error', 'Gagal mendapatkan posisi GPS: ' + error.message);
        setIsLoading(false);
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Watch posisi real-time
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        setCurrentPos({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsAccuracy(position.coords.accuracy);
        
        // Gunakan heading dari GPS jika tersedia
        if (position.coords.heading != null && position.coords.heading >= 0) {
          setHeading(position.coords.heading);
        }
      },
      (error) => {
        console.error('[NavigasiKoordinat] Watch error:', error);
      },
      { 
        enableHighAccuracy: true, 
        distanceFilter: 1, // Update setiap 1 meter pergerakan
        interval: 1000,
        fastestInterval: 500,
      }
    );

    // Fallback: simulasi heading update dari compass sensor
    // (react-native-sensors bisa ditambahkan untuk heading yang lebih akurat)
    try {
      const { magnetometer } = require('react-native-sensors');
      const subscription = magnetometer.subscribe(({ x, y, z }) => {
        // Hitung heading dari magnetometer
        let angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = (angle + 360) % 360;
        setHeading(angle);
      });
      headingIntervalRef.current = subscription;
    } catch (e) {
      console.log('[NavigasiKoordinat] Magnetometer not available, using GPS heading');
      // Fallback: gunakan heading dari GPS (sudah di-handle di watchPosition)
    }
  };

  /**
   * Stop GPS tracking
   */
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (headingIntervalRef.current) {
      if (typeof headingIntervalRef.current.unsubscribe === 'function') {
        headingIntervalRef.current.unsubscribe();
      }
      headingIntervalRef.current = null;
    }
    setIsTracking(false);
  };

  /**
   * Gunakan posisi saat ini sebagai referensi
   */
  const useCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        Alert.alert(
          'Posisi Anda Saat Ini',
          `Latitude: ${position.coords.latitude.toFixed(6)}\nLongitude: ${position.coords.longitude.toFixed(6)}\nAkurasi: ${Math.round(position.coords.accuracy)}m`
        );
      },
      (error) => Alert.alert('Error', 'Gagal mendapatkan posisi: ' + error.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity style={localStyles.backButton} onPress={() => navigation.goBack()}>
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <View style={localStyles.headerCenter}>
          <Text style={localStyles.headerTitle}>Navigasi Koordinat</Text>
        </View>
        <View style={{ flex: 1 }} />
      </View>

      <ImageBackground
        source={require('../assets/img/bgbg.jpg')}
        style={{ flex: 1, width: '100%' }}
        resizeMode="cover"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {/* Input Target */}
          <View style={localStyles.inputSection}>
            <Text style={localStyles.sectionTitle}>🎯 Koordinat Target</Text>

            <View style={localStyles.inputRow}>
              <View style={localStyles.inputHalf}>
                <Text style={localStyles.inputLabel}>Latitude</Text>
                <TextInput
                  style={localStyles.input}
                  value={targetLat}
                  onChangeText={setTargetLat}
                  placeholder="-4.2021"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  editable={!isTracking}
                />
              </View>
              <View style={localStyles.inputHalf}>
                <Text style={localStyles.inputLabel}>Longitude</Text>
                <TextInput
                  style={localStyles.input}
                  value={targetLng}
                  onChangeText={setTargetLng}
                  placeholder="122.4819"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  editable={!isTracking}
                />
              </View>
            </View>

            <TouchableOpacity style={localStyles.locationButton} onPress={useCurrentLocation}>
              <Text style={localStyles.locationButtonText}>📍 Lihat Posisi Saya Saat Ini</Text>
            </TouchableOpacity>
          </View>

          {/* Compass View */}
          {isTracking && !isLoading && (
            <View style={localStyles.compassSection}>
              <CompassView
                heading={heading}
                bearing={bearing}
                distance={distance}
              />

              {/* Info Panel */}
              <View style={localStyles.infoPanel}>
                <View style={localStyles.infoPanelRow}>
                  <View style={localStyles.infoItem}>
                    <Text style={localStyles.infoLabel}>Jarak</Text>
                    <Text style={localStyles.infoValue}>
                      {distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`}
                    </Text>
                  </View>
                  <View style={localStyles.infoItem}>
                    <Text style={localStyles.infoLabel}>Arah</Text>
                    <Text style={localStyles.infoValue}>{getCompassDirection(bearing)}</Text>
                  </View>
                </View>
                <View style={localStyles.infoPanelRow}>
                  <View style={localStyles.infoItem}>
                    <Text style={localStyles.infoLabel}>Bearing</Text>
                    <Text style={localStyles.infoValue}>{Math.round(bearing)}°</Text>
                  </View>
                  <View style={localStyles.infoItem}>
                    <Text style={localStyles.infoLabel}>Est. Jalan Kaki</Text>
                    <Text style={localStyles.infoValue}>{estimateWalkingTime(distance)}</Text>
                  </View>
                </View>

                {/* Posisi saat ini */}
                {currentPos && (
                  <View style={localStyles.positionInfo}>
                    <Text style={localStyles.positionLabel}>📍 Posisi Anda:</Text>
                    <Text style={localStyles.positionValue}>
                      {currentPos.latitude.toFixed(6)}, {currentPos.longitude.toFixed(6)}
                    </Text>
                    {gpsAccuracy && (
                      <Text style={localStyles.accuracyText}>
                        Akurasi GPS: ±{Math.round(gpsAccuracy)}m
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Loading */}
          {isLoading && (
            <View style={localStyles.loadingContainer}>
              <ActivityIndicator size="large" color="#208DC0" />
              <Text style={localStyles.loadingText}>Mencari sinyal GPS...</Text>
            </View>
          )}

          {/* Start/Stop Button */}
          <TouchableOpacity
            style={[
              localStyles.actionButton,
              isTracking ? localStyles.stopButton : localStyles.startButton,
            ]}
            onPress={isTracking ? stopTracking : startTracking}
          >
            <Text style={localStyles.actionButtonText}>
              {isTracking ? '⏹ STOP NAVIGASI' : '🧭 MULAI NAVIGASI'}
            </Text>
          </TouchableOpacity>

          {/* Petunjuk */}
          {!isTracking && (
            <View style={localStyles.helpSection}>
              <Text style={localStyles.helpTitle}>📋 Petunjuk Penggunaan:</Text>
              <Text style={localStyles.helpText}>1. Masukkan koordinat target (Latitude & Longitude)</Text>
              <Text style={localStyles.helpText}>2. Tekan "Mulai Navigasi"</Text>
              <Text style={localStyles.helpText}>3. Ikuti arah panah merah pada kompas</Text>
              <Text style={localStyles.helpText}>4. Jarak akan terupdate secara real-time</Text>
              <Text style={localStyles.helpText}>5. Tekan "Stop Navigasi" jika sudah sampai</Text>
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </View>
  );
};

// ====== Styles ======

const localStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    flex: 1,
  },
  headerCenter: {
    flex: 3,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  inputSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 15,
    padding: 15,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208DC0',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputHalf: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 12,
    color: '#98A9B9',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    color: '#000',
    fontSize: 14,
  },
  locationButton: {
    marginTop: 12,
    backgroundColor: '#E0F7FA',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  locationButtonText: {
    color: '#208DC0',
    fontWeight: '600',
    fontSize: 13,
  },
  compassSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  infoPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    margin: 15,
    padding: 15,
    borderRadius: 15,
    width: '90%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoPanelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 11,
    color: '#98A9B9',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#208DC0',
    fontWeight: 'bold',
  },
  positionInfo: {
    borderTopWidth: 1,
    borderTopColor: '#E0E8EF',
    paddingTop: 10,
    marginTop: 5,
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  positionValue: {
    fontSize: 13,
    color: '#208DC0',
    fontWeight: 'bold',
    marginTop: 2,
  },
  accuracyText: {
    fontSize: 11,
    color: '#98A9B9',
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#208DC0',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 10,
  },
  actionButton: {
    marginHorizontal: 15,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  startButton: {
    backgroundColor: '#208DC0',
  },
  stopButton: {
    backgroundColor: '#E74C3C',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    margin: 15,
    padding: 15,
    borderRadius: 15,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#208DC0',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
});

export default NavigasiKoordinat;
