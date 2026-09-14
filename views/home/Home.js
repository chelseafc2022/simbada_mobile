// import pustaka
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import MapView, { Polygon } from 'react-native-maps';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import TabBar from '../components/TabBar';
import LinearGradient from 'react-native-linear-gradient';
import * as turf from '@turf/turf';

// Komponen Utama Home
const Home = ({ navigation }) => {
  const Route = (routex) => {
    navigation.navigate(routex);
  };

  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [kecamatan, setKecamatan] = useState([]);
  const [petadasar, setPetadasar] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const URL = useSelector((state) => state.URL);
  const TOKEN = useSelector((state) => state.TOKEN);
  const PROFILE = useSelector((state) => state.PROFILE);
  const IS_ONLINE = useSelector((state) => state.IS_ONLINE);
  const NOTIFICATION_COUNT = useSelector((state) => state.NOTIFICATION_COUNT);
  const OFFLINE_QUEUE_COUNT = useSelector((state) => state.OFFLINE_QUEUE_COUNT);
  const isFocused = useIsFocused();
  const [DATA_FINAL, SET_DATA_FINAL] = useState(0);
  const [isPolygonLoading, setIsPolygonLoading] = useState(false);
  const [desa, setDesa] = useState([]);
  const mapRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setDesa([]);
        setPetadasar([]);
        SET_DATA_FINAL(0);
        setSelectedKecamatan('');
      };
    }, [])
  );

  const calculateArea = (coordinates) => {
    if (!coordinates || coordinates.length < 3) return 0;

    try {
      const geoJSONCoordinates = coordinates
        .map((coord) => {
          if (coord.lat && coord.lng) {
            return [coord.lng, coord.lat];
          }
          return null;
        })
        .filter((coord) => coord !== null);

      if (geoJSONCoordinates.length < 3) return 0;

      const polygon = turf.polygon([geoJSONCoordinates]);
      const area = turf.area(polygon) / 1e6;
      return area.toFixed(2);
    } catch (error) {
      console.error('Error calculating area:', error);
      return 0;
    }
  };

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
      Alert.alert('Error', 'Gagal mengambil data kecamatan');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDesaByKecamatan = async () => {
    if (!selectedKecamatan) return;

    try {
      const response = await fetch(URL.URL_KECAMATAN + 'petadasar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });

      const result = await response.json();

      if (Array.isArray(result) && result.length > 0) {
        const processedDesa = result.map((item) => {
          let area = '0';
          if (item?.lokasi?.coordinat) {
            area = calculateArea(item.lokasi.coordinat);
          }
          return { ...item, calculatedArea: area };
        });
        setDesa(processedDesa);
      } else {
        setDesa([]);
      }
    } catch (error) {
      console.error('Fetch Error:', error);
    }
  };

  useEffect(() => {
    if (selectedKecamatan) {
      getDesaByKecamatan();
      getPetadasar();
    }
  }, [selectedKecamatan]);

  const getPetafinal = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(URL.URL_HOME + 'peta_final', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
      });

      const result = await response.json();
      if (result && result[0]) {
        SET_DATA_FINAL(result[0]);
      }
    } catch (error) {
      console.error('Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPetadasar = async () => {
    if (!selectedKecamatan) {
      setIsPolygonLoading(false);
      return;
    }
    setIsPolygonLoading(true);
    setPetadasar([]);
    try {
      const response = await fetch(`${URL.URL_HOME}petadasar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`,
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        return;
      }

      setPetadasar(
        data.map((polygon) => ({
          ...polygon,
          lokasi: {
            ...polygon.lokasi,
            coordinat: polygon.lokasi?.coordinat
              ? polygon.lokasi.coordinat.map(({ lat, lng }) => ({
                  latitude: parseFloat(lat),
                  longitude: parseFloat(lng),
                }))
              : [],
          },
        }))
      );
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data peta dasar');
      console.error(error);
    } finally {
      setIsPolygonLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([getPetafinal(), getKecamatan(), getPetadasar()]);
    };
    fetchData();
  }, [isFocused]);

  useEffect(() => {
    if (petadasar.length > 0 && mapRef.current) {
      const allCoords = [];
      petadasar.forEach((polygon) => {
        if (polygon.lokasi?.coordinat) {
          allCoords.push(...polygon.lokasi.coordinat);
        }
      });
      if (allCoords.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }, 500);
      }
    }
  }, [petadasar]);

  return (
    <View style={ui.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0C4A6E" />

      {/* ======================================================== */}
      {/* 1. HEADER APPBAR — LinearGradient #0C4A6E -> #0284C7     */}
      {/* ======================================================== */}
      <LinearGradient
        colors={['#0C4A6E', '#0284C7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={ui.appBar}
      >
        <View style={ui.appBarTitleContainer}>
          <Text style={ui.appBarTitle}>SIMBADA</Text>
          <Text style={ui.appBarSubtitle}>Sistem Informasi Batas Desa</Text>
        </View>

        <View style={ui.appBarActions}>
          {/* Lonceng Notifikasi */}
          <TouchableOpacity
            onPress={() => Route('NotificationList')}
            style={ui.actionIconBtn}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {NOTIFICATION_COUNT > 0 && (
              <View style={ui.notifBadge}>
                <Text style={ui.notifBadgeText}>
                  {NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Shortcut Peta Final */}
          <TouchableOpacity
            onPress={() => Route('PetaFinal')}
            style={ui.actionIconBtn}
            activeOpacity={0.8}
          >
            <FastImage
              style={{ width: 22, height: 22 }}
              source={require('../assets/img/gis_pirate-map.png')}
              resizeMode={FastImage.resizeMode.contain}
              tintColor="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ======================================================== */}
      {/* KONTEN UTAMA SCROLLVIEW                                   */}
      {/* ======================================================== */}
      <ScrollView
        style={ui.scrollView}
        contentContainerStyle={ui.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* A. BANNER MODE OFFLINE                                   */}
        {/* ======================================================== */}
        {IS_ONLINE === false && (
          <LinearGradient
            colors={['#D97706', '#B45309']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={ui.offlineBanner}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={ui.offlineIcon}>📴</Text>
              <View style={{ flex: 1 }}>
                <Text style={ui.offlineTitle}>Mode Offline — Fitur Terbatas</Text>
                {OFFLINE_QUEUE_COUNT > 0 ? (
                  <TouchableOpacity
                    onPress={() => Route('OfflineSync')}
                    activeOpacity={0.8}
                  >
                    <Text style={ui.offlineSyncLink}>
                      📤 {OFFLINE_QUEUE_COUNT} data usulan menunggu sinkronisasi →
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={ui.offlineSubtitle}>
                    Koneksi internet tidak terdeteksi
                  </Text>
                )}
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ======================================================== */}
        {/* B. PANEL AKSES CEPAT (6 SHORTCUT, 3x2 GRID)              */}
        {/* ======================================================== */}
        <View style={ui.cardContainer}>
          <View style={ui.cardHeaderRow}>
            <Text style={ui.sectionTitle}>⚡ AKSES CEPAT</Text>
            <View style={ui.pillTag}>
              <Text style={ui.pillTagText}>Fitur Lapangan</Text>
            </View>
          </View>

          {/* Baris 1: Navigasi Koordinat & Sinkron Offline */}
          <View style={ui.shortcutRow}>
            <TouchableOpacity
              style={[ui.shortcutCard, { borderColor: '#BAE6FD' }]}
              onPress={() => Route('NavigasiKoordinat')}
              activeOpacity={0.85}
            >
              <View style={[ui.shortcutIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <FastImage
                  style={ui.shortcutIcon}
                  source={require('../assets/img/map.png')}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#0284C7"
                />
              </View>
              <Text style={ui.shortcutText}>Navigasi Koordinat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ui.shortcutCard, { borderColor: '#FED7AA' }]}
              onPress={() => Route('OfflineSync')}
              activeOpacity={0.85}
            >
              <View style={[ui.shortcutIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <FastImage
                  style={ui.shortcutIcon}
                  source={require('../assets/img/upload.png')}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#D97706"
                />
                {OFFLINE_QUEUE_COUNT > 0 && (
                  <View style={ui.shortcutBadge}>
                    <Text style={ui.shortcutBadgeText}>
                      {OFFLINE_QUEUE_COUNT > 9 ? '9+' : OFFLINE_QUEUE_COUNT}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={ui.shortcutText}>Sinkron Offline</Text>
            </TouchableOpacity>
          </View>

          {/* Baris 2: Track Recorder & Placemark */}
          <View style={ui.shortcutRow}>
            <TouchableOpacity
              style={[ui.shortcutCard, { borderColor: '#FECACA' }]}
              onPress={() => Route('TrackRecorder')}
              activeOpacity={0.85}
            >
              <View style={[ui.shortcutIconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Text style={{ fontSize: 20 }}>🔴</Text>
              </View>
              <Text style={ui.shortcutText}>Track Recorder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ui.shortcutCard, { borderColor: '#BAE6FD' }]}
              onPress={() => Route('PlacemarkList')}
              activeOpacity={0.85}
            >
              <View style={[ui.shortcutIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Text style={{ fontSize: 20 }}>📍</Text>
              </View>
              <Text style={ui.shortcutText}>Placemark</Text>
            </TouchableOpacity>
          </View>

          {/* Baris 3: Peta Offline & Ekspor Data */}
          <View style={ui.shortcutRow}>
            <TouchableOpacity
              style={[ui.shortcutCard, { borderColor: '#A7F3D0' }]}
              onPress={() => Route('MapImporter')}
              activeOpacity={0.85}
            >
              <View style={[ui.shortcutIconCircle, { backgroundColor: '#D1FAE5' }]}>
                <Text style={{ fontSize: 20 }}>🗺</Text>
              </View>
              <Text style={ui.shortcutText}>Peta Offline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ui.shortcutCard, { borderColor: '#DDD6FE' }]}
              onPress={() => Route('EksporData')}
              activeOpacity={0.85}
            >
              <View style={[ui.shortcutIconCircle, { backgroundColor: '#EDE9FE' }]}>
                <Text style={{ fontSize: 20 }}>📤</Text>
              </View>
              <Text style={ui.shortcutText}>Ekspor Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* C. STATISTIK PETA (2 KARTU SEJAJAR)                      */}
        {/* ======================================================== */}
        <View style={ui.statsRow}>
          {/* Kartu PETA DASAR */}
          <View style={ui.statCard}>
            <View style={ui.statCardTop}>
              <View style={[ui.statIconBox, { backgroundColor: '#E0F2FE' }]}>
                <FastImage
                  style={{ width: 22, height: 22 }}
                  source={require('../assets/img/tanah.png')}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#0284C7"
                />
              </View>
              <View style={[ui.statBadge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[ui.statBadgeText, { color: '#0369A1' }]}>Resmi</Text>
              </View>
            </View>
            <Text style={ui.statLabel}>PETA DASAR</Text>
            <Text style={[ui.statValue, { color: '#0C4A6E' }]}>351</Text>
            <Text style={ui.statCaption}>Desa / Kelurahan</Text>
          </View>

          {/* Kartu PETA FINAL */}
          <View style={ui.statCard}>
            <View style={ui.statCardTop}>
              <View style={[ui.statIconBox, { backgroundColor: '#DCFCE7' }]}>
                <FastImage
                  style={{ width: 22, height: 22 }}
                  source={require('../assets/img/gis_pirate-map.png')}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#059669"
                />
              </View>
              <View style={[ui.statBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[ui.statBadgeText, { color: '#15803D' }]}>Sah</Text>
              </View>
            </View>
            <Text style={ui.statLabel}>PETA FINAL</Text>
            <Text style={[ui.statValue, { color: '#059669' }]}>
              {DATA_FINAL || 0}
            </Text>
            <Text style={ui.statCaption}>Batas Disahkan</Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* D. PETA INTERAKTIF MINI (MAPVIEW)                        */}
        {/* ======================================================== */}
        <View style={ui.mapCard}>
          <View style={ui.mapHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[ui.statIconBox, { backgroundColor: '#E0F2FE', width: 32, height: 32, marginRight: 10 }]}>
                <FastImage
                  style={{ width: 18, height: 18 }}
                  source={require('../assets/img/map.png')}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#0284C7"
                />
              </View>
              <Text style={ui.mapTitle}>MAP PETA DASAR</Text>
            </View>
            <View style={[ui.statBadge, { backgroundColor: '#F1F5F9' }]}>
              <Text style={[ui.statBadgeText, { color: '#475569' }]}>
                {selectedKecamatan ? `${petadasar.length} Polygon` : 'Konawe Selatan'}
              </Text>
            </View>
          </View>

          {isPolygonLoading ? (
            <View style={ui.mapLoading}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={ui.mapLoadingText}>Memuat Koordinat Wilayah...</Text>
            </View>
          ) : (
            <View style={ui.mapBox}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                provider="google"
                initialRegion={{
                  latitude: -4.234658,
                  longitude: 122.353003,
                  latitudeDelta: 1.0,
                  longitudeDelta: 1.0,
                }}
              >
                {petadasar?.map(
                  (polygon, index) =>
                    polygon.lokasi?.coordinat && (
                      <Polygon
                        key={index}
                        coordinates={polygon.lokasi.coordinat}
                        strokeColor="#DC2626"
                        fillColor="rgba(220, 38, 38, 0.25)"
                        strokeWidth={2}
                        tappable
                      />
                    )
                )}
              </MapView>
            </View>
          )}
        </View>

        {/* ======================================================== */}
        {/* E. TABEL DATA DESA PER KECAMATAN                         */}
        {/* ======================================================== */}
        <View style={ui.cardContainer}>
          <Text style={ui.sectionTitle}>DATA DESA PER KECAMATAN</Text>
          <Text style={ui.sectionSubtitle}>
            Pilih kecamatan untuk memuat batas administrasi dan rincian desa
          </Text>

          {/* Dropdown Picker Kecamatan */}
          <View style={ui.pickerWrapper}>
            <Picker
              selectedValue={selectedKecamatan}
              onValueChange={(itemValue) => {
                setSelectedKecamatan(itemValue);
              }}
              style={{ height: 50, color: '#1E293B' }}
              dropdownIconColor="#0284C7"
            >
              <Picker.Item label="-- Pilih Kecamatan --" value="" color="#94A3B8" />
              {kecamatan.map((data) => (
                <Picker.Item
                  key={data.kecamatan_id}
                  label={data.nama_kecamatan}
                  value={data.kecamatan_id}
                  color="#0F172A"
                />
              ))}
            </Picker>
          </View>

          {/* Tabel Rincian Desa */}
          <View style={ui.tableContainer}>
            <View style={ui.tableHeader}>
              <Text style={[ui.tableHeaderText, { flex: 0.15, textAlign: 'center' }]}>No</Text>
              <Text style={[ui.tableHeaderText, { flex: 0.55, paddingLeft: 8 }]}>Nama Desa</Text>
              <Text style={[ui.tableHeaderText, { flex: 0.3, textAlign: 'right', paddingRight: 8 }]}>Luas</Text>
            </View>

            {desa.length > 0 ? (
              desa.map((item, index) => (
                <View
                  key={index}
                  style={[
                    ui.tableRow,
                    { backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC' },
                    index === desa.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[ui.tableCell, { flex: 0.15, textAlign: 'center', color: '#64748B' }]}>
                    {index + 1}
                  </Text>
                  <Text style={[ui.tableCell, { flex: 0.55, fontWeight: '600', color: '#0F172A', paddingLeft: 8 }]}>
                    {item?.lokasi?.nama_desa ? String(item.lokasi.nama_desa) : 'Tidak Diketahui'}
                  </Text>
                  <Text style={[ui.tableCell, { flex: 0.3, textAlign: 'right', paddingRight: 8, color: '#0C4A6E', fontWeight: '500' }]}>
                    {item.calculatedArea ? String(item.calculatedArea) : '0'} km²
                  </Text>
                </View>
              ))
            ) : (
              <View style={ui.tableEmpty}>
                <Text style={ui.tableEmptyText}>
                  {selectedKecamatan
                    ? 'Tidak ada data desa untuk kecamatan ini'
                    : 'Silakan pilih kecamatan di atas untuk menampilkan daftar desa'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Navigasi Bawah */}
      <TabBar />
    </View>
  );
};

// ================================================================
// DESIGN SYSTEM STYLING — Geo-Sapphire & Emerald Field
// ================================================================
const ui = RNStyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F0F9FF', // Token: --color-bg-primary
  },

  // APPBAR
  appBar: {
    paddingTop: 45,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  appBarTitleContainer: {
    flex: 1,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  appBarSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E0F2FE',
    marginTop: 2,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // SCROLLVIEW
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 25,
  },

  // OFFLINE BANNER
  offlineBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  offlineIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offlineSubtitle: {
    fontSize: 11,
    color: '#FEF3C7',
    marginTop: 2,
  },
  offlineSyncLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FEF3C7',
    marginTop: 3,
    textDecorationLine: 'underline',
  },

  // CARD BASE
  cardContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    elevation: 3,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0C4A6E',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 14,
  },
  pillTag: {
    backgroundColor: '#F0F9FF',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  pillTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },

  // SHORTCUTS
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '48.5%',
    borderWidth: 1.2,
  },
  shortcutIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative',
  },
  shortcutIcon: {
    width: 20,
    height: 20,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    lineHeight: 16,
  },
  shortcutBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 5,
  },
  shortcutBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // STATS CARDS
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    width: '48.5%',
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  statCaption: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  // MINI MAP CARD
  mapCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  mapTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0C4A6E',
    letterSpacing: 0.5,
  },
  mapBox: {
    height: 250,
    width: '100%',
  },
  mapLoading: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  mapLoadingText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 10,
  },

  // PICKER & TABLE
  pickerWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0284C7', // Token: --color-primary
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCell: {
    fontSize: 13,
  },
  tableEmpty: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tableEmptyText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default Home;
