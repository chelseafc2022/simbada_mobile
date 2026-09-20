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
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import TabBar from '../components/TabBar';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
const FINAL_STROKE      = '#00E5FF'; // Vibrant cyan-blue border
const FINAL_FILL        = 'rgba(2, 132, 199, 0.35)'; // Crisp blue fill
const FINAL_MINE_STROKE = '#EF4444'; // Red for operator's village
const FINAL_MINE_FILL   = 'rgba(239, 68, 68, 0.40)';
const DASAR_STROKE      = '#94A3B8'; // Slate gray for dasar overlay
const DASAR_FILL        = 'rgba(148, 163, 184, 0.22)';

const KONAWE = {
  latitude: -4.2021418,
  longitude: 122.4819808,
  latitudeDelta: 0.9,
  longitudeDelta: 0.9,
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

  // Data & Filters
  const [isLoading, setIsLoading]                 = useState(true);
  const [kecamatanList, setKecamatanList]         = useState([]);
  const [desaList, setDesaList]                   = useState([]);
  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [selectedDesa, setSelectedDesa]           = useState('');

  // Peta Final polygons
  const [initialFinalData, setInitialFinalData]   = useState([]);
  const [kecFinalData, setKecFinalData]           = useState([]);
  const [desaFinalData, setDesaFinalData]         = useState([]);

  // Peta Dasar overlay
  const [showDasar, setShowDasar]                 = useState(false);
  const [initialDasarData, setInitialDasarData]   = useState([]);
  const [kecDasarData, setKecDasarData]           = useState([]);
  const [desaDasarData, setDesaDasarData]         = useState([]);

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

  useFocusEffect(
    useCallback(() => () => {
      setSelectedKecamatan('');
      setSelectedDesa('');
      setInitialFinalData([]);
      setKecFinalData([]);
      setDesaFinalData([]);
      setInitialDasarData([]);
      setKecDasarData([]);
      setDesaDasarData([]);
    }, [])
  );

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

  // ── Fetch all (admin / initial) ───────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const statusInt = parseInt(userStatus);
    if (statusInt === 2 || statusInt === 3) {
      if (id_kecamatan_user) {
        setSelectedKecamatan(id_kecamatan_user);
        fetchPolygonDataKecamatan(id_kecamatan_user);
      } else {
        setIsLoading(false);
      }
      return () => {
        mounted = false;
      };
    }

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [rFinal, rDasar] = await Promise.all([
          fetch(URL.URL_PETA_FINAL + 'petafinal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `kikensbatara ${TOKEN}`,
            },
          }),
          fetch(URL.URL_HOME + 'petadasar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `kikensbatara ${TOKEN}`,
            },
          }),
        ]);
        const dFinal = await rFinal.json();
        const dDasar = await rDasar.json();

        if (mounted && Array.isArray(dFinal)) {
          const finalMapped = dFinal
            .filter((p) => p.lokasi && Array.isArray(p.lokasi.coordinat))
            .map((p) => ({
              kode_desa: p.lokasi.kode_desa,
              nama_desa: p.lokasi.nama_desa || '',
              coordinates: p.lokasi.coordinat.map((c) => ({
                latitude: parseFloat(c.lat),
                longitude: parseFloat(c.lng),
              })),
            }));
          setInitialFinalData(finalMapped);
        }
        if (mounted && Array.isArray(dDasar)) {
          const dasarMapped = dDasar
            .filter((p) => p.lokasi && Array.isArray(p.lokasi.coordinat))
            .map((p) => ({
              kode_desa: p.lokasi.kode_desa,
              nama_desa: p.lokasi.nama_desa || '',
              coordinates: p.lokasi.coordinat.map((c) => ({
                latitude: parseFloat(c.lat),
                longitude: parseFloat(c.lng),
              })),
            }));
          setInitialDasarData(dasarMapped);
        }
      } catch (e) {
        Alert.alert('Error', 'Gagal mengambil data peta final');
        console.error(e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    fetchAll();
    return () => {
      mounted = false;
    };
  }, [TOKEN]);

  // ── Fetch kecamatan list ──────────────────────────────────────────────────
  useEffect(() => {
    if (!TOKEN) return;
    fetch(URL.URL_PETA_FINAL + 'kecamatan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `kikensbatara ${TOKEN}`,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setKecamatanList(
          data.map((item) => ({
            id: `${String(item.hasil.no_prop || '0').padStart(2, '0')}.${String(
              item.hasil.no_kab || '0'
            ).padStart(2, '0')}.${String(item.hasil.kode || '0').padStart(2, '0')}`,
            name: item.hasil.uraian || 'Nama tidak diketahui',
          }))
        );
      })
      .catch(console.error);
  }, [TOKEN]);

  // ── Fetch desa ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedKecamatan) return;
    fetch(URL.URL_PETA_FINAL + 'desa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `kikensbatara ${TOKEN}`,
      },
      body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (!Array.isArray(result)) return;
        setDesaList(
          result.map((item) => ({
            id: `${item.no_prop}.${item.no_kab}.${item.no_kec}.${String(
              item.kode || '0'
            ).padStart(4, '0')}`,
            name: item.uraian || 'Nama desa tidak tersedia',
          }))
        );
      })
      .catch(console.error);
  }, [selectedKecamatan]);

  // ── Fetch polygon kecamatan ───────────────────────────────────────────────
  const fetchPolygonDataKecamatan = async (kecId) => {
    setIsLoading(true);
    try {
      const [rFinal, rDasar] = await Promise.all([
        fetch(URL.URL_APP + 'api/v1/petafinal/petafinal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${TOKEN}`,
          },
          body: JSON.stringify({ kecamatan_id: kecId, des_kel_id: '' }),
        }),
        fetch(URL.URL_HOME + 'petadasar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${TOKEN}`,
          },
          body: JSON.stringify({ kecamatan_id: kecId }),
        }),
      ]);
      const dFinal = await rFinal.json();
      const dDasar = await rDasar.json();

      const finalMapped = Array.isArray(dFinal)
        ? dFinal
            .filter(
              (p) =>
                p.lokasi &&
                Array.isArray(p.lokasi.coordinat) &&
                p.lokasi.coordinat.length > 0
            )
            .map((p) => ({
              kode_desa: p.lokasi.kode_desa,
              nama_desa: p.lokasi.nama_desa || '',
              coordinates: p.lokasi.coordinat.map((c) => ({
                latitude: parseFloat(c.lat),
                longitude: parseFloat(c.lng),
              })),
            }))
        : [];
      setKecFinalData(finalMapped);

      const dasarMapped = Array.isArray(dDasar)
        ? dDasar
            .filter(
              (p) =>
                p.lokasi &&
                Array.isArray(p.lokasi.coordinat) &&
                p.lokasi.coordinat.length > 0
            )
            .map((p) => ({
              kode_desa: p.lokasi.kode_desa,
              nama_desa: p.lokasi.nama_desa || '',
              coordinates: p.lokasi.coordinat.map((c) => ({
                latitude: parseFloat(c.lat),
                longitude: parseFloat(c.lng),
              })),
            }))
        : [];
      setKecDasarData(dasarMapped);

      if (finalMapped.length > 0) {
        fitPolygons(finalMapped);
      } else if (dasarMapped.length > 0) {
        fitPolygons(dasarMapped);
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal mengambil data poligon kecamatan');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Filter by desa ────────────────────────────────────────────────────────
  const filterByDesa = (desaId) => {
    const match = (p) =>
      p.kode_desa === desaId || desaId.endsWith(`.${p.kode_desa}`);
    const filteredFinal = kecFinalData.filter(match);
    setDesaFinalData(filteredFinal.length ? filteredFinal : []);
    if (!filteredFinal.length) {
      Alert.alert('Info', 'Tidak ada polygon final untuk desa yang dipilih');
    } else {
      fitPolygons(filteredFinal);
    }
    const filteredDasar = kecDasarData.filter(match);
    setDesaDasarData(filteredDasar);
  };

  // ── Active sets (memoised) ────────────────────────────────────────────────
  const activeFinal = useMemo(() => {
    if (selectedDesa) return desaFinalData;
    if (selectedKecamatan) return kecFinalData;
    return initialFinalData;
  }, [selectedDesa, selectedKecamatan, desaFinalData, kecFinalData, initialFinalData]);

  const activeDasar = useMemo(() => {
    if (selectedDesa) return desaDasarData;
    if (selectedKecamatan) return kecDasarData;
    return initialDasarData;
  }, [selectedDesa, selectedKecamatan, desaDasarData, kecDasarData, initialDasarData]);

  const panelMaxH = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 310],
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
              activeDasar.map((p, i) => (
                <Polygon
                  key={`dasar-${p.kode_desa}-${i}`}
                  coordinates={p.coordinates}
                  strokeColor={DASAR_STROKE}
                  fillColor={DASAR_FILL}
                  strokeWidth={1.2}
                  zIndex={1}
                />
              ))}

            {/* Final polygons */}
            {activeFinal.map((p, i) => {
              const isMine =
                userStatus === 2 &&
                id_desa_user &&
                (p.kode_desa === id_desa_user ||
                  id_desa_user.endsWith(`.${p.kode_desa}`));
              return (
                <Polygon
                  key={`final-${p.kode_desa}-${i}`}
                  coordinates={p.coordinates}
                  strokeColor={isMine ? FINAL_MINE_STROKE : FINAL_STROKE}
                  fillColor={isMine ? FINAL_MINE_FILL : FINAL_FILL}
                  strokeWidth={isMine ? 2.8 : 2}
                  zIndex={isMine ? 3 : 2}
                />
              );
            })}

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

        {/* RESET FILTER CHIP (WHEN DESA FILTERED) */}
        {selectedDesa ? (
          <TouchableOpacity
            style={ss.resetChip}
            onPress={() => {
              setSelectedDesa('');
              setDesaFinalData([]);
              setDesaDasarData([]);
              if (kecFinalData.length > 0) fitPolygons(kecFinalData);
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
                  if (val) fetchPolygonDataKecamatan(val);
                  else {
                    setKecFinalData([]);
                    setKecDasarData([]);
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

  // RESET CHIP
  resetChip: {
    position: 'absolute',
    top: 62,
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
});

export default PetaFinal;
