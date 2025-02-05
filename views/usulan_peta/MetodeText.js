import React, { useRef, useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import FastImage from "react-native-fast-image";
import TabBar from '../components/TabBar'
import Geolocation from '@react-native-community/geolocation'; 
import { PermissionsAndroid } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

// create a component
const MetodeText = ({navigation, route}) => {
    const Route = (routex, data) => {
        navigation.navigate(routex, data)
    }

    const { lokasiAwal, onLokasiUpdate } = route.params; // Tangkap lokasi awal dan fungsi callback
    const [lokasi, setLokasi] = useState(lokasiAwal || []); // State untuk lokasi
    const [isLoading, setIsLoading] = useState(false);
    const [polygonCoords, setPolygonCoords] = useState([]); 
    const [currentLocation, setCurrentLocation] = useState(null); // State untuk lokasi terkini
    const [userLocation, setUserLocation] = useState(null);
    const [region, setRegion] = useState({
      latitude: -4.3332916, 
      longitude: 122.2788887,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
  });
    // Membuat ref untuk MapView agar kita bisa memanggil metode animateToRegion
    const mapViewRef = useRef(null);



    const sendBackLokasi = () => {
        if (route.params?.onLokasiUpdate) {
            console.log("Mengirim lokasi kembali:", lokasi); // Debug: Cek data yang dikirim
            route.params.onLokasiUpdate(lokasi); // Kirim lokasi yang diperbarui ke AddUsulan
        }
        navigation.goBack(); // Kembali ke AddUsulan
    };

    


    
    const requestLocationPermission = async () => {
      try {
          const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
              {
                  title: "Location Permission",
                  message: "We need access to your location",
                  buttonNeutral: "Ask Me Later",
                  buttonNegative: "Cancel",
                  buttonPositive: "OK"
              }
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
              console.log("You can access the location");
              return true;
          } else {
              console.log("Location permission denied");
              return false;
          }
      } catch (err) {
          console.warn(err);
          return false;
      }
  };

  // Ambil lokasi terkini
    const getUserLocation = async (callback) => {
        const permissionGranted = await requestLocationPermission();
        if (permissionGranted) {
            Geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    console.log('✅ Lokasi diperoleh:', { latitude, longitude });
                    setCurrentLocation({ latitude, longitude });
                    setRegion({
                        latitude,
                        longitude,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    });
                    mapViewRef.current?.animateToRegion({
                        latitude,
                        longitude,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    }, 1000);
                    // Callback untuk pusatkan lokasi
                    if (callback) {
                    console.log("✅ Memanggil callback dengan lokasi terbaru.");
                    callback({ latitude, longitude });
                }
                },
                (error) => {
                    console.error('Error saat mendapatkan lokasi pertama:', error.message);
                    Alert.alert('Error', 'Tidak dapat mengambil lokasi: ' + error.message);
                },
                { enableHighAccuracy: false, timeout: 20000, maximumAge: 1000 }
            );
        } else {
            Alert.alert('Error', 'Izin lokasi diperlukan untuk melanjutkan.');
        }
    };


    const addLokasi = () => {
        setIsLoading(true); // Mulai loading
        Geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                console.log('Menambahkan lokasi baru:', { latitude, longitude });
                setLokasi((prevLokasi) => [
                    ...prevLokasi,
                    { lat: latitude.toString(), lng: longitude.toString() }
                ]);
                setPolygonCoords((prevCoords) => [
                    ...prevCoords,
                    { latitude, longitude }
                ]);
                saveDataToAsyncStorage(); // Simpan data setelah menambah lokasi
                setIsLoading(false); // Selesai loading
            },
            (error) => {
                Alert.alert('Error', 'Tidak dapat mengambil lokasi saat ini: ' + error.message);
                setIsLoading(false); // Selesai loading
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 1000 }
        );
    };

        const saveDataToAsyncStorage = async () => {
            try {
                const dataToSave = {
                    lokasi,
                    polygonCoords, // Simpan polygonCoords juga
                };
                await AsyncStorage.setItem('lokasiData', JSON.stringify(dataToSave));
                console.log("Data disimpan di AsyncStorage:", dataToSave); // Debug: Cek data yang disimpan
            } catch (error) {
                console.error('Error menyimpan data:', error);
            }
        };




        useEffect(() => {
            saveDataToAsyncStorage(); // Simpan data ke AsyncStorage setiap kali lokasi berubah
        }, [lokasi]);

        useEffect(() => {
            const loadData = async () => {
                await loadDataFromAsyncStorage(); // Muat data dari AsyncStorage
                console.log("Lokasi yang dipulihkan setelah pemuatan:", lokasi); // Debug: Cek data yang dimuat
            };
            loadData();
        }, []);

        const loadDataFromAsyncStorage = async () => {
            try {
                const savedData = await AsyncStorage.getItem('lokasiData');
                if (savedData !== null) {
                    const parsedData = JSON.parse(savedData);
                    console.log("Data diambil dari AsyncStorage:", parsedData); // Debug: Cek data yang dimuat
                    setLokasi(parsedData.lokasi || []);
                    setPolygonCoords(parsedData.polygonCoords || []); // Perbarui polygonCoords
                }
            } catch (error) {
                console.error('Error mengambil data dari AsyncStorage:', error);
            }
        };

        const hapusLokasi = () => {
            if (lokasi.length > 1) {
                setLokasi(lokasi.slice(0, -1));
                setPolygonCoords(polygonCoords.slice(0, -1)); // Hapus titik polygon terakhir
            } else {
                Alert.alert('Perhatian', 'Tidak ada lokasi yang dapat dihapus.');
            }
        };

        const updateLokasi = (index, key, value) => {
            const updatedLokasi = [...lokasi];
            updatedLokasi[index][key] = value;
        
            // Update lokasi berdasarkan perubahan, pastikan polygon tetap
            setLokasi(updatedLokasi);
        
            const updatedPolygonCoords = [...polygonCoords];
            updatedPolygonCoords[index] = {
                latitude: parseFloat(updatedLokasi[index].lat),
                longitude: parseFloat(updatedLokasi[index].lng),
            };
        
            setPolygonCoords(updatedPolygonCoords);
        };


    const centerToUserLocation = () => {
        console.log("📍 Mencoba mendapatkan lokasi terkini dan memusatkan map...");
        getUserLocation((newLocation) => {
            console.log('📍 Memusatkan map ke lokasi pengguna terbaru:', newLocation);
            mapViewRef.current?.animateToRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            }, 1000);
        });
    };


        useEffect(() => {
        console.log("Checking and fetching user location...");
        getUserLocation();  // Ambil lokasi saat komponen pertama kali dimuat
        }, []);

        useEffect(() => {
            // Konversi lokasi ke format polygonCoords
            const newPolygonCoords = lokasi.map((loc) => ({
                latitude: parseFloat(loc.lat),
                longitude: parseFloat(loc.lng),
            }));
            setPolygonCoords(newPolygonCoords); // Perbarui polygonCoords
        }, [lokasi]);





    return (
        <View style={{ flex: 1 }}>
            <View style={styles.navTop}>
                <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()}>
                    <FastImage
                        style={styles.backIcon}
                        source={require('../assets/img/chevron-left.png')}
                        resizeMode={FastImage.resizeMode.contain}
                    />
                </TouchableOpacity>
                <View style={styles.top2}>
                    <Text style={styles.headerTitle}>Metode Text</Text>
                </View>
            </View>

            <View style={styles.mapxText}>
                <MapView
                    style={styles.map}
                    key={`${region.latitude}-${region.longitude}`} // Refresh map setiap kali lokasi berubah
                    provider="google"
                    ref={mapViewRef}
                    region={region}
                >
                    {/* Marker untuk lokasi pengguna */}
                    {currentLocation && (
                        <Marker
                            coordinate={currentLocation}
                            title="Lokasi Pengguna"
                            pinColor="blue"
                        />
                    )}
                    {/* Render Marker untuk setiap lokasi */}
                    {lokasi.length > 0 && lokasi.map((loc, index) => (
                        loc.lat && loc.lng && (
                            <Marker
                                key={index}
                                coordinate={{
                                    latitude: parseFloat(loc.lat),
                                    longitude: parseFloat(loc.lng)
                                }}
                                 pinColor="red" 
                                title={`Lokasi ${index + 1}`}
                            />
                        )
                    ))}
                    {polygonCoords.length > 2 && ( // Cek minimal 3 titik untuk menggambar polygon
                        <Polygon
                            coordinates={polygonCoords}
                            strokeColor="#208DC0"
                            fillColor="rgba(32, 141, 192, 0.2)"
                            strokeWidth={2}
                        />
                    )}
                   
                </MapView>
            </View>

            <ScrollView style={styles.body}>
                {lokasi.map((find, index) => (
                    <View style={{ flex: 1, flexDirection: 'row' }} key={find.lat + find.lng}>
                        <View style={{ width: '50%' }}>
                            <Text style={{ color: '#98A9B9', fontWeight: 'bold', fontSize: 12, height: 'auto', width: '80%', marginTop: 20, alignSelf: 'center' }}>Latitude</Text>
                            <TextInput
                                style={styles.inputMetode}
                                value={find.lat}
                                onChangeText={(value) => updateLokasi(index, 'lat', value)}
                            />
                        </View>
                        <View style={{ width: '50%' }}>
                            <Text style={{ color: '#98A9B9', fontWeight: 'bold', fontSize: 12, height: 'auto', width: '80%', marginTop: 20, alignSelf: 'center' }}>Longitude</Text>
                            <TextInput
                                style={styles.inputMetode}
                                value={find.lng}
                                onChangeText={(value) => updateLokasi(index, 'lng', value)}
                            />
                        </View>
                    </View>
                ))}

                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', marginVertical: 20 }}>
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#208DC0" />
                    ) : (
                        <>
                            <TouchableOpacity style={styles.addbatasText} onPress={addLokasi}>
                                <Text style={styles.addbatasxText}>+</Text>
                            </TouchableOpacity>
                            {/* Tombol Pusatkan Lokasi di tengah */}
                            <TouchableOpacity style={styles.addbatasText} onPress={centerToUserLocation}>
                                <Text style={styles.addbatasxText}>📍</Text> {/* Menggunakan simbol lokasi */}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addbatasText} onPress={hapusLokasi}>
                                <Text style={styles.addbatasxText}>-</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <TouchableOpacity onPress={sendBackLokasi} style={styles.addbatas}>
                    <Text style={styles.addbatasx}>Kirim Lokasi</Text>
                </TouchableOpacity>

            </ScrollView>

            <TabBar />
        </View>
    );
};

export default MetodeText;
