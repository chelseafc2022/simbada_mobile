// views/peta_final/PetaFinal.js — Modern Government GIS Edition
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  StatusBar,
  Platform,
  Switch,
  ScrollView,
  TextInput,
  FlatList,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import TabBar from '../components/TabBar';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { area } from '@turf/area';
import { polygon } from '@turf/helpers';
import {
  usePetaFinalAllQuery,
  usePetaDasarAllQuery,
  useKecamatanQuery,
  useDesaQuery,
} from '../library/queries';

// ─── COLOR PALETTE (HOME & MAPPREVIEW COMPLIANT) ─────────────────────────────
const PRIMARY      = '#0284C7'; // Sky / Blue GIS
const PRIMARY_DARK = '#0369A1';
const DARK_NAVY    = '#0F172A';
const SURFACE      = '#F8FAFC';
const CARD_BG      = '#FFFFFF';
const BORDER_COLOR = '#E2E8F0';
const TEXT_DARK    = '#0F172A';
const TEXT_MID     = '#64748B';

// Polygon styles
const FINAL_STROKE          = '#00E5FF'; // Vibrant cyan-blue border
const FINAL_FILL            = 'rgba(2, 132, 199, 0.35)'; // Crisp blue fill
const FINAL_MINE_STROKE     = '#EF4444'; // Red for operator's village
const FINAL_MINE_FILL       = 'rgba(239, 68, 68, 0.40)';
const FINAL_SELECTED_STROKE = '#F59E0B'; // Vibrant amber for selected polygon
const FINAL_SELECTED_FILL   = 'rgba(245, 158, 11, 0.45)';
const DASAR_STROKE          = '#94A3B8'; // Slate gray for dasar overlay
const DASAR_FILL            = 'rgba(148, 163, 184, 0.22)';

const KONAWE = {
  latitude: -4.2021418,
  longitude: 122.4819808,
  latitudeDelta: 0.9,
  longitudeDelta: 0.9,
};

const calculateArea = (coordinates) => {
  try {
    const geo = coordinates
      .map((c) => (c.latitude && c.longitude ? [c.longitude, c.latitude] : null))
      .filter(Boolean);
    if (geo.length < 3) return '0.00';
    if (
      geo[0][0] !== geo[geo.length - 1][0] ||
      geo[0][1] !== geo[geo.length - 1][1]
    ) {
      geo.push(geo[0]);
    }
    const poly = polygon([geo]);
    return (area(poly) / 1e6).toFixed(2);
  } catch {
    return '0.00';
  }
};

const getCenterPoint = (coords) => {
  if (!coords?.length) return null;
  let latSum = 0, lngSum = 0;
  coords.forEach((c) => {
    latSum += c.latitude;
    lngSum += c.longitude;
  });
  return { latitude: latSum / coords.length, longitude: lngSum / coords.length };
};

const PetaFinal = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const Route = (r) => navigation.navigate(r);

  const TOKEN   = useSelector((s) => s.TOKEN);
  const PROFILE = useSelector((s) => s.PROFILE);
  const URL     = useSelector((s) => s.URL);

  const userStatus        = parseInt(PROFILE?.profile?.status || '1');
  const id_kecamatan_user = PROFILE?.profile?.id_kecamatan || '';
  const id_desa_user      = PROFILE?.profile?.id_desa || '';

  const mapRef = useRef(null);

  // Map settings
  const [mapType, setMapType] = useState('hybrid'); // 'hybrid' | 'satellite' | 'standard' | 'terrain'
  const [showLayerModal, setShowLayerModal] = useState(false);

  // Detail Modal & Selected Polygon
  const [detailModalVisible, setDetailModalVisible]       = useState(false);
  const [selectedPolygonDetail, setSelectedPolygonDetail] = useState(null);

  // Daftar Desa Final Modal & Search
  const [daftarFinalVisible, setDaftarFinalVisible]       = useState(false);
  const [daftarSearchQuery, setDaftarSearchQuery]         = useState('');
  const [daftarSelectedKec, setDaftarSelectedKec]         = useState('');

  // Data & Filters
  const [selectedKecamatan, setSelectedKecamatan] = useState(
    parseInt(userStatus) === 2 || parseInt(userStatus) === 3 ? id_kecamatan_user || '' : ''
  );
  const [selectedDesa, setSelectedDesa]           = useState('');

  // Peta Dasar overlay
  const [showDasar, setShowDasar]                 = useState(false);

  // TanStack Query for Instant Zero-Reload GIS
  const { data: initialFinalData = [], isLoading: isFinalLoading } = usePetaFinalAllQuery(TOKEN, URL);
  const { data: initialDasarData = [], isLoading: isDasarLoading } = usePetaDasarAllQuery(TOKEN, URL);
  const { data: kecamatanList = [] } = useKecamatanQuery(TOKEN, URL);
  const { data: desaList = [] } = useDesaQuery(TOKEN, URL, selectedKecamatan);

  // Metrik dan data katalog seluruh desa final
  const { totalLuasFinal, kecamatanFinalList, filteredDaftarDesa } = useMemo(() => {
    let sumLuas = 0;
    const kecMap = new Map();

    initialFinalData.forEach((item) => {
      const a = parseFloat(calculateArea(item.coordinates));
      if (!isNaN(a)) sumLuas += a;
      if (item.nama_kecamatan) {
        const count = kecMap.get(item.nama_kecamatan) || 0;
        kecMap.set(item.nama_kecamatan, count + 1);
      }
    });

    const kecList = Array.from(kecMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    const q = daftarSearchQuery.trim().toLowerCase();
    const filtered = initialFinalData.filter((item) => {
      const matchKec = !daftarSelectedKec || item.nama_kecamatan === daftarSelectedKec;
      if (!matchKec) return false;
      if (!q) return true;
      const desaName = (item.nama_desa || '').toLowerCase();
      const kecName = (item.nama_kecamatan || '').toLowerCase();
      const kode = (item.kode_desa || '').toLowerCase();
      return desaName.includes(q) || kecName.includes(q) || kode.includes(q);
    });

    return {
      totalLuasFinal: sumLuas.toFixed(2),
      kecamatanFinalList: kecList,
      filteredDaftarDesa: filtered,
    };
  }, [initialFinalData, daftarSearchQuery, daftarSelectedKec]);

  // Bottom Panel animation
  const panelAnim = useRef(new Animated.Value(1)).current;
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const togglePanel = () => {
    Animated.spring(panelAnim, {
      toValue: isPanelOpen ? 0 : 1,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
    setIsPanelOpen((v) => !v);
  };

  // Auto-fit bounds helper
  const fitPolygons = useCallback((polygonList) => {
    if (!polygonList || polygonList.length === 0 || !mapRef.current) return;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    let hasValid = false;

    polygonList.forEach((p) => {
      const coords = p.coordinates || p.lokasi?.coordinat;
      if (Array.isArray(coords)) {
        coords.forEach((c) => {
          const lat = c.latitude != null ? parseFloat(c.latitude) : parseFloat(c.lat);
          const lng = c.longitude != null ? parseFloat(c.longitude) : parseFloat(c.lng);
          if (isFinite(lat) && isFinite(lng) && !isNaN(lat) && !isNaN(lng)) {
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            hasValid = true;
          }
        });
      }
    });

    if (hasValid && minLat <= maxLat && minLng <= maxLng) {
      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const deltaLat = Math.max((maxLat - minLat) * 1.35, 0.03);
      const deltaLng = Math.max((maxLng - minLng) * 1.35, 0.03);
      mapRef.current.animateToRegion(
        {
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: deltaLat,
          longitudeDelta: deltaLng,
        },
        700
      );
    }
  }, []);

  // Helper pencocokan kode desa fleksibel
  const isMatchDesa = useCallback((pKode, filterKode) => {
    if (!pKode || !filterKode) return false;
    const pk = String(pKode).trim();
    const fk = String(filterKode).trim();
    return (
      pk === fk ||
      pk.endsWith(`.${fk}`) ||
      fk.endsWith(`.${pk}`) ||
      pk.replace(/\./g, '') === fk.replace(/\./g, '')
    );
  }, []);

  // Filtered Polygons by Kecamatan / Desa (memoized)
  const activeFinal = useMemo(() => {
    if (!initialFinalData.length) return [];
    if (selectedDesa) {
      const match = initialFinalData.filter((p) => isMatchDesa(p.kode_desa, selectedDesa));
      if (match.length > 0) return match;
    }
    if (selectedKecamatan) {
      return initialFinalData.filter(
        (p) =>
          (p.kode_kecamatan && p.kode_kecamatan === selectedKecamatan) ||
          (p.kode_desa && p.kode_desa.startsWith(selectedKecamatan))
      );
    }
    return initialFinalData;
  }, [selectedDesa, selectedKecamatan, initialFinalData, isMatchDesa]);

  const activeDasar = useMemo(() => {
    if (!initialDasarData.length) return [];
    if (selectedDesa) {
      const match = initialDasarData.filter((p) => isMatchDesa(p.kode_desa, selectedDesa));
      if (match.length > 0) return match;
    }
    if (selectedKecamatan) {
      return initialDasarData.filter(
        (p) =>
          (p.kode_kecamatan && p.kode_kecamatan === selectedKecamatan) ||
          (p.kode_desa && p.kode_desa.startsWith(selectedKecamatan))
      );
    }
    return initialDasarData;
  }, [selectedDesa, selectedKecamatan, initialDasarData, isMatchDesa]);

  const isLoading = isFinalLoading || isDasarLoading;

  // Auto zoom bounds whenever activeFinal or activeDasar changes
  useEffect(() => {
    if (activeFinal.length > 0) {
      fitPolygons(activeFinal);
    } else if (activeDasar.length > 0) {
      fitPolygons(activeDasar);
    }
  }, [activeFinal, activeDasar]);

  const filterByDesa = (val) => {
    setSelectedDesa(val);
  };

  const fetchPolygonDataKecamatan = (kecId) => {
    setSelectedKecamatan(kecId);
  };

  const panelMaxH = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 410],
  });

  // ── Zoom & Navigation Handlers (Identical to MapPreview) ───────────────────
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

  const handleResetCompass = () => {
    if (mapRef.current && mapRef.current.animateCamera) {
      mapRef.current.animateCamera({ heading: 0, pitch: 0 });
    }
  };

  const handleCenterOrFit = () => {
    if (activeFinal.length > 0) {
      fitPolygons(activeFinal);
    } else if (mapRef.current) {
      mapRef.current.animateToRegion(KONAWE, 700);
    }
  };

  // ── Access guard ──────────────────────────────────────────────────────────
  if (userStatus !== 1 && userStatus !== 2 && userStatus !== 3) {
    return (
      <View style={[ss.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar backgroundColor={DARK_NAVY} barStyle="light-content" />
        <FastImage
          style={{ width: 100, height: 100, marginBottom: 20 }}
          source={require('../assets/img/error.png')}
          resizeMode={FastImage.resizeMode.contain}
        />
        <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 20, textAlign: 'center' }}>
          ⚠️ Akses Ditolak
        </Text>
        <Text style={{ color: TEXT_MID, marginTop: 10, textAlign: 'center', paddingHorizontal: 30 }}>
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </Text>
      </View>
    );
  }

  const currentKecName =
    kecamatanList.find((k) => k.id === selectedKecamatan)?.name || '';

  return (
    <View style={ss.root}>
      <StatusBar backgroundColor={DARK_NAVY} barStyle="light-content" />

      {/* HEADER (COMPACT GOVERNMENT GIS STYLE) */}
      <View style={[ss.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={ss.headerLeft}>
          <Text style={ss.headerTitle}>PETA FINAL</Text>
          <Text style={ss.headerSub}>Sistem Informasi Batas Desa • Konawe Selatan</Text>
        </View>
        <TouchableOpacity
          style={ss.headerSwitchBtn}
          onPress={() => Route('PetaDasar')}
          activeOpacity={0.8}
        >
          <FastImage
            style={ss.headerSwitchIcon}
            source={require('../assets/img/gis_pirate-map.png')}
            resizeMode={FastImage.resizeMode.contain}
            tintColor="#FFFFFF"
          />
          <Text style={ss.headerSwitchLabel}>Peta Dasar</Text>
        </TouchableOpacity>
      </View>

      {/* MAP CANVAS */}
      <View style={ss.mapContainer}>
        {isLoading ? (
          <View style={ss.loadingBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={ss.loadingText}>Memuat Geospasial Peta Final...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={KONAWE}
            mapType={mapType}
            showsCompass={false}
            toolbarEnabled={false}
          >
            {/* Dasar overlay (behind) */}
            {showDasar &&
              activeDasar.map((p, i) => {
                const isSelected =
                  selectedPolygonDetail?.kodeDesa === p.kode_desa &&
                  selectedPolygonDetail?.isDasar;
                return (
                  <Polygon
                    key={`dasar-${p.kode_desa}-${i}`}
                    coordinates={p.coordinates}
                    strokeColor={isSelected ? FINAL_SELECTED_STROKE : DASAR_STROKE}
                    fillColor={isSelected ? FINAL_SELECTED_FILL : DASAR_FILL}
                    strokeWidth={isSelected ? 3 : 1.2}
                    zIndex={isSelected ? 8 : 1}
                    tappable={true}
                    onPress={() => {
                      setSelectedPolygonDetail({
                        id: p.id,
                        namaDesa: p.nama_desa || 'Desa',
                        namaKecamatan: p.nama_kecamatan || '',
                        kodeDesa: p.kode_desa || '',
                        kodeKecamatan: p.kode_kecamatan || '',
                        statusPeta: 'Peta Dasar (Pembanding)',
                        catatan: '',
                        isMine: false,
                        isDasar: true,
                        coordinates: p.coordinates,
                      });
                      setDetailModalVisible(true);
                    }}
                  />
                );
              })}

            {/* Final polygons */}
            {activeFinal.map((p, i) => {
              const isSelected =
                selectedPolygonDetail?.kodeDesa === p.kode_desa &&
                !selectedPolygonDetail?.isDasar;
              const isMine =
                userStatus === 2 &&
                id_desa_user &&
                (p.kode_desa === id_desa_user ||
                  id_desa_user.endsWith(`.${p.kode_desa}`));
              return (
                <Polygon
                  key={`final-${p.kode_desa}-${i}`}
                  coordinates={p.coordinates}
                  strokeColor={
                    isSelected
                      ? FINAL_SELECTED_STROKE
                      : isMine
                      ? FINAL_MINE_STROKE
                      : FINAL_STROKE
                  }
                  fillColor={
                    isSelected
                      ? FINAL_SELECTED_FILL
                      : isMine
                      ? FINAL_MINE_FILL
                      : FINAL_FILL
                  }
                  strokeWidth={isSelected ? 3.5 : isMine ? 2.8 : 2}
                  zIndex={isSelected ? 10 : isMine ? 3 : 2}
                  tappable={true}
                  onPress={() => {
                    setSelectedPolygonDetail({
                      id: p.id,
                      namaDesa: p.nama_desa || 'Desa',
                      namaKecamatan: p.nama_kecamatan || '',
                      kodeDesa: p.kode_desa || '',
                      kodeKecamatan: p.kode_kecamatan || '',
                      statusPeta: p.status_peta || 'Telah Disahkan (Final)',
                      catatan: p.catatan || '',
                      isMine,
                      isDasar: false,
                      coordinates: p.coordinates,
                    });
                    setDetailModalVisible(true);
                  }}
                />
              );
            })}

            {/* Marker for selected polygon */}
            {selectedPolygonDetail?.coordinates?.length > 0 && (() => {
              const center = getCenterPoint(selectedPolygonDetail.coordinates);
              if (!center) return null;
              return (
                <Marker
                  coordinate={center}
                  title={selectedPolygonDetail.namaDesa}
                  description={
                    selectedPolygonDetail.namaKecamatan
                      ? `Kec. ${selectedPolygonDetail.namaKecamatan}`
                      : selectedPolygonDetail.statusPeta
                  }
                  pinColor={selectedPolygonDetail.isDasar ? '#94A3B8' : '#F59E0B'}
                />
              );
            })()}

            {/* Marker for operator's village */}
            {userStatus === 2 &&
              id_desa_user &&
              activeFinal
                .filter(
                  (p) =>
                    p.kode_desa === id_desa_user ||
                    id_desa_user.endsWith(`.${p.kode_desa}`)
                )
                .map((p, i) => {
                  const center = getCenterPoint(p.coordinates);
                  if (!center) return null;
                  return (
                    <Marker
                      key={`pin-${i}`}
                      coordinate={center}
                      title="Desa Anda"
                      description={p.nama_desa || 'Lokasi desa Anda'}
                      pinColor="red"
                    />
                  );
                })}
          </MapView>
        )}

        {/* 1. TOP-LEFT OVERLAY CARD (MATCHING MAPPREVIEW) */}
        <View style={ss.topLeftCard}>
          <View style={ss.mapIconBadge}>
            <FastImage
              source={require('../assets/img/map.png')}
              style={ss.mapIconImg}
              resizeMode={FastImage.resizeMode.contain}
              tintColor="#FFFFFF"
            />
          </View>
          <View style={ss.topLeftTextCol}>
            <Text style={ss.mapTitleHeader}>Peta Final Disahkan</Text>
            <Text style={ss.mapSubHeader}>
              {currentKecName
                ? `Kec. ${currentKecName}`
                : `${activeFinal.length} Wilayah Terpetakan`}
            </Text>
          </View>
        </View>

        {/* 2. TOP-RIGHT OVERLAY: PILIH LAYER BUTTON (MATCHING MAPPREVIEW) */}
        <TouchableOpacity
          style={ss.layerSelectorBtn}
          onPress={() => setShowLayerModal(true)}
          activeOpacity={0.8}
        >
          <FastImage
            source={require('../assets/img/gis_pirate-map.png')}
            style={ss.layerIcon}
            resizeMode={FastImage.resizeMode.contain}
            tintColor={PRIMARY}
          />
          <Text style={ss.layerText}>Pilih Layer</Text>
          <Text style={ss.layerChevron}>⌵</Text>
        </TouchableOpacity>

        {/* 3. RIGHT FLOATING CONTROLS (STACK 4 BUTTONS LIKE MAPPREVIEW) */}
        <View style={ss.rightControlsStack}>
          {/* Compass */}
          <TouchableOpacity
            style={ss.controlCircleBtn}
            onPress={handleResetCompass}
            activeOpacity={0.75}
            accessibilityLabel="Reset Arah Utara"
          >
            <Text style={ss.compassIcon}>🧭</Text>
          </TouchableOpacity>

          {/* Zoom In */}
          <TouchableOpacity
            style={ss.controlCircleBtn}
            onPress={handleZoomIn}
            activeOpacity={0.75}
            accessibilityLabel="Perbesar Peta"
          >
            <Text style={ss.zoomIconText}>＋</Text>
          </TouchableOpacity>

          {/* Zoom Out */}
          <TouchableOpacity
            style={ss.controlCircleBtn}
            onPress={handleZoomOut}
            activeOpacity={0.75}
            accessibilityLabel="Perkecil Peta"
          >
            <Text style={ss.zoomIconText}>−</Text>
          </TouchableOpacity>

          {/* Fit / Center Target */}
          <TouchableOpacity
            style={[ss.controlCircleBtn, ss.controlCircleAccent]}
            onPress={handleCenterOrFit}
            activeOpacity={0.75}
            accessibilityLabel="Pusatkan Peta"
          >
            <Text style={ss.targetIcon}>🎯</Text>
          </TouchableOpacity>
        </View>

        {/* 4. BOTTOM-RIGHT: GIS GRAPHIC SCALE BAR (MATCHING MAPPREVIEW) */}
        <View style={ss.scaleBarContainer}>
          <Text style={ss.scaleText}>0      5      10 km</Text>
          <View style={ss.scaleRuler}>
            <View style={ss.rulerSegmentWhite} />
            <View style={ss.rulerSegmentBlack} />
            <View style={ss.rulerSegmentWhite} />
          </View>
        </View>

        {/* TOMBOL FLOATING: DAFTAR DESA FINAL */}
        <TouchableOpacity
          style={ss.daftarFinalFloatingBtn}
          onPress={() => setDaftarFinalVisible(true)}
          activeOpacity={0.82}
        >
          <View style={ss.daftarFinalFloatingBadge}>
            <Text style={{ fontSize: 13 }}>📋</Text>
          </View>
          <Text style={ss.daftarFinalFloatingText}>
            Daftar Desa Final ({initialFinalData.length})
          </Text>
        </TouchableOpacity>

        {/* RESET FILTER CHIP (WHEN DESA FILTERED) */}
        {selectedDesa ? (
          <TouchableOpacity
            style={ss.resetChip}
            onPress={() => {
              setSelectedDesa('');
              if (activeFinal.length > 0) fitPolygons(activeFinal);
            }}
          >
            <Text style={ss.resetChipText}>✕ Reset Filter Desa</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* BOTTOM PANEL (CLEAN MODERN GIS DRAWER) */}
      <Animated.View style={[ss.panel, { maxHeight: panelMaxH }]}>
        <TouchableOpacity
          style={ss.dragRow}
          onPress={togglePanel}
          activeOpacity={0.7}
        >
          <View style={ss.dragHandle} />
          <View style={ss.panelHeaderInfo}>
            <Text style={ss.panelTitle}>WILAYAH & OVERLAY LAYER</Text>
            <Text style={ss.panelSubTitle}>Pilih filter batas wilayah desa</Text>
          </View>
          <View style={ss.chevronWrap}>
            <Text style={ss.chevronText}>{isPanelOpen ? '▾' : '▴'}</Text>
          </View>
        </TouchableOpacity>

        {isPanelOpen && (
          <View style={ss.panelContent}>
            {/* Dasar Toggle Row (Sleek Clean Card) */}
            <TouchableOpacity
              style={ss.toggleCard}
              onPress={() => setShowDasar((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={ss.toggleLeft}>
                <View style={ss.toggleIconBadge}>
                  <FastImage
                    source={require('../assets/img/gis_pirate-map.png')}
                    style={ss.toggleIconImg}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor={PRIMARY}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.toggleLabel}>Tampilkan Peta Dasar</Text>
                  <Text style={ss.toggleSub}>
                    Overlay layer batas dasar sebagai pembanding
                  </Text>
                </View>
              </View>
              <Switch
                value={showDasar}
                onValueChange={setShowDasar}
                trackColor={{ false: '#CBD5E1', true: PRIMARY }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Legend Badges */}
            <View style={ss.legendRow}>
              <View style={ss.legendBadge}>
                <View style={[ss.legendColorDot, { backgroundColor: '#00E5FF' }]} />
                <Text style={ss.legendLabel}>Peta Final (Disahkan)</Text>
              </View>
              {showDasar && (
                <View style={ss.legendBadge}>
                  <View style={[ss.legendColorDot, { backgroundColor: '#94A3B8' }]} />
                  <Text style={ss.legendLabel}>Peta Dasar</Text>
                </View>
              )}
              {userStatus === 2 && (
                <View style={ss.legendBadge}>
                  <View style={[ss.legendColorDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={ss.legendLabel}>Desa Anda</Text>
                </View>
              )}
            </View>

            {/* Tombol Akses Cepat: Katalog Seluruh Desa Final */}
            <TouchableOpacity
              style={ss.btnKatalogFinal}
              onPress={() => setDaftarFinalVisible(true)}
              activeOpacity={0.85}
            >
              <View style={ss.katalogIconWrap}>
                <Text style={{ fontSize: 16 }}>📑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.katalogTitle}>Daftar Desa yang Sudah Final</Text>
                <Text style={ss.katalogSub}>
                  {initialFinalData.length} desa resmi ditetapkan • Cari & sorot cepat
                </Text>
              </View>
              <View style={ss.katalogBadge}>
                <Text style={ss.katalogBadgeText}>{initialFinalData.length} Desa</Text>
              </View>
            </TouchableOpacity>

            {/* Dropdown Kecamatan */}
            <View
              style={[
                ss.pickerCard,
                (userStatus === 2 || userStatus === 3) && ss.pickerDim,
              ]}
            >
              <Text style={ss.pickerHeaderLabel}>KECAMATAN</Text>
              <Picker
                style={ss.pickerInput}
                selectedValue={selectedKecamatan}
                onValueChange={(val) => {
                  setSelectedKecamatan(val);
                  setSelectedDesa('');
                  if (val) {
                    fetchPolygonDataKecamatan(val);
                  } else {
                    if (initialFinalData.length > 0) fitPolygons(initialFinalData);
                  }
                }}
                enabled={userStatus !== 2 && userStatus !== 3}
                dropdownIconColor={PRIMARY}
              >
                <Picker.Item label="— Pilih Kecamatan —" value="" />
                {kecamatanList.map((item) => (
                  <Picker.Item key={item.id} label={item.name} value={item.id} />
                ))}
              </Picker>
            </View>

            {/* Dropdown Desa */}
            {userStatus !== 2 && (
              <View style={[ss.pickerCard, !selectedKecamatan && ss.pickerDim]}>
                <Text style={ss.pickerHeaderLabel}>DESA / KELURAHAN</Text>
                <Picker
                  style={ss.pickerInput}
                  selectedValue={selectedDesa}
                  onValueChange={(val) => {
                    setSelectedDesa(val);
                    if (val) filterByDesa(val);
                  }}
                  enabled={!!selectedKecamatan}
                  dropdownIconColor={PRIMARY}
                >
                  <Picker.Item label="— Pilih Desa —" value="" />
                  {desaList.map((item) => (
                    <Picker.Item key={item.id} label={item.name} value={item.id} />
                  ))}
                </Picker>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      <TabBar />

      {/* DETAIL MODAL DESA FINAL */}
      <Modal
        animationType="slide"
        transparent
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={ss.modalOverlay}>
          <View style={ss.modalSheet}>
            <View style={ss.modalHandleBar} />
            <View style={ss.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={[
                    ss.detailBadgeIcon,
                    selectedPolygonDetail?.isDasar && { backgroundColor: '#F1F5F9' },
                  ]}
                >
                  <FastImage
                    source={require('../assets/img/gis_pirate-map.png')}
                    style={{ width: 18, height: 18 }}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor={selectedPolygonDetail?.isDasar ? '#64748B' : PRIMARY}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.modalTitle} numberOfLines={1}>
                    {selectedPolygonDetail?.namaDesa
                      ? `DESA ${selectedPolygonDetail.namaDesa.toUpperCase()}`
                      : 'Detail Wilayah'}
                  </Text>
                  <Text style={ss.modalSubtitle}>
                    {selectedPolygonDetail?.namaKecamatan
                      ? `Kecamatan ${selectedPolygonDetail.namaKecamatan}`
                      : 'Kabupaten Konawe Selatan'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={ss.modalCloseBtn}
              >
                <Text style={ss.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedPolygonDetail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status Badge Banner */}
                <View
                  style={[
                    ss.statusBanner,
                    selectedPolygonDetail.isDasar
                      ? ss.statusBannerDasar
                      : ss.statusBannerFinal,
                  ]}
                >
                  <Text style={ss.statusBannerIcon}>
                    {selectedPolygonDetail.isDasar ? '🗺️' : '✅'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={
                        selectedPolygonDetail.isDasar
                          ? ss.statusBannerTextDasar
                          : ss.statusBannerTextFinal
                      }
                    >
                      {selectedPolygonDetail.statusPeta}
                    </Text>
                    <Text style={ss.statusBannerSub}>
                      {selectedPolygonDetail.isDasar
                        ? 'Layer garis batas peta dasar sebagai referensi'
                        : 'Batas wilayah telah resmi disahkan dan berstatus final'}
                    </Text>
                  </View>
                </View>

                <View style={ss.infoRow}>
                  <Text style={ss.infoLabel}>Kode Wilayah (Kemendagri)</Text>
                  <Text
                    style={[
                      ss.infoValue,
                      { fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },
                    ]}
                  >
                    {selectedPolygonDetail.kodeDesa || '—'}
                  </Text>
                </View>

                {selectedPolygonDetail.namaKecamatan ? (
                  <View style={ss.infoRow}>
                    <Text style={ss.infoLabel}>Kecamatan</Text>
                    <Text style={ss.infoValue}>{selectedPolygonDetail.namaKecamatan}</Text>
                  </View>
                ) : null}

                <View style={ss.infoRow}>
                  <Text style={ss.infoLabel}>Estimasi Luas Area</Text>
                  <Text style={ss.infoValue}>
                    {calculateArea(selectedPolygonDetail.coordinates)} km²
                  </Text>
                </View>

                <View style={ss.infoRow}>
                  <Text style={ss.infoLabel}>Jumlah Titik Koordinat</Text>
                  <Text style={ss.infoValue}>
                    {selectedPolygonDetail.coordinates?.length || 0} titik
                  </Text>
                </View>

                {selectedPolygonDetail.catatan ? (
                  <View style={ss.infoRow}>
                    <Text style={ss.infoLabel}>Catatan Penetapan</Text>
                    <Text style={ss.infoValue}>{selectedPolygonDetail.catatan}</Text>
                  </View>
                ) : null}

                {/* Quick Action Button: Filter / Focus to this Village */}
                <TouchableOpacity
                  style={ss.btnFilterThisDesa}
                  onPress={() => {
                    if (selectedPolygonDetail.kodeKecamatan) {
                      setSelectedKecamatan(selectedPolygonDetail.kodeKecamatan);
                    }
                    setSelectedDesa(selectedPolygonDetail.kodeDesa);
                    setDetailModalVisible(false);
                    fitPolygons([{ coordinates: selectedPolygonDetail.coordinates }]);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={ss.btnFilterThisDesaText}>🎯 Fokuskan Filter ke Desa Ini</Text>
                </TouchableOpacity>

                <Text style={ss.coordTitle}>Daftar Titik Koordinat Geospasial</Text>
                <View style={ss.coordBox}>
                  {selectedPolygonDetail.coordinates?.slice(0, 10).map((c, i) => (
                    <Text key={i} style={ss.coordItem}>
                      {i + 1}.  {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}
                    </Text>
                  ))}
                  {selectedPolygonDetail.coordinates?.length > 10 && (
                    <Text style={ss.coordMore}>
                      + {selectedPolygonDetail.coordinates.length - 10} titik lainnya
                    </Text>
                  )}
                </View>
                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL DAFTAR DESA YANG SUDAH FINAL */}
      <Modal
        animationType="slide"
        transparent
        visible={daftarFinalVisible}
        onRequestClose={() => setDaftarFinalVisible(false)}
      >
        <View style={ss.modalOverlay}>
          <View style={[ss.modalSheet, { maxHeight: '90%' }]}>
            <View style={ss.modalHandleBar} />

            {/* Modal Header */}
            <View style={ss.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={ss.daftarModalBadgeIcon}>
                  <Text style={{ fontSize: 18 }}>🏛️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.modalTitle}>DAFTAR DESA FINAL</Text>
                  <Text style={ss.modalSubtitle}>
                    {initialFinalData.length} Desa Telah Ditetapkan Resmi
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setDaftarFinalVisible(false)}
                style={ss.modalCloseBtn}
              >
                <Text style={ss.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Metrik Bar Ringkas (3 Cards) */}
            <View style={ss.daftarStatsRow}>
              <View style={ss.daftarStatCard}>
                <Text style={ss.daftarStatLabel}>TOTAL DESA</Text>
                <Text style={[ss.daftarStatVal, { color: PRIMARY }]}>
                  {initialFinalData.length} Desa
                </Text>
              </View>
              <View style={ss.daftarStatCard}>
                <Text style={ss.daftarStatLabel}>KECAMATAN</Text>
                <Text style={[ss.daftarStatVal, { color: '#059669' }]}>
                  {kecamatanFinalList.length} Kec.
                </Text>
              </View>
              <View style={ss.daftarStatCard}>
                <Text style={ss.daftarStatLabel}>TOTAL LUAS</Text>
                <Text style={[ss.daftarStatVal, { color: '#D97706' }]}>
                  {totalLuasFinal} km²
                </Text>
              </View>
            </View>

            {/* Search Input Bar */}
            <View style={ss.searchBarWrap}>
              <Text style={ss.searchBarIcon}>🔍</Text>
              <TextInput
                style={ss.searchBarInput}
                placeholder="Cari nama desa, kecamatan, atau kode..."
                placeholderTextColor={TEXT_MID}
                value={daftarSearchQuery}
                onChangeText={setDaftarSearchQuery}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
              {daftarSearchQuery ? (
                <TouchableOpacity
                  onPress={() => setDaftarSearchQuery('')}
                  style={ss.searchClearBtn}
                >
                  <Text style={ss.searchClearText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Chip Kecamatan Horizontal */}
            {kecamatanFinalList.length > 0 && (
              <View style={ss.filterKecScrollViewWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={ss.filterKecScrollContent}
                >
                  <TouchableOpacity
                    style={[
                      ss.filterKecChip,
                      !daftarSelectedKec && ss.filterKecChipActive,
                    ]}
                    onPress={() => setDaftarSelectedKec('')}
                  >
                    <Text
                      style={[
                        ss.filterKecChipText,
                        !daftarSelectedKec && ss.filterKecChipTextActive,
                      ]}
                    >
                      Semua ({initialFinalData.length})
                    </Text>
                  </TouchableOpacity>
                  {kecamatanFinalList.map((k) => {
                    const isKecActive = daftarSelectedKec === k.name;
                    return (
                      <TouchableOpacity
                        key={k.name}
                        style={[
                          ss.filterKecChip,
                          isKecActive && ss.filterKecChipActive,
                        ]}
                        onPress={() => setDaftarSelectedKec(isKecActive ? '' : k.name)}
                      >
                        <Text
                          style={[
                            ss.filterKecChipText,
                            isKecActive && ss.filterKecChipTextActive,
                          ]}
                        >
                          {k.name} ({k.count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* List Desa Final */}
            <FlatList
              data={filteredDaftarDesa}
              keyExtractor={(item, index) => item.id || item.kode_desa || `desa-${index}`}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
              ListEmptyComponent={
                <View style={ss.emptyDaftarBox}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔎</Text>
                  <Text style={ss.emptyDaftarTitle}>Desa Tidak Ditemukan</Text>
                  <Text style={ss.emptyDaftarSub}>
                    Tidak ada desa final yang cocok dengan pencarian "{daftarSearchQuery}"
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const desaArea = calculateArea(item.coordinates);
                const isSelected = selectedPolygonDetail?.kodeDesa === item.kode_desa;
                return (
                  <TouchableOpacity
                    style={[
                      ss.desaItemCard,
                      isSelected && ss.desaItemCardSelected,
                    ]}
                    onPress={() => {
                      setDaftarFinalVisible(false);
                      setSelectedPolygonDetail({
                        id: item.id,
                        namaDesa: item.nama_desa || 'Desa',
                        namaKecamatan: item.nama_kecamatan || '',
                        kodeDesa: item.kode_desa || '',
                        kodeKecamatan: item.kode_kecamatan || '',
                        statusPeta: item.status_peta || 'Telah Disahkan (Final)',
                        catatan: item.catatan || '',
                        isMine: false,
                        isDasar: false,
                        coordinates: item.coordinates,
                      });
                      if (item.kode_kecamatan) {
                        setSelectedKecamatan(item.kode_kecamatan);
                      }
                      setSelectedDesa(item.kode_desa);
                      fitPolygons([{ coordinates: item.coordinates }]);
                    }}
                    activeOpacity={0.78}
                  >
                    <View style={ss.desaItemHeaderRow}>
                      <View style={ss.desaNumberBadge}>
                        <Text style={ss.desaNumberText}>{index + 1}</Text>
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={ss.desaItemName} numberOfLines={1}>
                          {item.nama_desa ? item.nama_desa.toUpperCase() : 'DESA'}
                        </Text>
                        <Text style={ss.desaItemKec}>
                          📍 Kec. {item.nama_kecamatan || 'Konawe Selatan'}
                        </Text>
                      </View>
                      <View style={ss.desaStatusBadge}>
                        <Text style={ss.desaStatusText}>✓ FINAL</Text>
                      </View>
                    </View>

                    <View style={ss.desaItemMetaRow}>
                      <View style={ss.desaItemMetaChip}>
                        <Text style={ss.desaItemMetaLabel}>Kode:</Text>
                        <Text style={ss.desaItemMetaValue}>{item.kode_desa || '—'}</Text>
                      </View>
                      <View style={ss.desaItemMetaChip}>
                        <Text style={ss.desaItemMetaLabel}>Luas:</Text>
                        <Text style={[ss.desaItemMetaValue, { color: '#059669', fontWeight: '800' }]}>
                          {desaArea} km²
                        </Text>
                      </View>
                      <View style={ss.desaItemMetaChip}>
                        <Text style={ss.desaItemMetaLabel}>Titik:</Text>
                        <Text style={ss.desaItemMetaValue}>{item.coordinates?.length || 0}</Text>
                      </View>
                    </View>

                    <View style={ss.desaActionFooter}>
                      <Text style={ss.desaActionText}>🎯 Lihat di Peta</Text>
                      <Text style={ss.desaActionArrow}>➔</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* MODAL PILIH LAYER BASEMAP (IDENTICAL TO MAPPREVIEW) */}
      <Modal
        visible={showLayerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLayerModal(false)}
      >
        <TouchableOpacity
          style={ss.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLayerModal(false)}
        >
          <View style={ss.layerModalCard}>
            <Text style={ss.layerModalTitle}>Tipe Peta Dasar (Basemap)</Text>

            <TouchableOpacity
              style={[
                ss.layerOptionRow,
                mapType === 'hybrid' && ss.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('hybrid');
                setShowLayerModal(false);
              }}
            >
              <Text style={ss.layerOptionIcon}>🛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={ss.layerOptionText}>Citra Satelit & Jalan (Hybrid)</Text>
                <Text style={ss.layerOptionSub}>Rekomendasi survei spasial batas</Text>
              </View>
              {mapType === 'hybrid' && <Text style={ss.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                ss.layerOptionRow,
                mapType === 'satellite' && ss.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('satellite');
                setShowLayerModal(false);
              }}
            >
              <Text style={ss.layerOptionIcon}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={ss.layerOptionText}>Satelit Murni</Text>
                <Text style={ss.layerOptionSub}>Foto udara resolusi tinggi</Text>
              </View>
              {mapType === 'satellite' && <Text style={ss.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                ss.layerOptionRow,
                mapType === 'standard' && ss.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('standard');
                setShowLayerModal(false);
              }}
            >
              <Text style={ss.layerOptionIcon}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={ss.layerOptionText}>Peta Jalan Vektor (Standar)</Text>
                <Text style={ss.layerOptionSub}>Hemat kuota & cepat dimuat</Text>
              </View>
              {mapType === 'standard' && <Text style={ss.checkIcon}>✓</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                ss.layerOptionRow,
                mapType === 'terrain' && ss.layerOptionActive,
              ]}
              onPress={() => {
                setMapType('terrain');
                setShowLayerModal(false);
              }}
            >
              <Text style={ss.layerOptionIcon}>⛰️</Text>
              <View style={{ flex: 1 }}>
                <Text style={ss.layerOptionText}>Kontur Medan (Terrain)</Text>
                <Text style={ss.layerOptionSub}>Elevasi topografi pegunungan</Text>
              </View>
              {mapType === 'terrain' && <Text style={ss.checkIcon}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ─── STYLES (GEO-SAPPHIRE MODERN GOVERNMENT GIS) ─────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DARK_NAVY,
  },

  // HEADER
  header: {
    backgroundColor: DARK_NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Poppins-ExtraBoldItalic',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: -2,
  },
  headerSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  headerSwitchIcon: {
    width: 16,
    height: 16,
  },
  headerSwitchLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // MAP CONTAINER
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: DARK_NAVY,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_NAVY,
  },
  loadingText: {
    marginTop: 12,
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },

  // 1. TOP-LEFT OVERLAY CARD
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
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  mapIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: PRIMARY,
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
  },
  mapTitleHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: -0.2,
  },
  mapSubHeader: {
    fontSize: 10,
    fontWeight: '500',
    color: TEXT_MID,
    marginTop: 1,
  },

  // 2. TOP-RIGHT LAYER SELECTOR
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
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  layerIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  layerText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  layerChevron: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: '800',
    marginLeft: 6,
    marginTop: -1,
  },

  // 3. RIGHT FLOATING CONTROLS
  rightControlsStack: {
    position: 'absolute',
    top: 62,
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
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.18,
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
    color: TEXT_DARK,
    lineHeight: 22,
  },
  targetIcon: {
    fontSize: 16,
  },

  // 4. GRAPHIC SCALE BAR
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
    backgroundColor: DARK_NAVY,
  },

  // FLOATING DAFTAR FINAL BUTTON
  daftarFinalFloatingBtn: {
    position: 'absolute',
    top: 60,
    left: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  daftarFinalFloatingBadge: {
    marginRight: 6,
  },
  daftarFinalFloatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: -0.2,
  },

  // RESET CHIP
  resetChip: {
    position: 'absolute',
    top: 104,
    left: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 4,
    zIndex: 15,
  },
  resetChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // BOTTOM PANEL
  panel: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 10,
    overflow: 'hidden',
  },
  dragRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginRight: 12,
  },
  panelHeaderInfo: {
    flex: 1,
  },
  panelTitle: {
    color: TEXT_DARK,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  panelSubTitle: {
    color: TEXT_MID,
    fontSize: 10,
    marginTop: 1,
  },
  chevronWrap: {
    paddingHorizontal: 6,
  },
  chevronText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '800',
  },

  panelContent: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // TOGGLE ROW (PETA DASAR OVERLAY)
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  toggleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toggleIconImg: {
    width: 18,
    height: 18,
  },
  toggleLabel: {
    color: TEXT_DARK,
    fontWeight: '700',
    fontSize: 12,
  },
  toggleSub: {
    color: TEXT_MID,
    fontSize: 10,
    marginTop: 1,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackActive: {
    backgroundColor: PRIMARY,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },

  // LEGEND ROW
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  legendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  legendColorDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_DARK,
  },

  // PICKER CARDS
  pickerCard: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
  },
  pickerDim: {
    opacity: 0.45,
  },
  pickerHeaderLabel: {
    color: PRIMARY,
    fontSize: 10,
    fontWeight: '800',
    paddingTop: 6,
    paddingLeft: 12,
    letterSpacing: 0.5,
  },
  pickerInput: {
    height: 42,
    color: TEXT_DARK,
    marginTop: -4,
  },

  // MODAL LAYER BASEMAP (FROM MAPPREVIEW)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
    color: TEXT_DARK,
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
    borderColor: BORDER_COLOR,
  },
  layerOptionActive: {
    backgroundColor: '#F0F9FF',
    borderColor: PRIMARY,
  },
  layerOptionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  layerOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  layerOptionSub: {
    fontSize: 11,
    color: TEXT_MID,
    marginTop: 1,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: PRIMARY,
    marginLeft: 8,
  },

  // DETAIL MODAL DESA FINAL
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  modalSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 16,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: TEXT_DARK,
    fontWeight: '800',
    fontSize: 16,
  },
  modalSubtitle: {
    color: TEXT_MID,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalClose: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 10,
  },
  statusBannerFinal: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBannerDasar: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBannerIcon: {
    fontSize: 20,
  },
  statusBannerTextFinal: {
    color: '#065F46',
    fontWeight: '800',
    fontSize: 13,
  },
  statusBannerTextDasar: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 13,
  },
  statusBannerSub: {
    color: TEXT_MID,
    fontSize: 11,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  infoLabel: {
    color: TEXT_MID,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  btnFilterThisDesa: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  btnFilterThisDesaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  coordTitle: {
    color: TEXT_DARK,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 10,
    marginBottom: 8,
  },
  coordBox: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  coordItem: {
    color: TEXT_MID,
    fontSize: 12,
    marginBottom: 4,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  coordMore: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // ── TOMBOL KATALOG DESA FINAL DI DRAWER PANEL ─────────────────────────────
  btnKatalogFinal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  katalogIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  katalogTitle: {
    color: PRIMARY_DARK,
    fontWeight: '800',
    fontSize: 12,
  },
  katalogSub: {
    color: TEXT_MID,
    fontSize: 10,
    marginTop: 1,
  },
  katalogBadge: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  katalogBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── MODAL DAFTAR DESA FINAL ──────────────────────────────────────────────
  daftarModalBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  daftarStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  daftarStatCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    alignItems: 'center',
  },
  daftarStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_MID,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  daftarStatVal: {
    fontSize: 12,
    fontWeight: '800',
  },

  // SEARCH BAR
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 2,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 10,
  },
  searchBarIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: TEXT_DARK,
    paddingVertical: 4,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    fontSize: 12,
    color: TEXT_MID,
    fontWeight: 'bold',
  },

  // FILTER CHIP KECAMATAN
  filterKecScrollViewWrap: {
    marginBottom: 10,
  },
  filterKecScrollContent: {
    gap: 6,
    paddingRight: 10,
  },
  filterKecChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  filterKecChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterKecChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MID,
  },
  filterKecChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // EMPTY STATE
  emptyDaftarBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyDaftarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  emptyDaftarSub: {
    fontSize: 12,
    color: TEXT_MID,
    textAlign: 'center',
    marginTop: 4,
  },

  // LIST ITEM DESA CARD
  desaItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  desaItemCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.8,
  },
  desaItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  desaNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  desaNumberText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  desaItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: -0.2,
  },
  desaItemKec: {
    fontSize: 11,
    color: TEXT_MID,
    marginTop: 1,
  },
  desaStatusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  desaStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
  },
  desaItemMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  desaItemMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  desaItemMetaLabel: {
    fontSize: 10,
    color: TEXT_MID,
    fontWeight: '500',
  },
  desaItemMetaValue: {
    fontSize: 10,
    color: TEXT_DARK,
    fontWeight: '700',
  },
  desaActionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  desaActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
  },
  desaActionArrow: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
});

export default PetaFinal;
