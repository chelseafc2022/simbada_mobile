// import pustaka
import React, { Component, useState, useEffect } from 'react';
import styles from '../assets/style';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ImageBackground, ActivityIndicator } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useIsFocused } from '@react-navigation/native';
import MapView, { Marker, Polygon }  from 'react-native-maps';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import TabBar from '../components/TabBar'
import LinearGradient from 'react-native-linear-gradient';
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
  const store = useSelector((state) => state);
  const isFocused = useIsFocused();
  const [DATA_FINAL, SET_DATA_FINAL] = useState([]);
  const [isPolygonLoading, setIsPolygonLoading] = useState(false);
  
  // Fungsi untuk menyimpan token di AsyncStorage
  const saveDataToken = async (token) => {
    try {
      await AsyncStorage.setItem('TOKEN', token); // Simpan token
      console.log('Token saved:', token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  };


  const getKecamatan = async () => {
    // setIsLoading(true); // Aktifkan indikator loading
    try {
      const response = await fetch(store.URL.URL_KECAMATAN + "kecamatan_all", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: "kikensbatara " + store.TOKEN, // Ganti dengan token otorisasi Anda
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

  

const getPetafinal = async () => {
  try {
    setIsLoading(true);

    const response = await fetch(store.URL.URL_HOME + "peta_final", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "kikensbatara " + store.TOKEN,
      },
    });

    const result = await response.json();
    if (result[0]) SET_DATA_FINAL(result[0]);
  } catch (error) {
    console.error("Fetch Error:", error);
  } finally {
    setIsLoading(false);
  }
};


const getPetadasar = async () => {
  setIsPolygonLoading(true);
  try {
    const response = await fetch(`${store.URL.URL_HOME}petadasar`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        Authorization: "kikensbatara " + store.TOKEN,
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

        <View style={{ marginLeft: '55%' }}>
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
          <ScrollView>
            <View style={{ flex: 1, flexDirection: 'row', width: '100%', justifyContent: 'center', marginTop: 30 }}>
              <View style={{ borderWidth: 1, height: 100, width: '40%', borderRadius: 20, borderColor: '#208DC0', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>
                  PETA DASAR
                </Text>
                <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16 }}>
                  351
                </Text>
              </View>
              <View style={{ height: 100, width: '5%' }}></View>
              <View style={{ borderWidth: 1, height: 100, width: '40%', borderRadius: 20, borderColor: '#208DC0', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
                <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>
                  PETA FINAL
                </Text>
                
                    <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16 }}>
                        {DATA_FINAL}  {/* Menampilkan peta_final */}
                    </Text>

              </View>
            </View>

            {isPolygonLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#208DC0" style={{ marginTop: 20 }} />
                  <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16 , marginBottom:30}}>Sedang Memuat Peta...</Text>
                </View>
            ) : (
            <View style={styles.mapDashboard}>
            <MapView
              style={{ flex: 1 }}
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
                      // onPress={() => Alert.alert('Data Peta', JSON.stringify(polygon.lokasi))}
                    />
                  )
              )}
            </MapView>
            </View>
            )}
              
            

            <View style={{ borderTopRightRadius: 20, borderTopLeftRadius: 20, marginTop: -15, backgroundColor: '#fff', borderBottomColor: 'white', borderWidth: 1, borderColor: 'white', height: 200 }}>
              <Text style={{
                color: '#208DC0',
                fontWeight: 'bold',
                fontSize: 16,
                height: 'auto',
                width: '90%',
                marginTop: 20,
                marginTop: 20,
                alignSelf: 'center',
              }}>
                SELECT LOCATION
              </Text>

            
              <Picker
              selectedValue={selectedKecamatan}
              onValueChange={(itemValue) => {
                setSelectedKecamatan(itemValue);
                getPetadasar(); // Panggil fungsi ini untuk memperbarui polygon
              }}
              style={{height: 50,
                color: '#208DC0', 
                width: '90%',
                marginTop: 10,
                marginLeft: 20,
                paddingHorizontal: 10,
                backgroundColor: '#F0F4F8',  // Background yang soft
                borderWidth: 1,
                borderColor: '#208DC0',
                borderRadius: 10,}}
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
