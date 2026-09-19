// views/peta_dasar/PetaDasar.js — Modern Government GIS Edition
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import TabBar from '../components/TabBar';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as turf from '@turf/turf';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

// ─── COLOR PALETTE (HOME & MAPPREVIEW COMPLIANT) ─────────────────────────────
const PRIMARY      = '#0284C7';
const DARK_NAVY    = '#0F172A';
const SURFACE      = '#F8FAFC';
const CARD_BG      = '#FFFFFF';
const BORDER_COLOR = '#E2E8F0';
const TEXT_DARK    = '#0F172A';
const TEXT_MID     = '#64748B';

// Polygon styles matching MapPreview
const POLY_STROKE     = '#FBBF24'; // Golden amber boundary like Home MapPreview
const POLY_FILL       = 'rgba(251, 191, 36, 0.22)';
const POLY_SEL_STROKE = '#00E5FF'; // Highlight cyan
const POLY_SEL_FILL   = 'rgba(0, 229, 255, 0.38)';

const KONAWE_SELATAN = {
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
    const poly = turf.polygon([geo]);
    return (turf.area(poly) / 1e6).toFixed(2);
  } catch {
    return '0.00';
  }
};

const PetaDasar = ({ navigation }) => {
  const Route = (r) => navigation.navigate(r);

  const TOKEN   = useSelector((s) => s.TOKEN);
  const PROFILE = useSelector((s) => s.PROFILE);
  const URL     = useSelector((s) => s.URL);

  const status_user       = parseInt(PROFILE?.profile?.status) || 1;
  const id_kecamatan_user = PROFILE?.profile?.id_kecamatan || '';

  const mapRef = useRef(null);

  // Map settings
  const [mapType, setMapType] = useState('hybrid'); // 'hybrid' | 'satellite' | 'standard' | 'terrain'
  const [showLayerModal, setShowLayerModal] = useState(false);

  // Data & Filters
  const [isLoading, setIsLoading]                       = useState(true);
  const [kecamatanList, setKecamatanList]               = useState([]);
  const [desaList, setDesaList]                         = useState([]);
  const [selectedKecamatan, setSelectedKecamatan]       = useState(
    status_user === 2 || status_user === 3 ? id_kecamatan_user : ''
  );
  const [selectedDesa, setSelectedDesa]                 = useState('');
  const [initialPolygonData, setInitialPolygonData]     = useState([]);
  const [kecamatanPolygonData, setKecamatanPolygonData] = useState([]);
  const [desaPolygonData, setDesaPolygonData]           = useState([]);

  // Detail Modal
  const [detailModalVisible, setDetailModalVisible]       = useState(false);
  const [selectedPolygonDetail, setSelectedPolygonDetail] = useState(null);

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
      setInitialPolygonData([]);
      setKecamatanPolygonData([]);
      setDesaPolygonData([]);
      setSelectedDesa('');
      setSelectedKecamatan('');
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

  // ── Fetch Initial Polygons ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (status_user === 2 || status_user === 3) {
      if (id_kecamatan_user) fetchPolygonDataKecamatan(id_kecamatan_user);
      else setIsLoading(false);
      return () => {
        mounted = false;
      };
    }
    const fetchAll = async () => {
      try {
        const cached = await AsyncStorage.getItem('@peta_dasar_all_polygon');
        if (cached && mounted) {
          setInitialPolygonData(JSON.parse(cached));
          setIsLoading(false);
        }
        const res = await fetch(URL.URL_HOME + 'petadasar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${TOKEN}`,
          },
        });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const fmt = data.map((p) => ({
          kode_desa: p.lokasi?.kode_desa,
          nama_desa: p.lokasi?.nama_desa || '',
          coordinates: (p.lokasi?.coordinat || []).map((c) => ({
            latitude: parseFloat(c.lat),
            longitude: parseFloat(c.lng),
          })),
        }));
        if (mounted) {
          setInitialPolygonData(fmt);
          try {
            await AsyncStorage.setItem(
              '@peta_dasar_all_polygon',
              JSON.stringify(fmt)
            );
          } catch {}
        }
      } catch (e) {
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

  // ── Fetch Kecamatan List ──────────────────────────────────────────────────
  useEffect(() => {
    if (!TOKEN) return;
    fetch(URL.URL_KECAMATAN + 'kecamatan_all', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `kikensbatara ${TOKEN}`,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setKecamatanList(
          data.map((item) => {
            const p = String(item.hasil?.no_prop || '0').padStart(2, '0');
            const k = String(item.hasil?.no_kab || '0').padStart(2, '0');
            const c = String(item.hasil?.kode || '0').padStart(2, '0');
            return { id: `${p}.${k}.${c}`, name: item.hasil?.uraian || '' };
          })
        );
      })
      .catch(console.error);
  }, [TOKEN]);

  // ── Fetch Desa List ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedKecamatan) return;
    fetch(URL.URL_KECAMATAN + 'desa', {
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
            id: `${String(item.no_prop || '0').padStart(2, '0')}.${String(
              item.no_kab || '0'
            ).padStart(2, '0')}.${String(item.no_kec || '0').padStart(2, '0')}.${String(
              item.kode || '0'
            ).padStart(4, '0')}`,
            name: item.uraian || '',
          }))
        );
      })
      .catch(console.error);
  }, [selectedKecamatan]);

  // ── Fetch Polygons for Selected Kecamatan ─────────────────────────────────
  const fetchPolygonDataKecamatan = async (kecId) => {
    setIsLoading(true);
    try {
      const res = await fetch(URL.URL_HOME + 'petadasar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
        body: JSON.stringify({ kecamatan_id: kecId }),
      });
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const fmt = data.map((p) => ({
        kode_desa: p.lokasi?.kode_desa,
        nama_desa: p.lokasi?.nama_desa || '',
        coordinates: (p.lokasi?.coordinat || []).map((c) => ({
          latitude: parseFloat(c.lat),
          longitude: parseFloat(c.lng),
        })),
      }));
      setKecamatanPolygonData(fmt);
      if (fmt.length > 0) fitPolygons(fmt);
    } catch (e) {
      Alert.alert('Error', 'Gagal memuat polygon kecamatan');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filterPolygonByDesa = (desaId) => {
    const filtered = kecamatanPolygonData.filter(
      (p) => p.kode_desa === desaId || desaId.endsWith(`.${p.kode_desa}`)
    );
    setDesaPolygonData(filtered.length ? filtered : []);
    if (!filtered.length) {
      Alert.alert('Info', 'Tidak ada polygon untuk desa yang dipilih');
    } else {
      fitPolygons(filtered);
    }
  };

  const activePolygons = useMemo(() => {
    if (selectedDesa) return desaPolygonData;
    if (selectedKecamatan) return kecamatanPolygonData;
    return initialPolygonData;
  }, [selectedDesa, selectedKecamatan, desaPolygonData, kecamatanPolygonData, initialPolygonData]);

  const panelMaxHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 270],
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
    if (activePolygons.length > 0) {
      fitPolygons(activePolygons);
    } else if (mapRef.current) {
      mapRef.current.animateToRegion(KONAWE_SELATAN, 700);
    }
  };

  const currentKecName =
    kecamatanList.find((k) => k.id === selectedKecamatan)?.name || '';

  return (
    <View style={ss.root}>
      <StatusBar backgroundColor={DARK_NAVY} barStyle="light-content" />

      {/* HEADER (COMPACT GOVERNMENT GIS STYLE) */}
      <View style={ss.header}>
        <View style={ss.headerLeft}>
          <Text style={ss.headerTitle}>PETA DASAR</Text>
          <Text style={ss.headerSub}>Sistem Informasi Batas Desa • Konawe Selatan</Text>
        </View>
        <TouchableOpacity
          style={ss.headerSwitchBtn}
          onPress={() => Route('PetaFinal')}
          activeOpacity={0.8}
        >
          <FastImage
            style={ss.headerSwitchIcon}
            source={require('../assets/img/gis_pirate-map.png')}
            resizeMode={FastImage.resizeMode.contain}
            tintColor="#FFFFFF"
          />
          <Text style={ss.headerSwitchLabel}>Peta Final</Text>
        </TouchableOpacity>
      </View>

      {/* MAP CANVAS */}
      <View style={ss.mapContainer}>
        {isLoading ? (
          <View style={ss.loadingBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={ss.loadingText}>Memuat Geospasial Peta Dasar...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={KONAWE_SELATAN}
            mapType={mapType}
            showsCompass={false}
            toolbarEnabled={false}
          >
            {activePolygons.map((polygon, index) => {
              const isSel = selectedDesa
                ? polygon.kode_desa === selectedDesa ||
                  selectedDesa.endsWith(`.${polygon.kode_desa}`)
                : false;
              return (
                <Polygon
                  key={`pd-${polygon.kode_desa}-${index}`}
                  coordinates={polygon.coordinates}
                  strokeColor={isSel ? POLY_SEL_STROKE : POLY_STROKE}
                  fillColor={isSel ? POLY_SEL_FILL : POLY_FILL}
                  strokeWidth={isSel ? 3 : 1.8}
                  tappable
                  onPress={() => {
                    const name =
                      polygon.nama_desa ||
                      desaList.find(
                        (d) =>
                          d.id === polygon.kode_desa ||
                          d.id.endsWith(`.${polygon.kode_desa}`)
                      )?.name ||
                      `Kode: ${polygon.kode_desa || '—'}`;
                    setSelectedPolygonDetail({
                      namaDesa: name,
                      coordinates: polygon.coordinates,
                    });
                    setDetailModalVisible(true);
                  }}
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
            <Text style={ss.mapTitleHeader}>Peta Dasar Batas Desa</Text>
            <Text style={ss.mapSubHeader}>
              {currentKecName
                ? `Kec. ${currentKecName}`
                : `${activePolygons.length} Poligon Terpetakan`}
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
              setDesaPolygonData([]);
              if (kecamatanPolygonData.length > 0) fitPolygons(kecamatanPolygonData);
            }}
          >
            <Text style={ss.resetChipText}>✕ Reset Filter Desa</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* BOTTOM PANEL (CLEAN MODERN GIS DRAWER) */}
      <Animated.View style={[ss.panel, { maxHeight: panelMaxHeight }]}>
        <TouchableOpacity
          style={ss.dragRow}
          onPress={togglePanel}
          activeOpacity={0.7}
        >
          <View style={ss.dragHandle} />
          <View style={ss.panelHeaderInfo}>
            <Text style={ss.panelTitle}>WILAYAH & FILTER PEMETAAN</Text>
            <Text style={ss.panelSubTitle}>Pilih batas wilayah kecamatan dan desa</Text>
          </View>
          <View style={ss.chevronWrap}>
            <Text style={ss.chevronText}>{isPanelOpen ? '▾' : '▴'}</Text>
          </View>
        </TouchableOpacity>

        {isPanelOpen && (
          <View style={ss.panelContent}>
            {/* Dropdown Kecamatan */}
            <View
              style={[
                ss.pickerCard,
                (status_user === 2 || status_user === 3) && ss.pickerDim,
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
                    setKecamatanPolygonData([]);
                    if (initialPolygonData.length > 0) fitPolygons(initialPolygonData);
                  }
                }}
                enabled={status_user !== 2 && status_user !== 3}
                dropdownIconColor={PRIMARY}
              >
                <Picker.Item label="— Pilih Kecamatan —" value="" />
                {kecamatanList.map((item) => (
                  <Picker.Item key={item.id} label={item.name} value={item.id} />
                ))}
              </Picker>
            </View>

            {/* Dropdown Desa */}
            <View style={[ss.pickerCard, !selectedKecamatan && ss.pickerDim]}>
              <Text style={ss.pickerHeaderLabel}>DESA / KELURAHAN</Text>
              <Picker
                style={ss.pickerInput}
                selectedValue={selectedDesa}
                onValueChange={(val) => {
                  setSelectedDesa(val);
                  if (val) filterPolygonByDesa(val);
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

      {/* DETAIL MODAL */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={ss.detailBadgeIcon}>
                  <FastImage
                    source={require('../assets/img/tanah.png')}
                    style={{ width: 18, height: 18 }}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor={PRIMARY}
                  />
                </View>
                <Text style={ss.modalTitle}>Detail Poligon Wilayah</Text>
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
                <View style={ss.infoRow}>
                  <Text style={ss.infoLabel}>Nama Desa</Text>
                  <Text style={ss.infoValue}>{selectedPolygonDetail.namaDesa}</Text>
                </View>
                <View style={ss.infoRow}>
                  <Text style={ss.infoLabel}>Estimasi Luas Area</Text>
                  <Text style={ss.infoValue}>
                    {calculateArea(selectedPolygonDetail.coordinates)} km²
                  </Text>
                </View>
                <View style={ss.infoRow}>
                  <Text style={ss.infoLabel}>Jumlah Titik Koordinat</Text>
                  <Text style={ss.infoValue}>
                    {selectedPolygonDetail.coordinates.length} titik
                  </Text>
                </View>

                <Text style={ss.coordTitle}>Daftar Titik Koordinat Geospasial</Text>
                <View style={ss.coordBox}>
                  {selectedPolygonDetail.coordinates.slice(0, 10).map((c, i) => (
                    <Text key={i} style={ss.coordItem}>
                      {i + 1}.  {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}
                    </Text>
                  ))}
                  {selectedPolygonDetail.coordinates.length > 10 && (
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

  // DETAIL MODAL
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    color: TEXT_DARK,
    fontWeight: '800',
    fontSize: 16,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
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
  coordTitle: {
    color: TEXT_DARK,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 16,
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
});

export default PetaDasar;
