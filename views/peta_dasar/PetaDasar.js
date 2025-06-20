//import liraries
import React, { useState, useEffect,useCallback } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView , TextInput,StyleSheet, Alert, ActivityIndicator, ImageBackground } from 'react-native';
import FastImage from "react-native-fast-image";
import MapView, { Polygon } from 'react-native-maps';
import TabBar from '../components/TabBar'
import { Picker } from '@react-native-picker/picker';

import {useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';

// create a component
const PetaDasar = ({navigation}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }

      const TOKEN = useSelector(state => state.TOKEN);
      // const PROFILE = useSelector(state => state.PROFILE);
      const URL = useSelector(state => state.URL);
      
        const [isLoading, setIsLoading] = useState(true);
        const [kecamatanList, setKecamatanList] = useState([]);
        const [desaList, setDesaList] = useState([]);
        const [selectedKecamatan, setSelectedKecamatan] = useState('');
        const [selectedDesa, setSelectedDesa] = useState('');
        const [initialPolygonData, setInitialPolygonData] = useState([]);  // Semua polygon awal
        const [filteredPolygonData, setFilteredPolygonData] = useState([]);  // Polygon hasil filter
        const [kecamatanPolygonData, setKecamatanPolygonData] = useState([]);
        const [desaPolygonData, setDesaPolygonData] = useState([]);  // Polygon desa

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
            const fetchAllPolygonData = async () => {
              setIsLoading(true);
              try {
                const response = await fetch(URL.URL_HOME + 'petadasar', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `kikensbatara ${TOKEN}`
                  },
                });
        
                const data = await response.json();
                // console.log('🚀 Semua polygon kabupaten:', JSON.stringify(data, null, 2));
        
                setInitialPolygonData(
                  data.map(polygon => ({
                    coordinates: polygon.lokasi.coordinat.map(coord => ({
                      latitude: parseFloat(coord.lat),
                      longitude: parseFloat(coord.lng),
                    })),
                  }))
                );
              } catch (error) {
                Alert.alert('Error', 'Gagal mengambil semua data polygon');
                console.error(error);
              } finally {
                setIsLoading(false);
              }
            };
            fetchAllPolygonData();
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
                    setKecamatanList(data.map(item => {
                    const no_prop = item.hasil.no_prop.toString().padStart(2, '0');
                    const no_kab = item.hasil.no_kab.toString().padStart(2, '0');
                    const kode = item.hasil.kode.toString().padStart(2, '0');
                    return {
                        id: `${no_prop}.${no_kab}.${kode}`,
                        name: item.hasil.uraian
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
                        setDesaList(result.map(item => {
                            const no_prop = item.no_prop.toString().padStart(2, '0');
                            const no_kab = item.no_kab.toString().padStart(2, '0');
                            const no_kec = item.no_kec.toString().padStart(2, '0');
                            const kode_desa = item.kode.toString().padStart(4, '0');
                            return {
                            id: `${no_prop}.${no_kab}.${no_kec}.${kode_desa}`,
                            name: item.uraian
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
                        setKecamatanPolygonData(
                            data.map(polygon => ({
                            kode_desa: polygon.lokasi.kode_desa,
                            coordinates: polygon.lokasi.coordinat.map(coord => ({
                                latitude: parseFloat(coord.lat),
                                longitude: parseFloat(coord.lng),
                            })),
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
                        const filteredPolygons = kecamatanPolygonData.filter(polygon => polygon.kode_desa === desaId);
                        if (filteredPolygons.length > 0) {
                        setDesaPolygonData(filteredPolygons);
                        } else {
                        Alert.alert('Info', 'Tidak ada polygon untuk desa yang dipilih');
                        setDesaPolygonData([]);
                        }
                    };
       
    return (

        <View style={{flex:1}}>
            <View style={styles.top}>
                <View>
                    
                    <Text style={styles.fontHome}>
                        PETA DASAR
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

            
            <View style={{ flex: 1 }}>
              <ImageBackground
                    source={require('../assets/img/bgbg.jpg')}
                    style={styles.background}
                    resizeMode="cover"
                >
              
            {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#208DC0" style={{ marginTop: 20 }} />
              <Text style={{ color: '#208DC0', fontWeight: 'bold', fontSize: 16 , marginBottom:30}}>Sedang Memuat Peta...</Text>
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
export default PetaDasar;
