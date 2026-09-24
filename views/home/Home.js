// views/home/Home.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import GpsService from '../library/GpsService';
import {
  useKecamatanQuery,
  usePetaFinalCountQuery,
  usePetaFinalAllQuery,
  usePetadasarKecamatanQuery,
  useRecentActivitiesQuery,
  useAllPlacemarksQuery,
} from '../library/queries';

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
 * Dioptimalkan dengan TanStack Query untuk caching instan tanpa load/render berulang.
 */
const Home = ({ navigation }) => {
  const Route = (routeName) => {
    navigation.navigate(routeName);
  };

  const queryClient = useQueryClient();

  // Redux Store State
  const URL = useSelector((state) => state.URL);
  const TOKEN = useSelector((state) => state.TOKEN);
  const PROFILE = useSelector((state) => state.PROFILE);
  const IS_ONLINE = useSelector((state) => state.IS_ONLINE);
  const NOTIFICATION_COUNT = useSelector((state) => state.NOTIFICATION_COUNT);
  const OFFLINE_QUEUE_COUNT = useSelector((state) => state.OFFLINE_QUEUE_COUNT);

  // Local GIS UI State
  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [activePolygon, setActivePolygon] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ================================================================
  // 1. TANSTACK QUERY INTEGRATION (ZERO-SPINNER CACHED DATA)
  // ================================================================
  const { data: kecamatan = [], isLoading: isKecamatanLoading } = useKecamatanQuery(TOKEN, URL);
  const { data: DATA_FINAL = 0, isLoading: isFinalLoading } = usePetaFinalCountQuery(TOKEN, URL);
  const { data: rawPetadasar = [], isLoading: isPolygonLoading } = usePetadasarKecamatanQuery(TOKEN, URL, selectedKecamatan);
  const { data: rawActivities = [], isLoading: isActivitiesLoading } = useRecentActivitiesQuery(TOKEN, URL, PROFILE);
  // Peta final semua desa (untuk smart overlay: sembunyikan peta dasar jika ada peta final)
  const { data: petaFinalAll = [] } = usePetaFinalAllQuery(TOKEN, URL);
  // Placemark milik sendiri + publik
  const userId = PROFILE?.id || null;
  const { data: allPlacemarks = [] } = useAllPlacemarksQuery(userId);

  // Memoize formatted polygons untuk menghindari hitung ulang luas & filter koordinat
  const petadasar = useMemo(() => {
    if (!Array.isArray(rawPetadasar) || rawPetadasar.length === 0) return [];
    return rawPetadasar.map((item) => {
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
  }, [rawPetadasar]);

  // GPS Sensor & Telemetri State
  const globalPos = useSelector((state) => state.CURRENT_POSITION);
  const globalGpsStatus = useSelector((state) => state.GPS_STATUS);

  const initialUserLoc = globalPos
    ? {
        latitude: globalPos.lat,
        longitude: globalPos.lon,
        accuracy: globalPos.accH,
      }
    : null;

  const [isGpsActive, setIsGpsActive] = useState(
    !!globalPos || globalGpsStatus === 'active' || GpsService.hasAcquired()
  );
  const [userLocation, setUserLocation] = useState(initialUserLoc);
  const mapRef = useRef(null);

  // Sinkronisasi posisi GPS langsung dari GpsService / Redux
  useEffect(() => {
    if (globalPos) {
      setUserLocation({
        latitude: globalPos.lat,
        longitude: globalPos.lon,
        accuracy: globalPos.accH,
      });
      setIsGpsActive(true);
    } else if (globalGpsStatus === 'active' || GpsService.hasAcquired()) {
      setIsGpsActive(true);
    }
  }, [globalPos, globalGpsStatus]);

  useEffect(() => {
    GpsService.startTracking();
  }, []);

  // Center Map to User GPS Location
  const handleCenterLocation = () => {
    const loc =
      userLocation ||
      (globalPos
        ? {
            latitude: globalPos.lat,
            longitude: globalPos.lon,
            accuracy: globalPos.accH,
          }
        : null);

    if (loc && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    } else {
      GpsService.startTracking();
      Alert.alert(
        'GPS Belum Terkunci',
        'Sedang mendeteksi sinyal GPS. Pastikan GPS perangkat Anda telah diaktifkan dan berada di area terbuka.'
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

  // Zoom otomatis saat poligon kecamatan selesai dimuat
  useEffect(() => {
    if (petadasar.length > 0) {
      fitAllPolygons(petadasar);
    }
  }, [petadasar]);

  // Format Waktu Aktivitas
  const formatActivityTime = (dateInput) => {
    if (!dateInput) return 'Baru saja';
    try {
      const normalized = typeof dateInput === 'string' ? dateInput.replace(' ', 'T') : dateInput;
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return String(dateInput);

      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      const pad = (n) => (n < 10 ? '0' + n : n);
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());

      if (isToday) return `Hari ini, ${hours}:${minutes}`;
      if (isYesterday) return `Kemarin, ${hours}:${minutes}`;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${hours}:${minutes}`;
    } catch {
      return String(dateInput);
    }
  };

  // Dynamic Recent Activities Memo
  const recentActivities = useMemo(() => {
    if (!Array.isArray(rawActivities) || rawActivities.length === 0) {
      return [
        {
          id: 'guide-1',
          title: 'Mulai Survei Titik Batas Lapangan',
          subtitle: 'Catat patok pilar batas dengan koordinat GPS akurat',
          time: 'Panduan Cepat',
          badge: 'Titik Batas',
          dotColor: '#16A36A',
          onPress: () => Route('PlacemarkList'),
        },
        {
          id: 'guide-2',
          title: 'Mulai Rekam Trek Jejak Batas',
          subtitle: 'Rekam tracking rute batas desa secara offline-first',
          time: 'Navigasi GPS',
          badge: 'Trek GPS',
          dotColor: '#0284C7',
          onPress: () => Route('TrackRecorder'),
        },
        {
          id: 'guide-3',
          title: 'Pantau Pengajuan & Usulan Batas',
          subtitle: 'Periksa status verifikasi batas desa oleh Tim Tata Pemerintahan',
          time: 'Monitoring',
          badge: 'Verifikasi',
          dotColor: '#F59E0B',
          onPress: () => Route('Monitoring'),
        },
      ];
    }

    return rawActivities.map((act) => ({
      ...act,
      time: formatActivityTime(act.rawTime),
      onPress: () => Route(act.screen || 'Monitoring'),
    }));
  }, [rawActivities]);

  // Pull-to-refresh: invalidate TanStack Query cache
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['kecamatan_list'] }),
      queryClient.invalidateQueries({ queryKey: ['peta_final_count'] }),
      queryClient.invalidateQueries({ queryKey: ['recent_activities'] }),
      selectedKecamatan
        ? queryClient.invalidateQueries({ queryKey: ['petadasar_kecamatan', selectedKecamatan] })
        : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [queryClient, selectedKecamatan]);

  // Selected Kecamatan Name
  const currentKecamatanObj = kecamatan.find(
    (k) => k.kecamatan_id === selectedKecamatan || k.id === selectedKecamatan
  );
  const currentKecamatanName = currentKecamatanObj
    ? currentKecamatanObj.nama_kecamatan || currentKecamatanObj.name
    : '';

  const handleFocusDesa = (desaItem) => {
    if (!desaItem) return;

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#087FC1']} />
        }
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

        {/* 4. MAP PREVIEW (Dominan di Atas — Map-First, React.memo Cached) */}
        <MapPreview
          mapRef={mapRef}
          polygons={petadasar}
          petaFinalAll={petaFinalAll}
          placemarks={allPlacemarks}
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
          isLoading={isKecamatanLoading || isFinalLoading}
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

        {/* 9. AKTIVITAS TERBARU (Dinamis & Interaktif) */}
        <RecentActivity
          activities={recentActivities}
          onViewAllPress={() => Route('Monitoring')}
          onTambahTitikPress={() => Route('PlacemarkList')}
          onRekamTrekPress={() => Route('TrackRecorder')}
        />
      </ScrollView>

      {/* 10. FIXED BOTTOM NAVIGATION */}
      <TabBar />

      {/* 11. DETAIL DESA MODAL (Tabel Data Desa Per Kecamatan Lengkap Pop-Up) */}
      <DetailDesaModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        kecamatanName={currentKecamatanName}
        desaList={petadasar}
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
