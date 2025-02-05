//import liraries
import React, { useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView , TextInput,StyleSheet, Alert, ActivityIndicator, ImageBackground } from 'react-native';
import FastImage from "react-native-fast-image";
import MapView, { Polygon } from 'react-native-maps';
import TabBar from '../components/TabBar'
import { Picker } from '@react-native-picker/picker';
import { useSelector } from 'react-redux';

// create a component
const PetaFinal = ({navigation}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }

        const store = useSelector(state => state);
        const [isLoading, setIsLoading] = useState(true);
        const [kecamatanList, setKecamatanList] = useState([]);
        const [desaList, setDesaList] = useState([]);
        const [selectedKecamatan, setSelectedKecamatan] = useState('');
        const [selectedDesa, setSelectedDesa] = useState('');
        const [initialPolygonData, setInitialPolygonData] = useState([]);  // Semua polygon awal
        const [filteredPolygonData, setFilteredPolygonData] = useState([]);  // Polygon hasil filter
        const [kecamatanPolygonData, setKecamatanPolygonData] = useState([]);
        const [desaPolygonData, setDesaPolygonData] = useState([]);  // Polygon desa
        const [userStatus, setUserStatus] = useState(store.PROFILE.profile?.status || "1");

    

    // Pengecekan status user sebelum akses
        // if (userStatus !== "1" && userStatus !== "3") {
        //     return (
        //         <View style={styles.restrictedAccess}>
        //             <Text style={styles.errorText}>Akses ditolak. Anda tidak memiliki izin.</Text>
        //         </View>
        //     );
        // }

        useEffect(() => {
            const fetchAllPolygonData = async () => {
              setIsLoading(true);
              try {
                const response = await fetch(store.URL.URL_PETA_FINAL + 'petafinal', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'kikensbatara ' + store.TOKEN,
                  },
                });
        
                const data = await response.json();
                // console.log('🚀 Semua polygon kabupaten:', JSON.stringify(data, null, 2));
                // console.log('API Response:', data); // Log untuk memeriksa bentuk data
                    // Cek apakah data adalah array dan lokasi.coordinat ada
                const validPolygons = data.filter(item => 
                    item.lokasi && Array.isArray(item.lokasi.coordinat)
                );

                setInitialPolygonData(
                    validPolygons.map(polygon => ({
                    coordinates: polygon.lokasi.coordinat.map(coord => ({
                        latitude: parseFloat(coord.lat),
                        longitude: parseFloat(coord.lng),
                    })),
                    }))
                );
                } catch (error) {
                Alert.alert('Error', 'Gagal mengambil data peta final');
                console.error(error);
                } finally {
                setIsLoading(false);
                }
            };
            fetchAllPolygonData();
          }, [store.TOKEN]);

          // **2. Fetch kecamatan**
             // Fetch kecamatan
             useEffect(() => {
                const fetchKecamatan = async () => {
                  try {
                    const response = await fetch(store.URL.URL_PETA_FINAL + 'kecamatan', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'kikensbatara ' + store.TOKEN,
                      },
                    });
                    const data = await response.json();
                    // console.log('List Kecamatan:', data);  // Debug log
              
                    if (Array.isArray(data)) {
                      setKecamatanList(
                        data.map((item) => {
                            const noProp = String(item.hasil.no_prop || '0').padStart(2, '0');
                            const noKab = String(item.hasil.no_kab || '0').padStart(2, '0');
                            const kodeKec = String(item.hasil.kode || '0').padStart(2, '0');  // Pastikan `kode` selalu string dengan fallback '0'
                        
                            return {
                              id: `${noProp}.${noKab}.${kodeKec}`,
                              name: item.hasil.uraian || 'Nama tidak diketahui',  // Fallback jika nama kecamatan tidak ada
                            };
                          })
                      );
                    } else {
                      console.warn('Data kecamatan tidak berbentuk array:', data);
                      setKecamatanList([]);
                    }
                  } catch (error) {
                    Alert.alert('Error', 'Gagal mengambil data kecamatan');
                    console.error(error);
                  }
                };
                fetchKecamatan();
              }, [store.TOKEN]);
              

            // **3. Fetch desa berdasarkan kecamatan**
            useEffect(() => {
                if (selectedKecamatan) {
                  const fetchDesa = async () => {
                    try {
                      const response = await fetch(store.URL.URL_PETA_FINAL + 'desa', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: 'kikensbatara ' + store.TOKEN,
                        },
                        body: JSON.stringify({ kecamatan_id: selectedKecamatan }),
                      });
                      const result = await response.json();
                      setDesaList(
                        result.map((item) => ({
                          id: `${item.no_prop}.${item.no_kab}.${item.no_kec}.${String(item.kode || '0').padStart(4, '0')}`,
                          name: item.uraian || 'Nama desa tidak tersedia',  // Fallback jika `uraian` kosong
                        }))
                      );
                      
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
                          const response = await fetch(store.URL.URL_APP + 'api/v1/petafinal/petafinal', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'kikensbatara ' + store.TOKEN,
                            },
                            body: JSON.stringify({
                              kecamatan_id: kecamatanId,
                              des_kel_id: '',  // Kosongkan untuk mengambil semua desa
                            }),
                          });
                      
                          const data = await response.json();
                        //   console.log('Data kecamatan yang diterima:', data);  // Debug log
                      
                          // Validasi data dan filter polygon
                          const validPolygons = data.filter((polygon) => 
                            polygon.lokasi && 
                            Array.isArray(polygon.lokasi.coordinat) && 
                            polygon.lokasi.coordinat.length > 0  // Pastikan koordinat tidak kosong
                          );
                      
                          if (validPolygons.length > 0) {
                            setKecamatanPolygonData(
                              validPolygons.map((polygon) => ({
                                kode_desa: polygon.lokasi.kode_desa,
                                coordinates: polygon.lokasi.coordinat.map((coord) => ({
                                  latitude: parseFloat(coord.lat),
                                  longitude: parseFloat(coord.lng),
                                })),
                              }))
                            );
                          } else {
                            Alert.alert('Info', 'Polygon kecamatan tidak ditemukan.');
                            setKecamatanPolygonData([]);  // Reset jika tidak ada polygon
                          }
                        } catch (error) {
                          console.error('Error fetching data for kecamatan:', error);
                          Alert.alert('Error', 'Gagal mengambil data poligon kecamatan');
                        } finally {
                          setIsLoading(false);
                        }
                      };
                      

                    // **5. Filter polygon desa di frontend**
                    const filterPolygonByDesa = (desaId) => {
                        // Format `desaId` menjadi xx.xx.xx.xxxx
                        const formattedDesaId = desaId.split('.').map(part => part.padStart(2, '0')).join('.');
                      
                        console.log("Formatted Desa ID yang dipilih:", formattedDesaId);  // Debug log untuk memeriksa ID desa yang sudah diformat
                      
                        // Filter polygon berdasarkan desa yang dipilih
                        const filteredPolygons = kecamatanPolygonData.filter((polygon) => polygon.kode_desa === formattedDesaId);
                      
                        if (filteredPolygons.length > 0) {
                          setDesaPolygonData(filteredPolygons);  // Set polygon desa ke state
                        } else {
                          console.log("Tidak ada polygon untuk desa yang dipilih");
                          Alert.alert('Info', 'Tidak ada polygon untuk desa yang dipilih');
                          setDesaPolygonData([]);  // Reset jika tidak ada polygon
                        }
                      };
       
    return (

        <View style={{flex:1}}>
            <View style={styles.top}>
                <View>
                    
                    <Text style={styles.fontHome}>
                        PETA FINAL
                    </Text>
                    <Text style={styles.fontHomex}>
                    Sistem Informasi Batas Desa
                    </Text>
                </View>

                <View style={{marginLeft:'50%'}} >
                <TouchableOpacity onPress={()=>Route('PetaFinal')}>
                    <FastImage 
                        style={{width: 30, height: 30}}
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

              
        {parseInt(userStatus) !== 1 && parseInt(userStatus) !== 3 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <FastImage 
                  style={{ width: 100, height: 100, marginBottom: 20, marginTop:20 }}
                  source={require('../assets/img/error.png')} // Ganti dengan path logo Anda
                  resizeMode={FastImage.resizeMode.contain}
              />
              <Text style={{ color: '#721c24', fontWeight: 'bold', fontSize: 22, textAlign: 'center', paddingHorizontal: 20 }}>
                  ⚠️ Akses Ditolak
              </Text>
              <Text style={{ color: '#721c24', fontSize: 16, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }}>
                  Halaman ini hanya bisa diakses oleh Administrator dan Admin Kecamatan.
              </Text>
          </View>
            ):(
              <>
            
              
            {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#208DC0" style={{ marginTop: 20 }} />
                <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16 , marginBottom:30}}>Sedang Memuat Peta...</Text>
              </View>
            ) : (
                <View style={styles.mapxdasar}>
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
                        strokeColor="blue"
                        fillColor="rgba(0,0,255,0.5)"
                        />
                    ))}
                </MapView>

            </View> 
        )}

            <View style={{borderTopRightRadius:20, borderTopLeftRadius:20, marginTop:-15, height: 200, backgroundColor:'#fff', borderBottomColor:'white', borderWidth:1, borderColor:'white'}}>
                <Text style={{
                color: '#208DC0', 
                fontWeight:'bold', 
                fontSize:16, 
                height: 'auto', 
                width:'90%', 
                marginTop:20, 
                alignSelf:'center'}}>

                SELECT LOCATION
            </Text>

            {/* <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                Pilih Kecamatan
            </Text> */}
            <Picker
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
            onValueChange={itemValue => {
                setSelectedKecamatan(itemValue);
                setSelectedDesa('');
                fetchPolygonDataKecamatan(itemValue);
              }}
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
         
        </View>
        </>
)}
   </ImageBackground>
   </View>
           
           <TabBar/>
            
           
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
export default PetaFinal;
