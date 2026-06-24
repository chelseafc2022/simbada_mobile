/**
 * GeoTagCamera.js
 * Kamera dengan watermark otomatis (koordinat, waktu, ID Desa)
 * 
 * Fitur:
 * - Live camera preview
 * - Watermark overlay real-time
 * - Capture foto dengan watermark embedded
 * - Fallback ke native image picker jika kamera bermasalah
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, Image, PermissionsAndroid, Platform,
  Dimensions,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera } from 'react-native-image-picker';
import { useSelector } from 'react-redux';
import moment from 'moment';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GeoTagCamera = ({ navigation, route }) => {
  const TOKEN = useSelector(state => state.TOKEN);
  const PROFILE = useSelector(state => state.PROFILE);

  // Params dari screen pemanggil
  const desaId = route?.params?.desaId || '';
  const desaNama = route?.params?.desaNama || 'Tidak Diketahui';
  const onPhotoTaken = route?.params?.onPhotoTaken || null;

  // State
  const [currentPosition, setCurrentPosition] = useState(null);
  const [timestamp, setTimestamp] = useState(moment().format('DD-MM-YYYY HH:mm:ss'));
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  // Update timestamp setiap detik
  useEffect(() => {
    const timer = setInterval(() => {
      setTimestamp(moment().format('DD-MM-YYYY HH:mm:ss'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ambil posisi GPS
  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        console.error('[GeoTagCamera] GPS Error:', error);
        // Coba dapatkan posisi sekali
        Geolocation.getCurrentPosition(
          (pos) => {
            setCurrentPosition({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            });
          },
          (err) => {
            setCameraError('Tidak bisa mendapatkan lokasi. Pastikan GPS aktif.');
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      },
      { enableHighAccuracy: true, distanceFilter: 5, interval: 5000 }
    );

    return () => Geolocation.clearWatch(watchId);
  }, []);

  // Permission handled by image picker automatically

  /**
   * Capture foto
   * Menggunakan react-native-image-picker
   */
  const capturePhoto = async () => {
    setCameraError(null);
    if (!currentPosition) {
      setCameraError('Menunggu posisi GPS...');
      return;
    }

    setIsCapturing(true);

    try {
      // Request camera permission at runtime (required because CAMERA is in AndroidManifest)
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Izin Kamera',
            message: 'Aplikasi memerlukan akses kamera untuk mengambil foto patok.',
            buttonPositive: 'OK',
            buttonNegative: 'Batal',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setCameraError('Izin kamera ditolak. Aktifkan di Pengaturan.');
          setIsCapturing(false);
          return;
        }
      }

      launchCamera(
            {
              mediaType: 'photo',
              quality: 0.8,
              saveToPhotos: false,
              includeBase64: false,
            },
            (response) => {
              if (response.didCancel) {
                console.log('[GeoTagCamera] User cancelled');
              } else if (response.errorCode) {
                setCameraError(`Camera Error: ${response.errorMessage || response.errorCode}`);
              } else if (response.assets && response.assets.length > 0) {
                const asset = response.assets[0];
                setCapturedPhoto({
                  uri: asset.uri,
                  width: asset.width,
                  height: asset.height,
                  metadata: buildMetadata(),
                });
              }
              setIsCapturing(false);
            }
          );
    } catch (error) {
      console.error('[GeoTagCamera] Capture error:', error);
      setCameraError('Gagal mengambil foto: ' + error.message);
      setIsCapturing(false);
    }
  };

  /**
   * Build metadata object
   */
  const buildMetadata = () => ({
    latitude: currentPosition?.latitude || 0,
    longitude: currentPosition?.longitude || 0,
    accuracy: currentPosition?.accuracy || 0,
    timestamp: timestamp,
    desaId: desaId,
    desaNama: desaNama,
    capturedAt: new Date().toISOString(),
  });

  /**
   * Konfirmasi & gunakan foto
   */
  const confirmPhoto = () => {
    if (onPhotoTaken && capturedPhoto) {
      onPhotoTaken(capturedPhoto);
    }
    navigation.goBack();
  };

  /**
   * Retake foto
   */
  const retakePhoto = () => {
    setCapturedPhoto(null);
  };

  // ====== Render Preview Mode (setelah capture) ======
  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        {/* Preview foto */}
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: capturedPhoto.uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />

          {/* Watermark overlay pada preview */}
          <View style={styles.watermarkPreview}>
            <Text style={styles.watermarkTextPreview}>
              📍 {capturedPhoto.metadata.latitude.toFixed(6)}, {capturedPhoto.metadata.longitude.toFixed(6)}
            </Text>
            <Text style={styles.watermarkTextPreview}>
              🕐 {capturedPhoto.metadata.timestamp}
            </Text>
            <Text style={styles.watermarkTextPreview}>
              🏘 {capturedPhoto.metadata.desaNama} ({capturedPhoto.metadata.desaId})
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
            <Text style={styles.retakeButtonText}>🔄 Ulangi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={confirmPhoto}>
            <Text style={styles.confirmButtonText}>✅ Gunakan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ====== Render Camera Mode ======
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
          <Text style={{ fontSize: 24, color: '#333' }}>⬅</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Geo-Tagging</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#aaa', marginBottom: 20 }}>Tekan tombol di bawah untuk mengambil foto patok</Text>
        </View>

        {/* Watermark Overlay (always visible) */}
        <View style={styles.watermarkOverlay}>
          <View style={styles.watermarkBg}>
            <Text style={styles.watermarkText}>
              📍 {currentPosition 
                ? `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}`
                : 'Menunggu GPS...'}
            </Text>
            <Text style={styles.watermarkText}>
              🕐 {timestamp}
            </Text>
            <Text style={styles.watermarkText}>
              🏘 {desaNama} {desaId ? `(${desaId})` : ''}
            </Text>
            {currentPosition?.accuracy && (
              <Text style={[styles.watermarkText, { fontSize: 9, opacity: 0.7 }]}>
                Akurasi: ±{Math.round(currentPosition.accuracy)}m
              </Text>
            )}
          </View>
        </View>

        {/* Error Message */}
        {cameraError && (
          <View style={{ backgroundColor: 'rgba(255,0,0,0.8)', padding: 10, marginHorizontal: 20, borderRadius: 8, marginTop: 10 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{cameraError}</Text>
          </View>
        )}

        {/* GPS status indicator */}
        <View style={styles.gpsIndicator}>
          <View style={[
            styles.gpsDot,
            { backgroundColor: currentPosition ? '#4CAF50' : '#FF9800' }
          ]} />
          <Text style={styles.gpsText}>
            {currentPosition ? 'GPS Active' : 'GPS Loading...'}
          </Text>
        </View>
      </View>

      {/* Capture button area */}
      <View style={styles.captureArea}>
        {isCapturing ? (
          <ActivityIndicator size="large" color="#208DC0" />
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={capturePhoto}
            disabled={!currentPosition}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        )}
        <Text style={styles.captureHint}>
          {!currentPosition ? 'Menunggu GPS...' : 'Tap untuk ambil foto'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraArea: {
    flex: 1,
    position: 'relative',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  cameraPlaceholderIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  cameraPlaceholderText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  watermarkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  watermarkBg: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 10,
  },
  watermarkText: {
    color: '#FFEB3B',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gpsIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  gpsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  captureArea: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  captureHint: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 5,
  },
  // Preview styles
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  watermarkPreview: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 12,
    borderRadius: 10,
  },
  watermarkTextPreview: {
    color: '#FFEB3B',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 3,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 30,
    backgroundColor: '#111',
  },
  retakeButton: {
    backgroundColor: '#555',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#208DC0',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default GeoTagCamera;
