// import pustaka
import React, { Component, useState, useEffect, useCallback } from 'react';
import styles from '../assets/style';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ImageBackground, ActivityIndicator, Alert } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polygon }  from 'react-native-maps';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import TabBar from '../components/TabBar'
import LinearGradient from 'react-native-linear-gradient';
import * as turf from '@turf/turf';

import { Assets } from '@react-navigation/elements';

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
  const isFocused = useIsFocused();
  const [DATA_FINAL, SET_DATA_FINAL] = useState([]);
  const [isPolygonLoading, setIsPolygonLoading] = useState(false);
  const [desa, setDesa] = useState([]); // State untuk daftar desa

  useFocusEffect(
    useCallback(() => {
      console.log("📥 Home is focused");

      return () => {
        console.log("🧹 Cleanup Home");
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

    if (result.length > 0) {
      setDesa(result); // Simpan daftar desa ke state
    } else {
      setDesa([]); // Kosongkan daftar jika tidak ada desa
    }
  } catch (error) {
    console.error("Fetch Error:", error);
  }
};
// Panggil getDesaByKecamatan setiap kali selectedKecamatan berubah
useEffect(() => {
  if (selectedKecamatan) {
    getDesaByKecamatan();
  }
}, [selectedKecamatan]);

  

const getPetafinal = async () => {
  try {
    setIsLoading(true);
    console.log("DATA_FINAL type:", typeof DATA_FINAL);
console.log("DATA_FINAL value:", DATA_FINAL);

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
  // if (!selectedKecamatan) return;
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
    if (!data || data.length === 0) {
      console.warn('Polygon data is empty');
      return;
    }

    setPetadasar(
      data.map(polygon => ({
        ...polygon,
        lokasi: {
          ...polygon.lokasi,
          coordinat: polygon.lokasi.coordinat.map(({ lat, lng }) => ({
            latitude: lat,
            longitude: lng,
          })),
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
  if (selectedKecamatan) {
    getPetadasar(); // Panggil jika kecamatan sudah dipilih
  }
}, [selectedKecamatan]);


  

  // Hook useEffect untuk mengambil data saat halaman ini fokus
  useEffect(() => {
    console.log('Fetching data...');
    const fetchData = async () => {
      await Promise.all([getPetafinal(), getKecamatan(), getPetadasar()]);
    };
    fetchData();
  }, [isFocused]);

 
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <View>
          <Text style={styles.fontHome}>SIMBADA</Text>
          <Text style={styles.fontHomex}>Sistem Informasi Batas Desa</Text>
        </View>

        <View style={{marginLeft: '55%'}}>
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
              {calculateArea(item.lokasi.coordinat) ? String(calculateArea(item.lokasi.coordinat)) : "0"} km²
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
