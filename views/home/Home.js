// import pustaka
import React, { Component, useState, useEffect, useCallback, useRef } from 'react';
import styles from '../assets/style';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ImageBackground, ActivityIndicator, Alert, StyleSheet as RNStyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polygon }  from 'react-native-maps';
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
    marginHorizontal: 15,
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  shortcutTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#208DC0',
    marginBottom: 10,
    textAlign: 'center',
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shortcutCard: {
    alignItems: 'center',
    width: 70,
  },
  shortcutIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  shortcutLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 13,
  },
  shortcutBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  shortcutBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
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

  console.log("Mengambil data desa untuk kecamatan:", selectedKecamatan); // Debugging

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
    console.log("Response dari API desa:", result); // Debugging

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
      <View style={styles.top}>
        <View>
          <Text style={styles.fontHome}>SIMBADA</Text>
          <Text style={styles.fontHomex}>Sistem Informasi Batas Desa</Text>
        </View>

        <View style={{marginLeft: '40%', flexDirection: 'row', alignItems: 'center'}}>
           {/* Notification Bell */}
           <TouchableOpacity onPress={()=>Route('NotificationList')} style={{marginRight: 12, position: 'relative'}}>
            <Text style={{fontSize: 22}}>🔔</Text>
            {NOTIFICATION_COUNT > 0 && (
              <View style={homeStyles.notifBadge}>
                <Text style={homeStyles.notifBadgeText}>{NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}</Text>
              </View>
            )}
           </TouchableOpacity>

           <TouchableOpacity onPress={()=>Route('PetaFinal')}>
            <FastImage
              style={{ width: 30, height: 30 }}
              source={require('../assets/img/gis_pirate-map.png')}
              resizeMode={FastImage.resizeMode.contain}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <ImageBackground
          source={require('../assets/img/bgbg.jpg')}
          style={styles.background}
          resizeMode="cover"
        >
          <ScrollView style={{ flex: 1 }}>

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
    <Text style={homeStyles.shortcutTitle}>FITUR BARU</Text>
    <View style={homeStyles.shortcutRow}>
      <TouchableOpacity style={homeStyles.shortcutCard} onPress={() => Route('NavigasiKoordinat')}>
        <Text style={homeStyles.shortcutIcon}>🧭</Text>
        <Text style={homeStyles.shortcutLabel}>Navigasi{"\n"}Koordinat</Text>
      </TouchableOpacity>

      <TouchableOpacity style={homeStyles.shortcutCard} onPress={() => Route('GeoTagCamera')}>
        <Text style={homeStyles.shortcutIcon}>📷</Text>
        <Text style={homeStyles.shortcutLabel}>Smart{"\n"}Geo-Tag</Text>
      </TouchableOpacity>

      <TouchableOpacity style={homeStyles.shortcutCard} onPress={() => Route('OfflineSync')}>
        <View style={{position: 'relative'}}>
          <Text style={homeStyles.shortcutIcon}>📴</Text>
          {OFFLINE_QUEUE_COUNT > 0 && (
            <View style={homeStyles.shortcutBadge}>
              <Text style={homeStyles.shortcutBadgeText}>{OFFLINE_QUEUE_COUNT}</Text>
            </View>
          )}
        </View>
        <Text style={homeStyles.shortcutLabel}>Offline{"\n"}Sync</Text>
      </TouchableOpacity>

      <TouchableOpacity style={homeStyles.shortcutCard} onPress={() => Route('NotificationList')}>
        <View style={{position: 'relative'}}>
          <Text style={homeStyles.shortcutIcon}>🔔</Text>
          {NOTIFICATION_COUNT > 0 && (
            <View style={homeStyles.shortcutBadge}>
              <Text style={homeStyles.shortcutBadgeText}>{NOTIFICATION_COUNT}</Text>
            </View>
          )}
        </View>
        <Text style={homeStyles.shortcutLabel}>Notifi-{"\n"}kasi</Text>
      </TouchableOpacity>
    </View>
  </View>

  {/* Bagian Info Peta Dasar & Peta Final */}
  <View style={styles.infoContainer}>
    <View style={styles.infoCard}>
      <LinearGradient colors={["#F0F8FF", "#E0F7FA"]} style={styles.gradientBackground}>
        <Text style={styles.infoTitle}>PETA DASAR</Text>
        <Text style={styles.infoValue}>351</Text>
      </LinearGradient>
    </View>

   {/* Spacer antara dua card */}
<View style={{ width: "5%" }} />

    <View style={styles.infoCard}>
      <LinearGradient colors={["#F0F8FF", "#E0F7FA"]} style={styles.gradientBackground}>
        <Text style={styles.infoTitle}>PETA FINAL</Text>
        <Text style={styles.infoValue}>{DATA_FINAL}</Text>
      </LinearGradient>
    </View>
  </View>

  {/* Bagian Loading Peta */}
  {isPolygonLoading ? (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#208DC0" style={{ marginTop: 20 }} />
      <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16, marginBottom: 30 }}>Sedang Memuat Peta...</Text>
    </View>
  ) : (
    <View style={styles.mapDashboard}>
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
                strokeColor="#FF0000"
                fillColor="rgba(255,0,0,0.5)"
                strokeWidth={2}
                tappable
              />
            )
        )}
      </MapView>
    </View>
  )}

  {/* Bagian Select Kecamatan */}
  <View style={{ borderTopRightRadius: 20, borderTopLeftRadius: 20, marginTop: -15, backgroundColor: '#fff', borderBottomColor: 'white', borderWidth: 1, borderColor: 'white' }}>
    <Text style={{
      color: '#208DC0',
      fontWeight: 'bold',
      fontSize: 16,
      width: '90%',
      marginTop: 20,
      alignSelf: 'center',
    }}>
      SELECT LOCATION
    </Text>

    <Picker
      selectedValue={selectedKecamatan}
      onValueChange={(itemValue) => {
        setSelectedKecamatan(itemValue);
        // getPetadasar();
      }}
      style={{
        height: 50,
        color: '#208DC0',
        width: '90%',
        marginTop: 10,
        marginLeft: 20,
        paddingHorizontal: 10,
        backgroundColor: '#F0F4F8',
        borderWidth: 1,
        borderColor: '#208DC0',
        borderRadius: 10,
      }}
    >
      <Picker.Item label="-- PILIH KECAMATAN --" value="" />
      {kecamatan.map((data) => (
        <Picker.Item
          key={data.kecamatan_id}
          label={data.nama_kecamatan}
          value={data.kecamatan_id}
        />
      ))}
    </Picker>

    {/* Header Daftar Desa */}
    <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
      <Text style={{ fontWeight: "bold", color: "#208DC0", fontSize: 18, textAlign: "center", marginBottom: 10 }}>
        Daftar Desa
      </Text>
      <View style={[styles.tableRow, { backgroundColor: "#208DC0", borderTopLeftRadius: 10, borderTopRightRadius: 10 }]}>
        <Text style={[styles.tableHeader, styles.columnNo]}>No</Text>
        <Text style={[styles.tableHeader, styles.columnName, { textAlign: "left", paddingLeft: 10 }]}>Nama Desa</Text>
        <Text style={[styles.tableHeader, styles.columnArea]}>Luas (km²)</Text>
      </View>

      {/* Render Daftar Desa Menggunakan map() */}
      {desa.length > 0 ? (
        desa.map((item, index) => (
          <View key={index} style={[styles.tableRow, index % 2 !== 0 && { backgroundColor: "#E0F2F1" }]}>
            <Text style={[styles.tableCell, styles.columnNo]}>{String(index + 1)}</Text>
            <Text style={[styles.tableCell, styles.columnName, { textAlign: "left", paddingLeft: 10 }]}>
              {item?.lokasi?.nama_desa ? String(item.lokasi.nama_desa) : "Tidak Diketahui"}
            </Text>
            <Text style={[styles.tableCell, styles.columnArea]}>
              {item.calculatedArea ? String(item.calculatedArea) : "0"} km²
            </Text>
          </View>
        ))
      ) : (
        <Text style={{ textAlign: "center", marginTop: 10, color: "#808080" }}>Tidak ada desa ditemukan</Text>
      )}
    </View>
  </View>
</ScrollView>

        </ImageBackground>
      </View>

      <TabBar/>

      
    </View>
  );
};

// Menyediakan komponen ini untuk aplikasi

export default Home;
