// views/home/Home.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Geolocation from '@react-native-community/geolocation';

// Modular Home V2 Components (Modern Government GIS + Field Survey)
import HomeHeader from './components/HomeHeader';
import ConnectionStatus from './components/ConnectionStatus';
import SearchBar from './components/SearchBar';
import MapPreview from './components/MapPreview';
import RegionSummary from './components/RegionSummary';
import PrimarySurveyAction from './components/PrimarySurveyAction';
import QuickActions from './components/QuickActions';
import SyncStatus from './components/SyncStatus';
import RecentActivity from './components/RecentActivity';
import DetailDesaModal, {
  calculatePolygonArea,
} from './components/DetailDesaModal';
import TabBar from '../components/TabBar';

/**
 * HOME SIMBADA MOBILE V2
 * Sistem Informasi Batas Desa — Kabupaten Konawe Selatan
 * Filosofi: MAP-FIRST | ACTION-FIRST | OFFLINE-FIRST | MOBILE-FIRST
 */
const Home = ({ navigation }) => {
  const Route = (routeName) => {
    navigation.navigate(routeName);
  };

  // Redux Store State
  const URL = useSelector((state) => state.URL);
  const TOKEN = useSelector((state) => state.TOKEN);
  const IS_ONLINE = useSelector((state) => state.IS_ONLINE);
  const NOTIFICATION_COUNT = useSelector((state) => state.NOTIFICATION_COUNT);
  const OFFLINE_QUEUE_COUNT = useSelector((state) => state.OFFLINE_QUEUE_COUNT);
  const isFocused = useIsFocused();

  // Local GIS & Region State
  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [kecamatan, setKecamatan] = useState([]);
  const [petadasar, setPetadasar] = useState([]);
  const [desa, setDesa] = useState([]);
  const [DATA_FINAL, SET_DATA_FINAL] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolygonLoading, setIsPolygonLoading] = useState(false);
  const [activePolygon, setActivePolygon] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // GPS Sensor & Telemetri State
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  // Cleanup on screen blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        // preserve selected state if user returns, but stop active watchers if needed
      };
    }, [])
  );

  // ================================================================
  // 1. GPS & LOCATION TRACKING
  // ================================================================
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Izin Akses Lokasi GPS',
            message:
              'SIMBADA memerlukan akses GPS untuk pemetaan posisi di lapangan dan survei batas desa.',
            buttonNeutral: 'Nanti',
            buttonNegative: 'Tolak',
            buttonPositive: 'Izinkan',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startGpsTracking = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setIsGpsActive(false);
      return;
    }

    Geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsActive(true);
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (error) => {
        console.log('GPS error:', error.message);
        setIsGpsActive(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = Geolocation.watchPosition(
      (pos) => {
        setIsGpsActive(true);
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (error) => {
        console.log('GPS watch error:', error.message);
        setIsGpsActive(false);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 5000,
        fastestInterval: 2000,
      }
    );
  };

  useEffect(() => {
    if (isFocused) {
      startGpsTracking();
    }
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isFocused]);

  // Center Map to User GPS Location
  const handleCenterLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    } else {
      Geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setUserLocation(loc);
          setIsGpsActive(true);
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: loc.latitude,
                longitude: loc.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              800
            );
          }
        },
        () => {
          Alert.alert(
            'GPS Belum Aktif',
            'Pastikan GPS perangkat Anda telah diaktifkan untuk melihat lokasi saat ini.'
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current && mapRef.current.getCamera) {
      mapRef.current.getCamera().then((camera) => {
        if (camera && camera.zoom) {
          mapRef.current.animateCamera({ zoom: camera.zoom + 1 });
        }
      });
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current && mapRef.current.getCamera) {
      mapRef.current.getCamera().then((camera) => {
        if (camera && camera.zoom) {
          mapRef.current.animateCamera({ zoom: Math.max(camera.zoom - 1, 1) });
        }
      });
    }
  };

  // ================================================================
  // 2. DATA CALCULATION & API INTEGRATION
  // ================================================================

  // Fetch Kecamatan List
  const getKecamatan = async () => {
    if (!TOKEN) return;
    try {
      const response = await fetch(URL.URL_KECAMATAN + 'kecamatan_all', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
      });

      const res_data = await response.json();
      const tampung = [];

      if (Array.isArray(res_data)) {
        res_data.forEach((item) => {
          let kode = '';
          if (item.hasil.kode < 10) {
            kode = `0${item.hasil.kode}`;
          } else {
            kode = `${item.hasil.kode}`;
          }

          tampung.push({
            kecamatan_id: `${item.hasil.no_prop}.0${item.hasil.no_kab}.${kode}`,
            nama_kecamatan: item.hasil.uraian,
          });
        });
      }
      setKecamatan(tampung);
    } catch (error) {
      console.error('Gagal mengambil data kecamatan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Peta Final (Data Disahkan)
  const getPetafinal = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(URL.URL_HOME + 'peta_final', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
      });

      const data = await response.json();
      if (data && data.data && data.data[0]) {
        SET_DATA_FINAL(data.data[0].jumlah_peta_final);
      }
    } catch (error) {
      console.error('Error fetching peta final:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Desa & Poligon Sekaligus Berdasarkan Kecamatan Terpilih
  const getPetadasarAndDesa = async () => {
    if (!selectedKecamatan) {
      setDesa([]);
      setPetadasar([]);
      return;
    }
    try {
      setIsPolygonLoading(true);
      const response = await fetch(URL.URL_KECAMATAN + 'petadasar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const formatted = data.map((item) => {
          const rawCoords = item?.lokasi?.coordinat;
          const area = rawCoords ? calculatePolygonArea(rawCoords) : '0';
          const validCoords = Array.isArray(rawCoords)
            ? rawCoords
                .filter(
                  (c) =>
                    c &&
                    (c.latitude != null || c.lat != null) &&
                    (c.longitude != null || c.lng != null) &&
                    !isNaN(parseFloat(c.latitude ?? c.lat)) &&
                    !isNaN(parseFloat(c.longitude ?? c.lng))
                )
                .map((c) => ({
                  latitude: parseFloat(c.latitude ?? c.lat),
                  longitude: parseFloat(c.longitude ?? c.lng),
                }))
            : [];

          return {
            ...item,
            calculatedArea: area,
            lokasi: {
              ...item.lokasi,
              coordinat: validCoords,
            },
          };
        });

        setDesa(formatted);
        setPetadasar(formatted);
        if (formatted.length > 0) {
          fitAllPolygons(formatted);
        }
      } else {
        setDesa([]);
        setPetadasar([]);
      }
    } catch (error) {
      Alert.alert('Error', 'Gagal memuat koordinat polygon desa');
      console.error('Fetch Error:', error);
    } finally {
      setIsPolygonLoading(false);
    }
  };

  const fitAllPolygons = (polygons) => {
    if (!polygons || polygons.length === 0 || !mapRef.current) return;

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    let hasValidCoordinates = false;

    polygons.forEach((polygon) => {
      const coords = polygon?.lokasi?.coordinat || polygon?.coordinates;
      if (Array.isArray(coords)) {
        coords.forEach((coord) => {
          if (!coord) return;
          const lat =
            coord.latitude != null
              ? parseFloat(coord.latitude)
              : parseFloat(coord.lat);
          const lng =
            coord.longitude != null
              ? parseFloat(coord.longitude)
              : parseFloat(coord.lng);
          if (
            !isNaN(lat) &&
            !isNaN(lng) &&
            isFinite(lat) &&
            isFinite(lng)
          ) {
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            hasValidCoordinates = true;
          }
        });
      }
    });

    if (hasValidCoordinates && minLat <= maxLat && minLng <= maxLng) {
      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const deltaLat = Math.max((maxLat - minLat) * 1.3, 0.02);
      const deltaLng = Math.max((maxLng - minLng) * 1.3, 0.02);

      if (
        isFinite(midLat) &&
        isFinite(midLng) &&
        isFinite(deltaLat) &&
        isFinite(deltaLng)
      ) {
        mapRef.current.animateToRegion(
          {
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: deltaLat,
            longitudeDelta: deltaLng,
          },
          800
        );
      }
    }
  };

  useEffect(() => {
    if (selectedKecamatan) {
      getPetadasarAndDesa();
    }
  }, [selectedKecamatan]);

  useEffect(() => {
    if (isFocused) {
      getKecamatan();
      getPetafinal();
    }
  }, [isFocused]);

  // Selected Kecamatan Name
  const currentKecamatanObj = kecamatan.find(
    (k) => k.kecamatan_id === selectedKecamatan
  );
  const currentKecamatanName = currentKecamatanObj
    ? currentKecamatanObj.nama_kecamatan
    : '';

  const handleFocusDesa = (desaItem) => {
    if (!desaItem) return;

    // Cari objek poligon yang sesuai di petadasar untuk konsistensi struktur koordinat
    const targetItem =
      petadasar.find(
        (p) =>
          (p.des_kel_id && p.des_kel_id === desaItem.des_kel_id) ||
          (p.lokasi?.nama_desa &&
            p.lokasi?.nama_desa === desaItem.lokasi?.nama_desa)
      ) || desaItem;

    setActivePolygon(targetItem);

    const coords =
      targetItem?.lokasi?.coordinat ||
      targetItem?.coordinates ||
      (Array.isArray(targetItem) ? targetItem : null);

    if (coords && coords.length > 0 && mapRef.current) {
      fitAllPolygons([
        {
          lokasi: {
            coordinat: coords,
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 1. HEADER (Compact Modern Government GIS) */}
      <HomeHeader
        notificationCount={NOTIFICATION_COUNT}
        onNotificationPress={() => Route('NotificationList')}
        onProfilePress={() => Route('User')}
      />

      {/* 2. CONNECTION & GPS STATUS INDICATOR */}
      <ConnectionStatus isOnline={IS_ONLINE} isGpsActive={isGpsActive} />

      {/* MAIN VERTICAL SCROLL CONTENT */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. SEARCH BAR (Kecamatan, Desa, Wilayah) */}
        <SearchBar
          kecamatanList={kecamatan}
          selectedKecamatan={selectedKecamatan}
          onSelectKecamatan={(id) => {
            setSelectedKecamatan(id);
            setActivePolygon(null);
          }}
        />

        {/* 4. MAP PREVIEW (Dominan di Atas — Map-First) */}
        <MapPreview
          mapRef={mapRef}
          polygons={petadasar}
          isLoading={isPolygonLoading}
          selectedKecamatanName={currentKecamatanName}
          userLocation={userLocation}
          activePolygon={activePolygon}
          onActivePolygonChange={setActivePolygon}
          onCenterLocation={handleCenterLocation}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onSelectKecamatanPress={() => {}}
          onDetailPolygonPress={(poly) => {
            if (poly) {
              setActivePolygon(poly?.lokasi ? poly : null);
            }
            setShowDetailModal(true);
          }}
        />

        {/* 5. DATA WILAYAH SUMMARY (4 Metrik Kompak) */}
        <RegionSummary
          desaCount={351}
          polygonCount={351}
          verifiedCount={DATA_FINAL || 0}
          kecamatanCount={kecamatan.length || 25}
          isLoading={isLoading}
        />

        {/* 6. PRIMARY SURVEY ACTION (Mulai Survei — Action-First) */}
        <PrimarySurveyAction onPress={() => Route('TrackRecorder')} />

        {/* 7. QUICK ACTIONS (2x2 Grid Aksi Lapangan) */}
        <QuickActions
          onTrackingGpsPress={() => Route('TrackRecorder')}
          onNavigasiPress={() => Route('NavigasiKoordinat')}
          onTambahTitikPress={() => Route('PlacemarkList')}
          onPetaOfflinePress={() => Route('MapImporter')}
        />

        {/* 8. STATUS DATA & SINKRONISASI (Offline-First) */}
        <SyncStatus
          isOnline={IS_ONLINE}
          queueCount={OFFLINE_QUEUE_COUNT}
          lastSyncTime="15 September 2026, 16:30"
          onSyncPress={() => Route('OfflineSync')}
        />

        {/* 9. AKTIVITAS TERBARU (Timeline Ringkas) */}
        <RecentActivity
          activities={[
            {
              id: '1',
              title: 'Survei titik batas Desa Ranomeeto',
              time: 'Hari ini, 09:14',
              dotColor: '#087FC1',
            },
            {
              id: '2',
              title: 'Polygon Desa Ambaipua disahkan',
              time: 'Kemarin, 15:20',
              dotColor: '#16A36A',
            },
            {
              id: '3',
              title: 'Sinkronisasi 3 berkas usulan batas selesai',
              time: '13 Sep 2026, 11:45',
              dotColor: '#F59E0B',
            },
          ]}
          onViewAllPress={() => Route('Monitoring')}
        />
      </ScrollView>

      {/* 10. FIXED BOTTOM NAVIGATION */}
      <TabBar />

      {/* 11. DETAIL DESA MODAL (Tabel Data Desa Per Kecamatan Lengkap Pop-Up) */}
      <DetailDesaModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        kecamatanName={currentKecamatanName}
        desaList={desa}
        activeDesa={activePolygon}
        onSelectDesa={handleFocusDesa}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA', // Background utama bersih
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24, // Ruang agar konten terbawah tidak tertutup TabBar
  },
});

export default Home;
