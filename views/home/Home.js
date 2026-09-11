// import pustaka
import React, { Component, useState, useEffect, useCallback, useRef } from 'react';
import styles from '../assets/style';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ImageBackground, ActivityIndicator, Alert, StyleSheet as RNStyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import TabBar from '../components/TabBar'
import LinearGradient from 'react-native-linear-gradient';
import * as turf from '@turf/turf';
import NetInfo from '@react-native-community/netinfo';
import NotificationService from '../library/NotificationService';

import { Assets } from '@react-navigation/elements';

const homeStyles = RNStyleSheet.create({
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#F44336',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  offlineBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 10,
  },
  offlineBannerText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
  },
  offlineSyncLink: {
    fontSize: 11,
    color: '#208DC0',
    fontWeight: 'bold',
    marginTop: 4,
  },
  shortcutContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    width: '48%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutIconImg: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  shortcutLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 16,
  },
  shortcutBadge: {
    position: 'absolute',
    top: -6,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#F8FAFC',
    zIndex: 10,
  },
  shortcutBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoContainerModern: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    justifyContent: 'space-between',
  },
  infoCardModern: {
    backgroundColor: '#FFFFFF',
    width: '47%',
    borderRadius: 20,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  infoTitleModern: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  infoValueModern: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
  },
  mapCard: {
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  mapHeaderIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  mapContainer: {
    height: 250,
    width: '100%',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    zIndex: 10,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  greetingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  userNameText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '800',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
});

// buat komponen utama
const Home = ({ navigation }) => {
  const Route = (routex) => {
    navigation.navigate(routex);
  };
  const [selectedKecamatan, setSelectedKecamatan] = useState(''); // Untuk kecamatan yang dipilih
  const [kecamatan, setKecamatan] = useState([]);
  const [petadasar, setPetadasar] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const URL = useSelector(state => state.URL);
  const TOKEN = useSelector(state => state.TOKEN);
  const PROFILE = useSelector(state => state.PROFILE);
  const IS_ONLINE = useSelector(state => state.IS_ONLINE);
  const NOTIFICATION_COUNT = useSelector(state => state.NOTIFICATION_COUNT);
  const OFFLINE_QUEUE_COUNT = useSelector(state => state.OFFLINE_QUEUE_COUNT);
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const [DATA_FINAL, SET_DATA_FINAL] = useState([]);
  const [isPolygonLoading, setIsPolygonLoading] = useState(false);
  const [desa, setDesa] = useState([]); // State untuk daftar desa
  const mapRef = useRef(null); // Ref untuk mengontrol peta

  useFocusEffect(
    useCallback(() => {
      // console.log("📥 Home is focused");

      return () => {
        // console.log("🧹 Cleanup Home");
        setDesa([]);
        setPetadasar([]);
        SET_DATA_FINAL([]);
        setSelectedKecamatan('');
      };
    }, [])
  );

  // Fungsi untuk menyimpan token di AsyncStorage
  const saveDataToken = async (token) => {
    try {
      await AsyncStorage.setItem('TOKEN', token); // Simpan token
      console.log('Token saved:', token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  };

  const calculateArea = (coordinates) => {
    if (!coordinates || coordinates.length < 3) return 0; // Minimal butuh 3 titik untuk polygon

    try {
      // Pastikan koordinat berbentuk array objek dengan lat & lng
      const geoJSONCoordinates = coordinates.map(coord => {
        if (coord.lat && coord.lng) {
          return [coord.lng, coord.lat]; // GeoJSON format: [longitude, latitude]
        } else {
          console.error("Format koordinat salah:", coord);
          return null;
        }
      }).filter(coord => coord !== null); // Hilangkan nilai null jika ada kesalahan data

      if (geoJSONCoordinates.length < 3) {
        console.error("Data koordinat tidak cukup untuk menghitung luas.");
        return 0;
      }

      // Buat polygon GeoJSON
      const polygon = turf.polygon([geoJSONCoordinates]);

      // Hitung luas dalam meter persegi, lalu konversi ke km²
      const area = turf.area(polygon) / 1e6; // Convert dari m² ke km²
      return area.toFixed(2); // Format ke 2 desimal
    } catch (error) {
      console.error("Error calculating area:", error);
      return 0;
    }
  };


  const getKecamatan = async () => {
    if (!TOKEN) return;
    // setIsLoading(true); // Aktifkan indikator loading
    try {
      const response = await fetch(URL.URL_KECAMATAN + "kecamatan_all", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `kikensbatara ${TOKEN}`
        },
      });

      const res_data = await response.json(); // Parsing hasil JSON
      const tampung = [];
      //   console.log("Data Kecamatannya:", kecamatan);

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
      } else {
        console.warn("getKecamatan: res_data is not an array", res_data);
      }

      setKecamatan(tampung); // Simpan hasil ke state
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data kecamatan');
      console.error(error);
    } finally {
      setIsLoading(false); // Matikan indikator loading
    }
  };



  // ========================

  // Fungsi untuk mengambil daftar desa berdasarkan kecamatan yang dipilih
  const getDesaByKecamatan = async () => {
    if (!selectedKecamatan) return;

    try {
      const response = await fetch(URL.URL_KECAMATAN + "petadasar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `kikensbatara ${TOKEN}`
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });

      const result = await response.json();

      if (Array.isArray(result) && result.length > 0) {
        const processedDesa = result.map(item => {
          let area = "0";
          if (item?.lokasi?.coordinat) {
            area = calculateArea(item.lokasi.coordinat);
          }
          return { ...item, calculatedArea: area };
        });
        setDesa(processedDesa); // Simpan daftar desa ke state
      } else {
        setDesa([]); // Kosongkan daftar jika tidak ada desa
      }
    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };

  // Panggil API desa dan peta dasar setiap kali selectedKecamatan berubah
  useEffect(() => {
    if (selectedKecamatan) {
      getDesaByKecamatan();
      getPetadasar();
    }
  }, [selectedKecamatan]);



  const getPetafinal = async () => {
    try {
      setIsLoading(true);
      // console.log("DATA_FINAL type:", typeof DATA_FINAL);
      // console.log("DATA_FINAL value:", DATA_FINAL);

      const response = await fetch(URL.URL_HOME + "peta_final", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `kikensbatara ${TOKEN}`
        },
      });

      const result = await response.json();
      if (result[0]) {
        SET_DATA_FINAL(result[0]);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
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
          "Content-Type": "application/json",
          Authorization: `kikensbatara ${TOKEN}`
        },
        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
      });

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('Polygon data is empty or not an array:', data);
        return;
      }

      setPetadasar(
        data.map(polygon => ({
          ...polygon,
          lokasi: {
            ...polygon.lokasi,
            coordinat: polygon.lokasi?.coordinat ? polygon.lokasi.coordinat.map(({ lat, lng }) => ({
              latitude: parseFloat(lat),
              longitude: parseFloat(lng),
            })) : [],
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

  // useEffect untuk getPetadasar sudah digabung ke useEffect getDesaByKecamatan di atas.




  // Hook useEffect untuk mengambil data saat halaman ini fokus
  useEffect(() => {
    console.log('Fetching data...');
    const fetchData = async () => {
      await Promise.all([getPetafinal(), getKecamatan(), getPetadasar()]);
    };
    fetchData();
  }, [isFocused]);

  // Efek untuk menggeser kamera peta ke area polygon begitu data petadasar dimuat
  useEffect(() => {
    if (petadasar.length > 0 && mapRef.current) {
      const allCoords = [];
      petadasar.forEach(polygon => {
        if (polygon.lokasi?.coordinat) {
          allCoords.push(...polygon.lokasi.coordinat);
        }
      });
      if (allCoords.length > 0) {
        // Berikan delay sedikit agar map selesai di-render dulu sebelum digeser
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
    <View style={{ flex: 1 }}>
      <ImageBackground source={require('../assets/img/bgbg.jpg')} style={{ flex: 1 }} resizeMode="cover">
      {/* HEADER ORIGINAL */}
      <View style={styles.top}>
        <View>
          <Text style={styles.fontHome}>SIMBADA</Text>
          <Text style={styles.fontHomex}>Sistem Informasi Batas Desa</Text>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 15 }}>
          {/* Notification Bell */}
          <TouchableOpacity onPress={() => Route('NotificationList')} style={{ marginRight: 15, position: 'relative' }}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
            {NOTIFICATION_COUNT > 0 && (
              <View style={homeStyles.notifBadge}>
                <Text style={homeStyles.notifBadgeText}>{NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Route('PetaFinal')}>
            <FastImage
              style={{ width: 30, height: 30 }}
              source={require('../assets/img/gis_pirate-map.png')}
              resizeMode={FastImage.resizeMode.contain}
              tintColor="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.body, { backgroundColor: 'transparent' }]}>
        <ScrollView style={{ flex: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* === OFFLINE BANNER === */}
          {IS_ONLINE === false && (
            <View style={homeStyles.offlineBanner}>
              <Text style={homeStyles.offlineBannerText}>📴 Mode Offline — Beberapa fitur terbatas</Text>
              {OFFLINE_QUEUE_COUNT > 0 && (
                <TouchableOpacity onPress={() => Route('OfflineSync')}>
                  <Text style={homeStyles.offlineSyncLink}>📤 {OFFLINE_QUEUE_COUNT} data menunggu sync →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* === SHORTCUT MODUL BARU === */}
          <View style={homeStyles.shortcutContainer}>
            <Text style={homeStyles.shortcutTitle}>⚡ AKSES CEPAT</Text>
            <View style={homeStyles.shortcutRow}>
              <TouchableOpacity style={homeStyles.shortcutCard} onPress={() => Route('NavigasiKoordinat')}>
                <FastImage
                  style={homeStyles.shortcutIconImg}
                  source={require('../assets/img/map.png')}
                  resizeMode={FastImage.resizeMode.contain}
                  tintColor="#2563EB"
                />
                <Text style={homeStyles.shortcutLabel}>Navigasi Koordinat</Text>
              </TouchableOpacity>

              <TouchableOpacity style={homeStyles.shortcutCard} onPress={() => Route('OfflineSync')}>
                <View style={{ position: 'relative' }}>
                  <FastImage
                    style={homeStyles.shortcutIconImg}
                    source={require('../assets/img/upload.png')}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor="#F59E0B"
                  />
                  {OFFLINE_QUEUE_COUNT > 0 && (
                    <View style={homeStyles.shortcutBadge}>
                      <Text style={homeStyles.shortcutBadgeText}>{OFFLINE_QUEUE_COUNT}</Text>
                    </View>
                  )}
                </View>
                <Text style={homeStyles.shortcutLabel}>Sinkron Offline</Text>
              </TouchableOpacity>
            </View>

            {/* Baris 2: Modul Pemetaan Lapangan */}
            <View style={homeStyles.shortcutRow}>
              <TouchableOpacity style={[homeStyles.shortcutCard, { borderColor: '#EF4444', borderWidth: 1 }]}
                onPress={() => Route('TrackRecorder')}>
                <Text style={{ fontSize: 28 }}>🔴</Text>
                <Text style={homeStyles.shortcutLabel}>Track Recorder</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[homeStyles.shortcutCard, { borderColor: '#208DC0', borderWidth: 1 }]}
                onPress={() => Route('PlacemarkList')}>
                <Text style={{ fontSize: 28 }}>📍</Text>
                <Text style={homeStyles.shortcutLabel}>Placemark</Text>
              </TouchableOpacity>
            </View>

            {/* Baris 3: Peta Offline & Ekspor */}
            <View style={homeStyles.shortcutRow}>
              <TouchableOpacity style={[homeStyles.shortcutCard, { borderColor: '#22C55E', borderWidth: 1 }]}
                onPress={() => Route('MapImporter')}>
                <Text style={{ fontSize: 28 }}>🗺</Text>
                <Text style={homeStyles.shortcutLabel}>Peta Offline</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[homeStyles.shortcutCard, { borderColor: '#A855F7', borderWidth: 1 }]}
                onPress={() => Route('EksporData')}>
                <Text style={{ fontSize: 28 }}>📤</Text>
                <Text style={homeStyles.shortcutLabel}>Ekspor Data</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bagian Info Peta Dasar & Peta Final */}
          <View style={homeStyles.infoContainerModern}>
            <View style={homeStyles.infoCardModern}>
              <FastImage
                style={{ width: 28, height: 28 }}
                source={require('../assets/img/tanah.png')}
                resizeMode={FastImage.resizeMode.contain}
                tintColor="#3B82F6"
              />
              <Text style={homeStyles.infoTitleModern}>PETA DASAR</Text>
              <Text style={homeStyles.infoValueModern}>351</Text>
            </View>

            <View style={homeStyles.infoCardModern}>
              <FastImage
                style={{ width: 28, height: 28 }}
                source={require('../assets/img/gis_pirate-map.png')}
                resizeMode={FastImage.resizeMode.contain}
                tintColor="#10B981"
              />
              <Text style={homeStyles.infoTitleModern}>PETA FINAL</Text>
              <Text style={homeStyles.infoValueModern}>{DATA_FINAL}</Text>
            </View>
          </View>

          {/* Bagian Loading Peta */}
          <View style={homeStyles.mapCard}>
            <View style={homeStyles.mapHeader}>
              <FastImage
                style={homeStyles.mapHeaderIcon}
                source={require('../assets/img/map.png')}
                resizeMode={FastImage.resizeMode.contain}
                tintColor="#0F172A"
              />
              <Text style={homeStyles.mapTitle}>MAP PETA DASAR</Text>
            </View>

            {isPolygonLoading ? (
              <View style={[homeStyles.mapContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }]}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={{ color: '#64748B', fontWeight: 'bold', fontSize: 14, marginTop: 12 }}>Memuat Koordinat...</Text>
              </View>
            ) : (
              <View style={homeStyles.mapContainer}>
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
                          strokeColor="#EF4444"
                          fillColor="rgba(239, 68, 68, 0.3)"
                          strokeWidth={2}
                          tappable
                        />
                      )
                  )}
                </MapView>
              </View>
            )}
          </View>

          {/* Bagian Select Kecamatan */}
          <View style={{ marginHorizontal: 20, marginBottom: 30, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12 }}>
            <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 16, marginBottom: 15 }}>
              DATA DESA PER KECAMATAN
            </Text>

            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' }}>
              <Picker
                selectedValue={selectedKecamatan}
                onValueChange={(itemValue) => {
                  setSelectedKecamatan(itemValue);
                }}
                style={{ height: 50, color: '#334155' }}
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

            {/* Header Daftar Desa */}
            <View style={{ marginTop: 25 }}>
              <View style={{ flexDirection: 'row', backgroundColor: '#3B82F6', borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingVertical: 12, paddingHorizontal: 10 }}>
                <Text style={{ flex: 0.2, color: '#fff', fontWeight: 'bold', fontSize: 13, textAlign: 'center' }}>No</Text>
                <Text style={{ flex: 0.5, color: '#fff', fontWeight: 'bold', fontSize: 13, paddingLeft: 10 }}>Nama Desa</Text>
                <Text style={{ flex: 0.3, color: '#fff', fontWeight: 'bold', fontSize: 13, textAlign: 'center' }}>Luas</Text>
              </View>

              {/* Render Daftar Desa Menggunakan map() */}
              <View style={{ borderWidth: 1, borderColor: '#E2E8F0', borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' }}>
                {desa.length > 0 ? (
                  desa.map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: index === desa.length - 1 ? 0 : 1, borderBottomColor: '#F1F5F9' }}>
                      <Text style={{ flex: 0.2, color: '#475569', fontSize: 13, textAlign: 'center' }}>{String(index + 1)}</Text>
                      <Text style={{ flex: 0.5, color: '#0F172A', fontSize: 13, fontWeight: '600', paddingLeft: 10 }}>
                        {item?.lokasi?.nama_desa ? String(item.lokasi.nama_desa) : "Tidak Diketahui"}
                      </Text>
                      <Text style={{ flex: 0.3, color: '#475569', fontSize: 13, textAlign: 'center' }}>
                        {item.calculatedArea ? String(item.calculatedArea) : "0"} km²
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Tidak ada desa ditemukan</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <TabBar />

      </ImageBackground>
    </View>
  );
};

// Menyediakan komponen ini untuk aplikasi

export default Home;
