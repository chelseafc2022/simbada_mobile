//import liraries
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator, ImageBackground, Modal } from 'react-native';
import FastImage from "react-native-fast-image";
import MapView, { Polygon } from 'react-native-maps';
import TabBar from '../components/TabBar'
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as turf from '@turf/turf';

import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

// create a component
const PetaDasar = ({ navigation }) => {
  const Route = (routex) => {
    navigation.navigate(routex)
  }

  const TOKEN = useSelector(state => state.TOKEN);
  const PROFILE = useSelector(state => state.PROFILE);
  const URL = useSelector(state => state.URL);

  const status_user = parseInt(PROFILE?.profile?.status) || 1;
  const id_kecamatan_user = PROFILE?.profile?.id_kecamatan || '';

  const [isLoading, setIsLoading] = useState(true);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [desaList, setDesaList] = useState([]);
  const [selectedKecamatan, setSelectedKecamatan] = useState(
    (status_user === 2 || status_user === 3) ? id_kecamatan_user : ''
  );
  const [selectedDesa, setSelectedDesa] = useState('');
  const [initialPolygonData, setInitialPolygonData] = useState([]);  // Semua polygon awal
  const [filteredPolygonData, setFilteredPolygonData] = useState([]);  // Polygon hasil filter
  const [kecamatanPolygonData, setKecamatanPolygonData] = useState([]);
  const [desaPolygonData, setDesaPolygonData] = useState([]);  // Polygon desa
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPolygonDetail, setSelectedPolygonDetail] = useState(null);

  const calculateArea = (coordinates) => {
    try {
      const geoJSONCoordinates = coordinates.map(coord => {
        if (coord.latitude && coord.longitude) {
          return [coord.longitude, coord.latitude]; 
        }
        return null;
      }).filter(coord => coord !== null);

      if (geoJSONCoordinates.length < 3) return 0;
      
      // Ensure polygon is closed for turf
      if (geoJSONCoordinates[0][0] !== geoJSONCoordinates[geoJSONCoordinates.length - 1][0] || 
          geoJSONCoordinates[0][1] !== geoJSONCoordinates[geoJSONCoordinates.length - 1][1]) {
          geoJSONCoordinates.push(geoJSONCoordinates[0]);
      }

      const polygon = turf.polygon([geoJSONCoordinates]);
      const area = turf.area(polygon) / 1e6; // Convert dari m² ke km²
      return area.toFixed(2); // Format ke 2 desimal
    } catch (error) {
      return 0;
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log("📥 PetaDasar dibuka");

      return () => {
        console.log("🧹 Cleanup PetaDasar");
        setInitialPolygonData([]);
        setFilteredPolygonData([]);
        setKecamatanPolygonData([]);
        setDesaPolygonData([]);
        setSelectedDesa('');
        setSelectedKecamatan('');
      };
    }, [])
  );

  useEffect(() => {
    let isMounted = true;

    // Jika user adalah Operator Desa (2) atau Kecamatan (3), jangan muat se-Provinsi
    if (status_user === 2 || status_user === 3) {
      if (id_kecamatan_user) {
        fetchPolygonDataKecamatan(id_kecamatan_user);
      } else {
        setIsLoading(false);
      }
      return () => { isMounted = false; }; 
    }

    const fetchAllPolygonData = async () => {
      try {
        const cacheKey = '@peta_dasar_all_polygon';
        
        // Cek Cache Lokal (Stale-While-Revalidate)
        if (initialPolygonData.length === 0) {
            try {
                const cachedStr = await AsyncStorage.getItem(cacheKey);
                if (cachedStr && isMounted) {
                    setInitialPolygonData(JSON.parse(cachedStr));
                    setIsLoading(false); // Matikan loading karena data cache ada
                } else if (isMounted) {
                    setIsLoading(true); // Tampilkan loading jika belum ada cache
                }
            } catch (e) {
                if (isMounted) setIsLoading(true);
            }
        }

        const response = await fetch(URL.URL_HOME + 'petadasar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${TOKEN}`
          },
        });

        const data = await response.json();

        if (!Array.isArray(data)) {
            // Silently ignore if unauthorized (expected on logout)
            if (data?.message !== "SSILAHKAN LOGIN DULU..!!!") {
                console.log("fetchAllPolygonData: Response is not an array", data);
            }
            return;
        }

        const formattedData = data.map(polygon => ({
          kode_desa: polygon.lokasi?.kode_desa,
          coordinates: polygon.lokasi?.coordinat?.map(coord => ({
            latitude: parseFloat(coord.lat),
            longitude: parseFloat(coord.lng),
          })) || [],
        }));

        if (isMounted) {
            setInitialPolygonData(formattedData);
            try {
                await AsyncStorage.setItem(cacheKey, JSON.stringify(formattedData));
            } catch (cacheError) {
                console.warn('Cache peta terlalu besar untuk disimpan di SQLite:', cacheError);
            }
        }
      } catch (error) {
        if (isMounted) {
            // Alert.alert('Error', 'Gagal mengambil semua data polygon');
            console.error(error);
        }
      } finally {
        if (isMounted) {
            setIsLoading(false);
        }
      }
    };
    fetchAllPolygonData();

    return () => {
        isMounted = false;
    };
  }, [TOKEN]);

  // **2. Fetch kecamatan**
  useEffect(() => {
    const fetchKecamatan = async () => {
      try {
        const response = await fetch(URL.URL_KECAMATAN + "kecamatan_all", {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${TOKEN}`
          },
        });
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            if (data?.message !== "SSILAHKAN LOGIN DULU..!!!") {
                console.log("fetchKecamatan: Response is not an array", data);
            }
            return;
        }

        setKecamatanList(data.map(item => {
          const no_prop = item.hasil?.no_prop?.toString().padStart(2, '0') || '00';
          const no_kab = item.hasil?.no_kab?.toString().padStart(2, '0') || '00';
          const kode = item.hasil?.kode?.toString().padStart(2, '0') || '00';
          return {
            id: `${no_prop}.${no_kab}.${kode}`,
            name: item.hasil?.uraian || ''
          };
        }));
      } catch (error) {
        Alert.alert('Error', 'Gagal mengambil data kecamatan');
        console.error(error);
      }
    };
    fetchKecamatan();
  }, [TOKEN]);

  // **3. Fetch desa berdasarkan kecamatan**
  useEffect(() => {
    if (selectedKecamatan) {
      const fetchDesa = async () => {
        try {
          const response = await fetch(URL.URL_KECAMATAN + "desa", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `kikensbatara ${TOKEN}`
            },
            body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
          });
          const result = await response.json();
          
          if (!Array.isArray(result)) {
              if (result?.message !== "SSILAHKAN LOGIN DULU..!!!") {
                  console.log("fetchDesa: Response is not an array", result);
              }
              return;
          }

          setDesaList(result.map(item => {
            const no_prop = item.no_prop?.toString().padStart(2, '0') || '00';
            const no_kab = item.no_kab?.toString().padStart(2, '0') || '00';
            const no_kec = item.no_kec?.toString().padStart(2, '0') || '00';
            const kode_desa = item.kode?.toString().padStart(4, '0') || '0000';
            return {
              id: `${no_prop}.${no_kab}.${no_kec}.${kode_desa}`,
              name: item.uraian || ''
            };
          }));
        } catch (error) {
          Alert.alert('Error', 'Gagal mengambil data desa');
          console.error(error);
        }
      };
      fetchDesa();
    }
  }, [selectedKecamatan]);


  // **4. Fetch polygon kecamatan**
  const fetchPolygonDataKecamatan = async (kecamatanId) => {
    setIsLoading(true);
    try {
      const response = await fetch(URL.URL_HOME + 'petadasar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'kikensbatara ' + TOKEN,
        },
        body: JSON.stringify({ kecamatan_id: kecamatanId }),
      });

      const data = await response.json();
      
      if (!Array.isArray(data)) {
          if (data?.message !== "SSILAHKAN LOGIN DULU..!!!") {
              console.log("fetchPolygonDataKecamatan: Response is not an array", data);
          }
          return;
      }

      setKecamatanPolygonData(
        data.map(polygon => ({
          kode_desa: polygon.lokasi?.kode_desa,
          coordinates: polygon.lokasi?.coordinat?.map(coord => ({
            latitude: parseFloat(coord.lat),
            longitude: parseFloat(coord.lng),
          })) || [],
        }))
      );
    } catch (error) {
      Alert.alert('Error', 'Gagal mengambil data polygon kecamatan');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // **5. Filter polygon desa di frontend**
  const filterPolygonByDesa = (desaId) => {
    const filteredPolygons = kecamatanPolygonData.filter(polygon => polygon.kode_desa === desaId || desaId.endsWith(`.${polygon.kode_desa}`));
    if (filteredPolygons.length > 0) {
      setDesaPolygonData(filteredPolygons);
    } else {
      Alert.alert('Info', 'Tidak ada polygon untuk desa yang dipilih');
      setDesaPolygonData([]);
    }
  };

  return (

    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <View>

          <Text style={styles.fontHome}>
            PETA DASAR
          </Text>
          <Text style={styles.fontHomex}>
            Sistem Informasi Batas Desa
          </Text>
        </View>

        <View style={{ marginLeft: '50%' }} >
          <TouchableOpacity onPress={() => Route('PetaFinal')}>
            <FastImage
              style={{ width: 30, height: 30 }}
              source={require('../assets/img/gis_pirate-map.png')}
              resizeMode={FastImage.resizeMode.contain}
            />
          </TouchableOpacity>

        </View>

      </View>


      <View style={{ flex: 1 }}>
        <ImageBackground
          source={require('../assets/img/bgbg.jpg')}
          style={styles.background}
          resizeMode="cover"
        >

          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#208DC0" style={{ marginTop: 20 }} />
              <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16, marginBottom: 30 }}>Sedang Memuat Peta...</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <MapView
                style={styles.map}
                provider="google"
                initialRegion={{
                  latitude: -4.2021418,
                  longitude: 122.4819808,
                  latitudeDelta: 1.0,
                  longitudeDelta: 1.0,
                }}
                key={JSON.stringify(selectedDesa ? desaPolygonData : (selectedKecamatan ? kecamatanPolygonData : initialPolygonData))}
              >
                {(selectedDesa ? desaPolygonData : (selectedKecamatan ? kecamatanPolygonData : initialPolygonData)).map((polygon, index) => (
                  <Polygon
                    key={index}
                    coordinates={polygon.coordinates}
                    strokeColor="#FF0000"
                    fillColor="rgba(255,0,0,0.5)"
                    tappable={true}
                    onPress={() => {
                        const desaName = desaList.find(d => d.id === polygon.kode_desa || d.id.endsWith(`.${polygon.kode_desa}`))?.name || `Desa Kode: ${polygon.kode_desa || 'Tidak Diketahui'}`;
                        setSelectedPolygonDetail({
                            namaDesa: desaName,
                            coordinates: polygon.coordinates
                        });
                        setDetailModalVisible(true);
                    }}
                  />
                ))}
              </MapView>

            </View>
          )}

          <View style={{ borderTopRightRadius: 20, borderTopLeftRadius: 20, marginTop: -15, paddingBottom: 20, backgroundColor: '#fff', borderBottomColor: 'white', borderWidth: 1, borderColor: 'white' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '90%', alignSelf: 'center', marginTop: 20 }}>
                <Text style={{
                  color: '#208DC0',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>
                  SELECT LOCATION
                </Text>
                
                {selectedDesa ? (
                    <TouchableOpacity 
                        onPress={() => setSelectedDesa('')} 
                        style={{ backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🔄 Tampilkan Semua</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                Pilih Kecamatan
            </Text> */}
            <Picker
              style={{
                height: 50,
                color: '#208DC0',
                width: '90%',
                marginTop: 10,
                marginLeft: 20,
                paddingHorizontal: 10,
                backgroundColor: (status_user === 2 || status_user === 3) ? '#E2E8F0' : '#F0F4F8',  // Lebih gelap jika disable
                borderWidth: 1,
                borderColor: '#208DC0',
                borderRadius: 10,
              }}
              selectedValue={selectedKecamatan}
              onValueChange={itemValue => {
                setSelectedKecamatan(itemValue);
                setSelectedDesa('');
                fetchPolygonDataKecamatan(itemValue);
              }}
              enabled={status_user !== 2 && status_user !== 3} // <-- Kunci Kecamatan untuk operator
            >
              <Picker.Item label="-- PILIH KECAMATAN --" value="" />
              {kecamatanList.map(item => (
                <Picker.Item key={item.id} label={item.name} value={item.id} />
              ))}
            </Picker>

            {/* <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                Pilih Desa
            </Text> */}

            <Picker
              style={{
                height: 50,
                color: '#208DC0',
                width: '90%',
                marginTop: 10,
                marginLeft: 20,
                paddingHorizontal: 10,
                backgroundColor: '#F0F4F8',  // Background yang soft
                borderWidth: 1,
                borderColor: '#208DC0',
                borderRadius: 10,
              }}
              selectedValue={selectedDesa}
              onValueChange={itemValue => {
                setSelectedDesa(itemValue);
                filterPolygonByDesa(itemValue);
              }}
              enabled={selectedKecamatan !== ''}
            >
              <Picker.Item label="-- PILIH DESA --" value="" />
              {desaList.map(item => (
                <Picker.Item key={item.id} label={item.name} value={item.id} />
              ))}
            </Picker>

            <TouchableOpacity
              style={{
                backgroundColor: '#208DC0',
                width: '90%',
                height: 50,
                alignSelf: 'center',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 10,
                marginTop: 15,
                marginBottom: 5,
              }}
              onPress={() => Route('PetaFinal')}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                KE PETA FINAL
              </Text>
            </TouchableOpacity>

          </View>
        </ImageBackground>

        {/* Modal Detail Desa */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={detailModalVisible}
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#208DC0' }}>Detail Lokasi Desa</Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Text style={{ fontSize: 18, color: '#EF4444', fontWeight: 'bold' }}>Tutup</Text>
                </TouchableOpacity>
              </View>

              {selectedPolygonDetail && (
                <ScrollView>
                  <Text style={{ fontSize: 16, marginBottom: 5 }}>
                    <Text style={{ fontWeight: 'bold' }}>Nama Desa:</Text> {selectedPolygonDetail.namaDesa}
                  </Text>
                  {/* Kita bisa ambil nama kecamatan dari list atau state jika perlu */}
                  <Text style={{ fontSize: 16, marginBottom: 5 }}>
                    <Text style={{ fontWeight: 'bold' }}>Luas Area:</Text> {calculateArea(selectedPolygonDetail.coordinates)} km²
                  </Text>
                  
                  <Text style={{ fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 }}>Titik Koordinat Poligon:</Text>
                  <View style={{ backgroundColor: '#F0F4F8', padding: 10, borderRadius: 10 }}>
                    {selectedPolygonDetail.coordinates.slice(0, 10).map((coord, index) => (
                      <Text key={index} style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>
                        {index + 1}. Lat: {coord.latitude.toFixed(6)}, Lng: {coord.longitude.toFixed(6)}
                      </Text>
                    ))}
                    {selectedPolygonDetail.coordinates.length > 10 && (
                      <Text style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 5 }}>
                        ... dan {selectedPolygonDetail.coordinates.length - 10} titik lainnya disembunyikan.
                      </Text>
                    )}
                  </View>
                  <View style={{height: 20}} />
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

      </View>
      <TabBar />


    </View>

    //     </View>
  );
};

const pickerStyles = StyleSheet.create({
  pickerContainer: {
    marginVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#F0F4F8',  // Background yang soft
    borderWidth: 1,
    borderColor: '#208DC0',
    borderRadius: 10,
  },
  picker: {
    height: 50,
    color: '#208DC0',  // Warna teks
  },
  labelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208DC0',
    marginBottom: 5,
  },
});


//make this component available to the app
export default PetaDasar;
