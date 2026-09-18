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
import AppHeader from '../components/AppHeader';
import CompassView from './CompassView';
import NavigasiService from '../library/NavigasiService';

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

  // Basemap Layer State: 'hybrid' | 'satellite' | 'standard' | 'terrain'
  const [mapType, setMapType] = useState('hybrid');
  const [showLayerModal, setShowLayerModal] = useState(false);

  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerCoord, setMapPickerCoord] = useState(null);
  const [pickerMode, setPickerMode] = useState('target'); // 'target' | 'user'
  const initialUserPosRef = useRef(null);
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
  const previewMapRef = useRef(null);
  const pickerMapRef = useRef(null);

  // Helper validasi koordinat numerik aman
  const isValidCoord = (coord) => {
    return (
      coord != null &&
      typeof coord === 'object' &&
      typeof coord.latitude === 'number' &&
      typeof coord.longitude === 'number' &&
      isFinite(coord.latitude) &&
      isFinite(coord.longitude) &&
      !isNaN(coord.latitude) &&
      !isNaN(coord.longitude)
    );
  };

  const parsedTargetLat = parseFloat(targetLat);
  const parsedTargetLng = parseFloat(targetLng);
  const hasValidTarget =
    !isNaN(parsedTargetLat) &&
    !isNaN(parsedTargetLng) &&
    isFinite(parsedTargetLat) &&
    isFinite(parsedTargetLng) &&
    parsedTargetLat >= -90 &&
    parsedTargetLat <= 90 &&
    parsedTargetLng >= -180 &&
    parsedTargetLng <= 180;

  const targetCoord = hasValidTarget
    ? { latitude: parsedTargetLat, longitude: parsedTargetLng }
    : null;

  // Zoom & Camera Controls
  const handleZoomIn = (targetRef) => {
    const r = targetRef?.current;
    if (r?.getCamera) {
      r.getCamera().then((camera) => {
        if (camera && camera.zoom != null) {
          r.animateCamera({ zoom: camera.zoom + 1 });
        }
      });
    }
  };

  const handleZoomOut = (targetRef) => {
    const r = targetRef?.current;
    if (r?.getCamera) {
      r.getCamera().then((camera) => {
        if (camera && camera.zoom != null) {
          r.animateCamera({ zoom: Math.max(camera.zoom - 1, 1) });
        }
      });
    }
  };

  const handleResetCompass = (targetRef) => {
    const r = targetRef?.current;
    if (r?.animateCamera) {
      r.animateCamera({ heading: 0, pitch: 0 });
    }
  };

  const handleCenterPreviewMap = () => {
    if (!previewMapRef.current) return;
    if (targetCoord && currentPos && isValidCoord(currentPos)) {
      const minLat = Math.min(targetCoord.latitude, currentPos.latitude);
      const maxLat = Math.max(targetCoord.latitude, currentPos.latitude);
      const minLng = Math.min(targetCoord.longitude, currentPos.longitude);
      const maxLng = Math.max(targetCoord.longitude, currentPos.longitude);
      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const deltaLat = Math.max((maxLat - minLat) * 1.4, 0.02);
      const deltaLng = Math.max((maxLng - minLng) * 1.4, 0.02);

      previewMapRef.current.animateToRegion(
        {
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: deltaLat,
          longitudeDelta: deltaLng,
        },
        800
      );
    } else if (targetCoord) {
      previewMapRef.current.animateToRegion(
        {
          latitude: targetCoord.latitude,
          longitude: targetCoord.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    } else if (currentPos && isValidCoord(currentPos)) {
      previewMapRef.current.animateToRegion(
        {
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    }
  };

  // Animate preview map to target when coordinate changes
  useEffect(() => {
    if (targetCoord && previewMapRef.current) {
      handleCenterPreviewMap();
    }
  }, [targetLat, targetLng]);

  // Sinkronisasi dengan background NavigasiService
  useEffect(() => {
    // 1. Cek apakah ada navigasi yang sudah aktif di background saat halaman dibuka
    const active = NavigasiService.getState();
    if (active.isNavigating && active.targetLat && active.targetLng) {
      setTargetLat(active.targetLat.toFixed(6));
      setTargetLng(active.targetLng.toFixed(6));
      setTargetName(active.targetName || '');
      if (active.currentPos && isValidCoord(active.currentPos)) {
        setCurrentPos(active.currentPos);
      }
      if (active.gpsAccuracy) setGpsAccuracy(active.gpsAccuracy);
      setDistance(active.distance || 0);
      setBearing(active.bearing || 0);
      setHeading(active.heading || 0);
      setTrackHistory(active.trackHistory || []);
      setIsTracking(true);
      setViewMode('compass');
    }

    // 2. Subscribe ke update real-time dari background service
    const unsubscribe = NavigasiService.addListener((state) => {
      if (state.isNavigating) {
        setIsTracking((prev) => (!prev ? true : prev));
        if (state.currentPos && isValidCoord(state.currentPos)) {
          setCurrentPos((prev) => {
            if (
              !prev ||
              prev.latitude !== state.currentPos.latitude ||
              prev.longitude !== state.currentPos.longitude
            ) {
              return state.currentPos;
            }
            return prev;
          });
        }
        if (state.gpsAccuracy) {
          setGpsAccuracy((prev) => (prev !== state.gpsAccuracy ? state.gpsAccuracy : prev));
        }
        setDistance((prev) => (Math.abs((prev || 0) - (state.distance || 0)) > 0.5 ? state.distance || 0 : prev));
        setBearing((prev) => (Math.abs((prev || 0) - (state.bearing || 0)) > 0.5 ? state.bearing || 0 : prev));
        setHeading((prev) => (Math.abs((prev || 0) - (state.heading || 0)) > 1 ? state.heading || 0 : prev));
        if (state.trackHistory && state.trackHistory.length > 0) {
          setTrackHistory((prev) => (prev.length !== state.trackHistory.length ? state.trackHistory : prev));
        }
      } else {
        setIsTracking((prev) => (prev ? false : prev));
      }
    });

    return () => {
      // PENTING: Saat keluar / unmount / pindah page, JANGAN hentikan navigasi!
      // Navigasi tetap aktif di background/foreground service
      unsubscribe();
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

  // Hitung jarak & bearing setiap kali posisi atau target berubah saat mode input
  useEffect(() => {
    if (!isTracking && currentPos && targetLat && targetLng) {
      const lat2 = parseFloat(targetLat);
      const lng2 = parseFloat(targetLng);
      if (!isNaN(lat2) && !isNaN(lng2)) {
        const dist = calculateDistance(currentPos.latitude, currentPos.longitude, lat2, lng2);
        const bear = calculateBearing(currentPos.latitude, currentPos.longitude, lat2, lng2);
        setDistance((prev) => (Math.abs((prev || 0) - dist) > 0.5 ? dist : prev));
        setBearing((prev) => (Math.abs((prev || 0) - bear) > 0.5 ? bear : prev));
      }
    }
  }, [isTracking, currentPos?.latitude, currentPos?.longitude, targetLat, targetLng]);

  /** ====== FUNGSI 4: Live GPS Tracking (Berjalan di Latar Belakang) ====== */
  const startTracking = async () => {
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

    setIsLoading(true);
    setIsTracking(true);
    setViewMode('compass');

    const success = await NavigasiService.startNavigation({
      targetLat: lat,
      targetLng: lng,
      targetName: targetName || `Titik Peta (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      currentPos,
    });

    setIsLoading(false);
    if (!success) {
      Alert.alert('Error', 'Gagal memulai navigasi latar belakang.');
      setIsTracking(false);
      setViewMode('input');
    }
  };

  /** Stop GPS tracking */
  const stopTracking = async () => {
    await NavigasiService.stopNavigation();
    setIsTracking(false);
  };

  /** ====== FUNGSI 1: Pilih Target dari Peta ====== */
  const openMapPicker = () => {
    initialUserPosRef.current = currentPos ? { ...currentPos } : null;
    // Jika target sudah ditentukan, posisikan awal di target
    if (targetCoord && isValidCoord(targetCoord)) {
      setInitialRegion({
        latitude: targetCoord.latitude,
        longitude: targetCoord.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setMapPickerCoord({ ...targetCoord });
    } else if (currentPos && isValidCoord(currentPos)) {
      setInitialRegion({
        latitude: currentPos.latitude,
        longitude: currentPos.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setMapPickerCoord(null);
    } else {
      setMapPickerCoord(null);
    }
    setPickerMode('target');
    setShowMapPicker(true);
  };

  const cancelMapPick = () => {
    if (initialUserPosRef.current) {
      setCurrentPos(initialUserPosRef.current);
    }
    setShowMapPicker(false);
  };

  const confirmMapPick = () => {
    if (mapPickerCoord && isValidCoord(mapPickerCoord)) {
      setTargetLat(mapPickerCoord.latitude.toFixed(6));
      setTargetLng(mapPickerCoord.longitude.toFixed(6));
      setTargetName(`Titik Peta (${mapPickerCoord.latitude.toFixed(4)}, ${mapPickerCoord.longitude.toFixed(4)})`);
    }
    setShowMapPicker(false);
  };

  const resetGpsToSensor = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentPos(pos);
        setGpsAccuracy(position.coords.accuracy);
        if (pickerMapRef.current) {
          pickerMapRef.current.animateToRegion(
            {
              latitude: pos.latitude,
              longitude: pos.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            500
          );
        }
      },
      (error) => {
        Alert.alert('Info GPS', 'Gagal memperbarui posisi GPS: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
    Alert.alert(
      'Hentikan Navigasi',
      'Apakah Anda ingin menghentikan sesi navigasi ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hentikan',
          style: 'destructive',
          onPress: async () => {
            await stopTracking();
            setViewMode('input');
          },
        },
      ]
    );
  };

  /** Pindah ke tampilan peta tracking */
  const switchToMapView = () => setViewMode('map');
  const switchToCompassView = () => setViewMode('compass');

  // ====== RENDER ======

  return (
    <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
      {/* Header Reusable */}
      <AppHeader
        title="🧭 Navigasi Koordinat"
        onBack={() => {
          // Navigasi tetap aktif di latar belakang saat kembali
          navigation.goBack();
        }}
        subtitle={
          isTracking ? (
            <View style={s.bgTrackingStatusPill}>
              <View style={s.greenDotLive} />
              <Text style={s.bgTrackingStatusText}>LATAR BELAKANG AKTIF</Text>
            </View>
          ) : null
        }
        rightComponent={
          isTracking ? (
            <TouchableOpacity onPress={backToInput} style={{ padding: 4 }}>
              <Text style={s.headerRightText}>✕</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* ============ VIEW: INPUT MODE ============ */}
      {viewMode === 'input' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* 1. MAP PREVIEW GIS (Sesuai Desain Modern Government GIS Home V2) */}
          <View style={s.mapWrapper}>
            <View style={s.mapContainer}>
              <MapView
                ref={previewMapRef}
                style={s.mapCanvas}
                provider="google"
                mapType={mapType}
                initialRegion={
                  targetCoord
                    ? {
                        latitude: targetCoord.latitude,
                        longitude: targetCoord.longitude,
                        latitudeDelta: 0.03,
                        longitudeDelta: 0.03,
                      }
                    : currentPos && isValidCoord(currentPos)
                    ? {
                        latitude: currentPos.latitude,
                        longitude: currentPos.longitude,
                        latitudeDelta: 0.03,
                        longitudeDelta: 0.03,
                      }
                    : initialRegion
                }
                showsCompass={false}
                toolbarEnabled={false}
                onPress={(e) => {
                  const coord = e.nativeEvent.coordinate;
                  if (isValidCoord(coord)) {
                    setTargetLat(coord.latitude.toFixed(6));
                    setTargetLng(coord.longitude.toFixed(6));
                    setTargetName(
                      `Titik Peta (${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)})`
                    );
                  }
                }}
              >
                {/* Posisi Target Marker dengan Callout Pin */}
                {targetCoord && (
                  <Marker
                    coordinate={targetCoord}
                    anchor={{ x: 0.2, y: 0.5 }}
                    tracksViewChanges={false}
                    draggable={true}
                    onDragEnd={(e) => {
                      const coord = e.nativeEvent.coordinate;
                      if (isValidCoord(coord)) {
                        setTargetLat(coord.latitude.toFixed(6));
                        setTargetLng(coord.longitude.toFixed(6));
                        setTargetName(
                          `Titik Peta (${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)})`
                        );
                      }
                    }}
                  >
                    <View style={s.markerWithCalloutRow}>
                      <View style={s.glowTargetCircle}>
                        <View style={s.glowTargetDot} />
                      </View>
                      <View style={s.darkCalloutPill}>
                        <View style={s.darkCalloutArrow} />
                        <Text style={s.darkCalloutText} numberOfLines={1}>
                          {targetName || `${targetLat}, ${targetLng}`}
                        </Text>
                      </View>
                    </View>
                  </Marker>
                )}

                {/* Posisi Pengguna GPS */}
                {currentPos && isValidCoord(currentPos) && (
                  <>
                    <Circle
                      center={currentPos}
                      radius={
                        gpsAccuracy && isFinite(gpsAccuracy) && gpsAccuracy > 0
                          ? gpsAccuracy
                          : 25
                      }
                      fillColor="rgba(2, 132, 199, 0.2)"
                      strokeColor="rgba(2, 132, 199, 0.6)"
                      strokeWidth={1}
                    />
                    <Marker
                      coordinate={currentPos}
                      anchor={{ x: 0.5, y: 0.5 }}
                      tracksViewChanges={false}
                      draggable={true}
                      onDragEnd={(e) => {
                        const coord = e.nativeEvent.coordinate;
                        if (isValidCoord(coord)) {
                          setCurrentPos(coord);
                        }
                      }}
                    >
                      <View style={s.gpsMarkerCircle}>
                        <View style={s.gpsMarkerInner} />
                      </View>
                    </Marker>
                  </>
                )}

                {/* Garis Menuju Target (Polyline Putus-putus Merah/Oranye) */}
                {targetCoord && currentPos && isValidCoord(currentPos) && (
                  <Polyline
                    coordinates={[currentPos, targetCoord]}
                    strokeColor="#EF4444"
                    strokeWidth={2.5}
                    lineDashPattern={[8, 4]}
                  />
                )}
              </MapView>

              {/* TOP-LEFT OVERLAY BADGE */}
              <View style={s.topLeftCard}>
                <View style={s.mapIconBadge}>
                  <FastImage
                    source={require('../assets/img/map.png')}
                    style={s.mapIconImg}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor="#FFFFFF"
                  />
                </View>
                <View style={s.topLeftTextCol}>
                  <Text style={s.mapTitleHeader}>Peta Target Navigasi</Text>
                  <Text style={s.mapSubHeader} numberOfLines={1}>
                    {targetCoord
                      ? `${targetLat}, ${targetLng}`
                      : 'Ketuk peta untuk tentukan target'}
                  </Text>
                </View>
              </View>

              {/* TOP-RIGHT OVERLAY: PILIH LAYER BUTTON */}
              <TouchableOpacity
                style={s.layerSelectorBtn}
                onPress={() => setShowLayerModal(true)}
                activeOpacity={0.8}
              >
                <FastImage
                  source={require('../assets/img/gis_pirate-map.png')}
                  style={s.layerIcon}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#0284C7"
                />
                <Text style={s.layerText}>Pilih Layer</Text>
                <Text style={s.layerChevron}>⌵</Text>
              </TouchableOpacity>

              {/* RIGHT VERTICAL CONTROLS (KOMPAS, ZOOM IN, ZOOM OUT, LOKASI) */}
              <View style={s.rightControlsStack}>
                <TouchableOpacity
                  style={s.controlCircleBtn}
                  onPress={() => handleResetCompass(previewMapRef)}
                  activeOpacity={0.75}
                  accessibilityLabel="Reset Kompas"
                >
                  <Text style={s.compassIcon}>🧭</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.controlCircleBtn}
                  onPress={() => handleZoomIn(previewMapRef)}
                  activeOpacity={0.75}
                  accessibilityLabel="Perbesar Peta"
                >
                  <Text style={s.zoomIconText}>＋</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.controlCircleBtn}
                  onPress={() => handleZoomOut(previewMapRef)}
                  activeOpacity={0.75}
                  accessibilityLabel="Perkecil Peta"
                >
                  <Text style={s.zoomIconText}>−</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.controlCircleBtn, s.controlCircleAccent]}
                  onPress={handleCenterPreviewMap}
                  activeOpacity={0.75}
                  accessibilityLabel="Pusatkan Peta"
                >
                  <Text style={s.targetIcon}>🎯</Text>
                </TouchableOpacity>
              </View>

              {/* BOTTOM-LEFT INFO CARD */}
              <View style={s.bottomLeftCard}>
                <View style={s.bottomCardContent}>
                  <Text style={s.bottomCardTitle} numberOfLines={1}>
                    {targetName || (targetCoord ? 'Target Terpilih' : 'Belum Ada Target')}
                  </Text>
                  <Text style={s.bottomCardSubtitle} numberOfLines={1}>
                    {targetCoord && currentPos && isValidCoord(currentPos)
                      ? `${formatDistance(distance)} • Arah ${getCompassDirection(bearing)}`
                      : targetCoord
                      ? `${targetLat}, ${targetLng}`
                      : 'Tap peta atau pilih dari modal'}
                  </Text>
                </View>
              </View>

              {/* BOTTOM-RIGHT GRAPHIC SCALE BAR */}
              <View style={s.scaleBarContainer}>
                <Text style={s.scaleText}>0      5      10 km</Text>
                <View style={s.scaleRuler}>
                  <View style={s.rulerSegmentWhite} />
                  <View style={s.rulerSegmentBlack} />
                  <View style={s.rulerSegmentWhite} />
                </View>
              </View>
            </View>
          </View>

          {/* 2. SECTION: PILIH / INPUT TARGET */}
          <View style={s.card}>
            <Text style={s.cardTitle}>🎯 Tentukan Lokasi Target</Text>
            <Text style={s.cardSubtitle}>Pilih dari peta interaktif di atas atau masukkan koordinat manual</Text>

            {/* Tombol Pilih dari Peta Layar Penuh */}
            <TouchableOpacity style={s.mapPickerButton} onPress={openMapPicker}>
              <Text style={s.mapPickerIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.mapPickerText}>Pilih dari Peta Layar Penuh</Text>
                <Text style={s.mapPickerSubText}>Buka peta penuh untuk penempatan titik yang lebih presisi</Text>
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

          {/* 3. CARD DETAIL TARGET TERPILIH */}
          {targetCoord && (
            <View style={s.card}>
              <Text style={s.cardTitle}>📌 Detail Target Terpilih</Text>
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
              {currentPos && isValidCoord(currentPos) && (
                <View style={s.previewDistance}>
                  <Text style={s.previewDistLabel}>Estimasi Jarak & Waktu:</Text>
                  <Text style={s.previewDistValue}>
                    {formatDistance(distance)} ({estimateWalkingTime(distance)})
                  </Text>
                </View>
              )}
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

          {/* Action Buttons: Kembali ke Menu (Tetap Berjalan) & Stop */}
          <View style={{ gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={s.minimizeBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={s.minimizeBtnText}>⇱ KEMBALI KE MENU (TETAP AKTIF)</Text>
            </TouchableOpacity>

            {/* Stop Button */}
            <TouchableOpacity
              style={[s.actionButton, s.stopButton]}
              onPress={backToInput}
              activeOpacity={0.8}
            >
              <Text style={s.actionButtonText}>⏹ HENTIKAN NAVIGASI</Text>
            </TouchableOpacity>
          </View>
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
              mapType={mapType}
              initialRegion={currentPos && isValidCoord(currentPos) ? {
                latitude: currentPos.latitude,
                longitude: currentPos.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              } : initialRegion}
              showsUserLocation={false}
              showsCompass={false}
            >
              {/* Posisi saat ini */}
              {currentPos && isValidCoord(currentPos) && (
                <>
                  <Circle
                    center={currentPos}
                    radius={gpsAccuracy && isFinite(gpsAccuracy) && gpsAccuracy > 0 ? gpsAccuracy : 15}
                    fillColor="rgba(2, 132, 199, 0.2)"
                    strokeColor="rgba(2, 132, 199, 0.6)"
                    strokeWidth={1}
                  />
                  <Marker coordinate={currentPos} anchor={{ x: 0.5, y: 0.5 }} title="Posisi Anda">
                    <View style={s.gpsMarkerCircle}>
                      <View style={s.gpsMarkerInner} />
                    </View>
                  </Marker>
                </>
              )}

              {/* Target Marker */}
              {targetCoord && (
                <Marker
                  coordinate={targetCoord}
                  title="Target"
                  description={targetName || `${targetLat}, ${targetLng}`}
                  pinColor="red"
                />
              )}

              {/* Garis lurus ke target */}
              {currentPos && targetCoord && isValidCoord(currentPos) && (
                <Polyline
                  coordinates={[currentPos, targetCoord]}
                  strokeColor="#EF4444"
                  strokeWidth={2.5}
                  lineDashPattern={[10, 5]}
                />
              )}

              {/* Track history */}
              {trackHistory.length > 1 && (
                <Polyline
                  coordinates={trackHistory}
                  strokeColor="#0284C7"
                  strokeWidth={3.5}
                />
              )}
            </MapView>

            {/* Layer Selector Button di Full Map Tracking */}
            <TouchableOpacity
              style={[s.layerSelectorBtn, { top: 80 }]}
              onPress={() => setShowLayerModal(true)}
              activeOpacity={0.8}
            >
              <FastImage
                source={require('../assets/img/gis_pirate-map.png')}
                style={s.layerIcon}
                resizeMode={FastImage.resizeMode.contain}
                tintColor="#0284C7"
              />
              <Text style={s.layerText}>Layer</Text>
              <Text style={s.layerChevron}>⌵</Text>
            </TouchableOpacity>

            {/* Right Controls di Full Map Tracking */}
            <View style={[s.rightControlsStack, { top: 125 }]}>
              <TouchableOpacity
                style={s.controlCircleBtn}
                onPress={() => handleResetCompass(mapRef)}
                activeOpacity={0.75}
              >
                <Text style={s.compassIcon}>🧭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.controlCircleBtn}
                onPress={() => handleZoomIn(mapRef)}
                activeOpacity={0.75}
              >
                <Text style={s.zoomIconText}>＋</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.controlCircleBtn}
                onPress={() => handleZoomOut(mapRef)}
                activeOpacity={0.75}
              >
                <Text style={s.zoomIconText}>−</Text>
              </TouchableOpacity>
            </View>

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

            {/* Floating Menu & Stop Buttons */}
            <View style={s.floatingActionRow}>
              <TouchableOpacity
                style={s.floatingMenuBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={s.floatingMenuText}>⇱ Menu</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.floatingStop}
                onPress={backToInput}
                activeOpacity={0.8}
              >
                <Text style={s.floatingStopText}>⏹ Stop</Text>
              </TouchableOpacity>
            </View>

            {/* Floating Recenter */}
            {currentPos && isValidCoord(currentPos) && (
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
            <TouchableOpacity onPress={cancelMapPick}>
              <Text style={s.modalCancel}>Batal</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Pilih Lokasi Target</Text>
            <TouchableOpacity
              onPress={confirmMapPick}
              disabled={!mapPickerCoord && !currentPos}
            >
              <Text
                style={[
                  s.modalConfirm,
                  !mapPickerCoord && !currentPos && { color: '#ccc' },
                ]}
              >
                Pilih
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mode Switcher: Target (Merah) vs Posisi Saya (Biru) */}
          <View style={s.pickerModeBar}>
            <TouchableOpacity
              style={[
                s.pickerModeBtn,
                pickerMode === 'target' && s.pickerModeBtnActiveTarget,
              ]}
              onPress={() => setPickerMode('target')}
              activeOpacity={0.8}
            >
              <View style={[s.modeDot, { backgroundColor: '#EF4444' }]} />
              <Text
                style={[
                  s.pickerModeText,
                  pickerMode === 'target' && s.pickerModeTextActiveTarget,
                ]}
              >
                Titik Target (Merah)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.pickerModeBtn,
                pickerMode === 'user' && s.pickerModeBtnActiveUser,
              ]}
              onPress={() => setPickerMode('user')}
              activeOpacity={0.8}
            >
              <View style={[s.modeDot, { backgroundColor: '#2563EB' }]} />
              <Text
                style={[
                  s.pickerModeText,
                  pickerMode === 'user' && s.pickerModeTextActiveUser,
                ]}
              >
                Posisi Saya (Biru)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Instruction */}
          <View
            style={[
              s.modalInstruction,
              pickerMode === 'user'
                ? s.modalInstructionUser
                : s.modalInstructionTarget,
            ]}
          >
            <Text
              style={[
                s.modalInstructionText,
                pickerMode === 'user'
                  ? s.modalInstructionTextUser
                  : s.modalInstructionTextTarget,
              ]}
            >
              {pickerMode === 'user'
                ? '📍 Tap peta atau tahan & geser pin BIRU ke lokasi Anda sebenarnya'
                : '🎯 Tap peta atau tahan & geser pin MERAH untuk target tujuan'}
            </Text>
          </View>

          {/* Container Peta & Overlays */}
          <View style={{ flex: 1, position: 'relative' }}>
            {/* Full Screen Map Picker */}
            <MapView
              ref={pickerMapRef}
              style={{ flex: 1 }}
              provider="google"
              mapType={mapType}
              initialRegion={initialRegion}
              onPress={(e) => {
                const coord = e.nativeEvent.coordinate;
                if (isValidCoord(coord)) {
                  if (pickerMode === 'user') {
                    setCurrentPos(coord);
                  } else {
                    setMapPickerCoord(coord);
                  }
                }
              }}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {/* Picked target marker (Red) */}
              {mapPickerCoord && isValidCoord(mapPickerCoord) && (
                <Marker
                  coordinate={mapPickerCoord}
                  pinColor="red"
                  title="Target Tujuan"
                  description={`Tahan & tarik untuk menggeser (${mapPickerCoord.latitude.toFixed(6)}, ${mapPickerCoord.longitude.toFixed(6)})`}
                  draggable={true}
                  onDragEnd={(e) => {
                    const coord = e.nativeEvent.coordinate;
                    if (isValidCoord(coord)) {
                      setMapPickerCoord(coord);
                    }
                  }}
                />
              )}

              {/* Current pos marker (Blue) */}
              {currentPos && isValidCoord(currentPos) && (
                <Marker
                  coordinate={currentPos}
                  pinColor="blue"
                  title="Posisi Saya"
                  description={`Tahan & tarik pin ini ke lokasi sebenarnya (${currentPos.latitude.toFixed(6)}, ${currentPos.longitude.toFixed(6)})`}
                  draggable={true}
                  onDragEnd={(e) => {
                    const coord = e.nativeEvent.coordinate;
                    if (isValidCoord(coord)) {
                      setCurrentPos(coord);
                    }
                  }}
                />
              )}

              {/* Line from current to target */}
              {mapPickerCoord &&
                currentPos &&
                isValidCoord(currentPos) &&
                isValidCoord(mapPickerCoord) && (
                  <Polyline
                    coordinates={[currentPos, mapPickerCoord]}
                    strokeColor="#EF4444"
                    strokeWidth={2.5}
                    lineDashPattern={[10, 5]}
                  />
                )}
            </MapView>

            {/* Layer Selector Button di Map Picker */}
            <TouchableOpacity
              style={s.layerSelectorBtn}
              onPress={() => setShowLayerModal(true)}
              activeOpacity={0.8}
            >
              <FastImage
                source={require('../assets/img/gis_pirate-map.png')}
                style={s.layerIcon}
                resizeMode={FastImage.resizeMode.contain}
                tintColor="#0284C7"
              />
              <Text style={s.layerText}>Layer</Text>
              <Text style={s.layerChevron}>⌵</Text>
            </TouchableOpacity>

            {/* Right Controls di Map Picker */}
            <View style={s.rightControlsStack}>
              <TouchableOpacity
                style={s.controlCircleBtn}
                onPress={() => handleResetCompass(pickerMapRef)}
                activeOpacity={0.75}
              >
                <Text style={s.compassIcon}>🧭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.controlCircleBtn}
                onPress={() => handleZoomIn(pickerMapRef)}
                activeOpacity={0.75}
              >
                <Text style={s.zoomIconText}>＋</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.controlCircleBtn}
                onPress={() => handleZoomOut(pickerMapRef)}
                activeOpacity={0.75}
              >
                <Text style={s.zoomIconText}>−</Text>
              </TouchableOpacity>

              {/* Focus ke Posisi Saya (Biru) */}
              {currentPos && isValidCoord(currentPos) && (
                <TouchableOpacity
                  style={s.controlCircleBtn}
                  onPress={() => {
                    pickerMapRef.current?.animateToRegion(
                      {
                        latitude: currentPos.latitude,
                        longitude: currentPos.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      },
                      500
                    );
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 16 }}>📍</Text>
                </TouchableOpacity>
              )}

              {/* Focus ke Target (Merah) */}
              {mapPickerCoord && isValidCoord(mapPickerCoord) && (
                <TouchableOpacity
                  style={s.controlCircleBtn}
                  onPress={() => {
                    pickerMapRef.current?.animateToRegion(
                      {
                        latitude: mapPickerCoord.latitude,
                        longitude: mapPickerCoord.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      },
                      500
                    );
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 16 }}>🎯</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Coordinate info bar */}
          <View style={s.modalPickedInfo}>
            <View style={s.modalPickedRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[s.modeDot, { backgroundColor: '#2563EB' }]} />
                <Text style={s.modalPickedLabel}>Posisi Anda:</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={s.modalPickedValue}>
                  {currentPos && isValidCoord(currentPos)
                    ? `${currentPos.latitude.toFixed(6)}, ${currentPos.longitude.toFixed(6)}`
                    : 'Mencari sinyal...'}
                </Text>
                <TouchableOpacity
                  style={s.resetGpsSmallBtn}
                  onPress={resetGpsToSensor}
                  activeOpacity={0.7}
                >
                  <Text style={s.resetGpsSmallText}>↺ Reset GPS</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.modalPickedRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[s.modeDot, { backgroundColor: '#EF4444' }]} />
                <Text style={s.modalPickedLabel}>Titik Target:</Text>
              </View>
              <Text
                style={[
                  s.modalPickedValue,
                  (!mapPickerCoord || !isValidCoord(mapPickerCoord)) && {
                    color: '#94A3B8',
                    fontWeight: 'normal',
                  },
                ]}
              >
                {mapPickerCoord && isValidCoord(mapPickerCoord)
                  ? `${mapPickerCoord.latitude.toFixed(6)}, ${mapPickerCoord.longitude.toFixed(6)}`
                  : 'Belum dipilih (Tap di peta)'}
              </Text>
            </View>

            {mapPickerCoord &&
              isValidCoord(mapPickerCoord) &&
              currentPos &&
              isValidCoord(currentPos) && (
                <View
                  style={[
                    s.modalPickedRow,
                    {
                      marginTop: 4,
                      paddingTop: 6,
                      borderTopWidth: 1,
                      borderTopColor: '#F1F5F9',
                    },
                  ]}
                >
                  <Text style={s.modalPickedLabel}>Jarak Langsung:</Text>
                  <Text style={[s.modalPickedValue, { color: '#E74C3C' }]}>
                    {formatDistance(
                      calculateDistance(
                        currentPos.latitude,
                        currentPos.longitude,
                        mapPickerCoord.latitude,
                        mapPickerCoord.longitude
                      )
                    )}
                  </Text>
                </View>
              )}
          </View>
        </View>
      </Modal>

      {/* ============ MODAL PILIH LAYER BASEMAP ============ */}
      <Modal
        visible={showLayerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLayerModal(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLayerModal(false)}
        >
          <View style={s.layerModalCard}>
            <Text style={s.layerModalTitle}>Tipe Peta Dasar (Basemap)</Text>

            <TouchableOpacity
              style={[
                s.layerOptionRow,
                mapType === 'hybrid' && s.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('hybrid');
                setShowLayerModal(false);
              }}
            >
              <Text style={s.layerOptionIcon}>🛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.layerOptionText}>Citra Satelit & Jalan (Hybrid)</Text>
                <Text style={s.layerOptionSub}>Rekomendasi survei spasial batas</Text>
              </View>
              {mapType === 'hybrid' && <Text style={s.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.layerOptionRow,
                mapType === 'satellite' && s.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('satellite');
                setShowLayerModal(false);
              }}
            >
              <Text style={s.layerOptionIcon}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.layerOptionText}>Satelit Murni</Text>
                <Text style={s.layerOptionSub}>Foto udara resolusi tinggi</Text>
              </View>
              {mapType === 'satellite' && <Text style={s.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.layerOptionRow,
                mapType === 'standard' && s.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('standard');
                setShowLayerModal(false);
              }}
            >
              <Text style={s.layerOptionIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.layerOptionText}>Peta Jalan Vektor (Standar)</Text>
                <Text style={s.layerOptionSub}>Hemat kuota & cepat dimuat</Text>
              </View>
              {mapType === 'standard' && <Text style={s.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.layerOptionRow,
                mapType === 'terrain' && s.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('terrain');
                setShowLayerModal(false);
              }}
            >
              <Text style={s.layerOptionIcon}>⛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.layerOptionText}>Kontur Medan (Terrain)</Text>
                <Text style={s.layerOptionSub}>Elevasi topografi pegunungan</Text>
              </View>
              {mapType === 'terrain' && <Text style={s.checkIcon}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  modalInstructionTarget: {
    backgroundColor: '#FFF7ED',
    borderBottomWidth: 1,
    borderBottomColor: '#FFEDD5',
  },
  modalInstructionTextTarget: {
    color: '#C2410C',
  },
  modalInstructionUser: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  modalInstructionTextUser: {
    color: '#1D4ED8',
  },
  pickerModeBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  pickerModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerModeBtnActiveTarget: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  pickerModeBtnActiveUser: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pickerModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  pickerModeTextActiveTarget: {
    color: '#DC2626',
    fontWeight: '700',
  },
  pickerModeTextActiveUser: {
    color: '#2563EB',
    fontWeight: '700',
  },
  resetGpsSmallBtn: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginLeft: 8,
  },
  resetGpsSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
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

  // Map Preview GIS (Sesuai Desain Home V2)
  mapWrapper: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 4,
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  mapCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  topLeftCard: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '55%',
  },
  mapIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mapIconImg: {
    width: 18,
    height: 18,
  },
  topLeftTextCol: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  mapTitleHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  mapSubHeader: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  layerSelectorBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  layerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  layerChevron: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '800',
    marginLeft: 6,
    marginTop: -1,
  },
  rightControlsStack: {
    position: 'absolute',
    top: 58,
    right: 12,
    zIndex: 15,
    gap: 7,
  },
  controlCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  controlCircleAccent: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  compassIcon: {
    fontSize: 18,
  },
  zoomIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  targetIcon: {
    fontSize: 16,
  },
  markerWithCalloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glowTargetCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowTargetDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  darkCalloutPill: {
    backgroundColor: '#0B192C',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  darkCalloutArrow: {
    position: 'absolute',
    left: -5,
    top: 8,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#0B192C',
  },
  darkCalloutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomLeftCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    maxWidth: '65%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bottomCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  bottomCardSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  scaleBarContainer: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    alignItems: 'center',
    zIndex: 10,
  },
  scaleText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  scaleRuler: {
    flexDirection: 'row',
    width: 66,
    height: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  rulerSegmentWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  rulerSegmentBlack: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gpsMarkerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(2, 132, 199, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  layerModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
  },
  layerModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
    textAlign: 'center',
  },
  layerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  layerOptionActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  layerOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  layerOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  layerOptionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284C7',
    marginLeft: 8,
  },
  bgTrackingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  greenDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  bgTrackingStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  minimizeBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    marginHorizontal: 15,
  },
  minimizeBtnText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  floatingActionRow: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    gap: 10,
    zIndex: 20,
  },
  floatingMenuBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 5,
  },
  floatingMenuText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default NavigasiKoordinat;
