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
import FastImage from 'react-native-fast-image';
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
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [Camera, setCamera] = useState(null);
  const cameraRef = useRef(null);

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
            Alert.alert('GPS Error', 'Tidak bisa mendapatkan lokasi. Pastikan GPS aktif.');
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      },
      { enableHighAccuracy: true, distanceFilter: 5, interval: 5000 }
    );

    return () => Geolocation.clearWatch(watchId);
  }, []);

  // Check camera permission & availability
  useEffect(() => {
    checkCameraPermission();
    checkCameraAvailability();
  }, []);

  const checkCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Izin Kamera',
            message: 'SIMBADA membutuhkan akses kamera untuk fitur Geo-Tagging',
            buttonPositive: 'Izinkan',
          }
        );
        setHasCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.error('[GeoTagCamera] Permission error:', err);
      }
    } else {
      setHasCameraPermission(true); // iOS handled differently
    }
  };

  const checkCameraAvailability = async () => {
    try {
      // Coba import vision camera
      const VisionCamera = require('react-native-vision-camera');
      if (VisionCamera && VisionCamera.Camera) {
        const devices = await VisionCamera.Camera.getAvailableCameraDevices();
        if (devices.length > 0) {
          setCamera(() => VisionCamera.Camera);
          setCameraAvailable(true);
          return;
        }
      }
    } catch (e) {
      console.log('[GeoTagCamera] Vision Camera not available, using fallback mode');
    }
    setCameraAvailable(false);
  };

  /**
   * Capture foto (mode fallback tanpa vision camera)
   * Menggunakan react-native-image-picker atau simulasi
   */
  const capturePhoto = async () => {
    if (!currentPosition) {
      Alert.alert('Tunggu', 'Menunggu posisi GPS...');
      return;
    }

    setIsCapturing(true);

    try {
      // Coba gunakan vision camera jika tersedia
      if (cameraAvailable && cameraRef.current) {
        const photo = await cameraRef.current.takePhoto({
          qualityPrioritization: 'balanced',
        });
        
        const photoData = {
          uri: `file://${photo.path}`,
          width: photo.width,
          height: photo.height,
          metadata: buildMetadata(),
        };

        setCapturedPhoto(photoData);
      } else {
        // Fallback: Gunakan image picker
        try {
          const { launchCamera } = require('react-native-image-picker');
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
                Alert.alert('Error', response.errorMessage);
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
          return; // Return early, callback will handle state
        } catch (pickerError) {
          // Final fallback: show alert with metadata info
          Alert.alert(
            'Info',
            'Kamera tidak tersedia. Install react-native-vision-camera atau react-native-image-picker.\n\n' +
            'Data Geo-Tag yang akan ditambahkan:\n' +
            `Lat: ${currentPosition.latitude.toFixed(6)}\n` +
            `Lng: ${currentPosition.longitude.toFixed(6)}\n` +
            `Waktu: ${timestamp}\n` +
            `Desa: ${desaNama} (${desaId})`
          );
        }
      }
    } catch (error) {
      console.error('[GeoTagCamera] Capture error:', error);
      Alert.alert('Error', 'Gagal mengambil foto: ' + error.message);
    }

    setIsCapturing(false);
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Geo-Tagging</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Camera area / placeholder */}
      <View style={styles.cameraArea}>
        {cameraAvailable && Camera ? (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device="back"
            isActive={true}
            photo={true}
          />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraPlaceholderIcon}>📷</Text>
            <Text style={styles.cameraPlaceholderText}>
              Tap tombol capture di bawah{'\n'}untuk membuka kamera
            </Text>
          </View>
        )}

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
