import React, { useRef, useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet, Image, FlatList } from 'react-native';
import FastImage from "react-native-fast-image";
import TabBar from '../components/TabBar'
import Geolocation from '@react-native-community/geolocation'; 
import { PermissionsAndroid } from 'react-native';
import MapView, { Marker, Polygon, Circle, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Komponen Kartu yang dioptimasi agar tidak re-render massal
const CoordinateCard = React.memo(({ find, index, updateLokasi, localStyles }) => {
    return (
        <View style={localStyles.card}>
            <View style={localStyles.cardHeader}>
                <Text style={localStyles.cardTitle}>📌 Titik {index + 1}</Text>
                {find.photo_uri && (
                    <Text style={{fontSize: 11, color: '#4CAF50'}}>📸</Text>
                )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: '48%' }}>
                    <Text style={localStyles.label}>Lat</Text>
                    <TextInput
                        style={localStyles.input}
                        value={find.lat}
                        onChangeText={(value) => updateLokasi(index, 'lat', value)}
                        keyboardType="numeric"
                    />
                </View>
                <View style={{ width: '48%' }}>
                    <Text style={localStyles.label}>Lng</Text>
                    <TextInput
                        style={localStyles.input}
                        value={find.lng}
                        onChangeText={(value) => updateLokasi(index, 'lng', value)}
                        keyboardType="numeric"
                    />
                </View>
            </View>
        </View>
    );
});

// create a component
const MetodeText = ({navigation, route}) => {
    const Route = (routex, data) => {
        navigation.navigate(routex, data)
    }

    const { lokasiAwal, onLokasiUpdate } = route.params; // Tangkap lokasi awal dan fungsi callback
    const [lokasi, setLokasi] = useState(lokasiAwal || []); // State untuk lokasi
    const [isLoading, setIsLoading] = useState(false);
    const [polygonCoords, setPolygonCoords] = useState([]); 
    const [isMapReady, setIsMapReady] = useState(false); // Fix marker rendering
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
            // console.log("Mengirim lokasi kembali:", lokasi); // Debug: Cek data yang dikirim
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
              // console.log("You can access the location");
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
            const getPos = (highAcc) => {
                Geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        // console.log(`✅ Lokasi diperoleh (High Accuracy: ${highAcc}):`, { latitude, longitude });
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
                        if (callback) {
                            // console.log("✅ Memanggil callback dengan lokasi terbaru.");
                            callback({ latitude, longitude });
                        }
                    },
                    (error) => {
                        console.warn(`Error GPS (High Acc: ${highAcc}):`, error.message);
                        if (highAcc) {
                            // console.log("Mencoba ulang dengan akurasi rendah...");
                            getPos(false); // Coba lagi dengan akurasi rendah (menggunakan jaringan)
                        } else {
                            Alert.alert('Perhatian', 'Gagal mendapatkan lokasi. Pastikan GPS aktif dan Anda berada di area terbuka tanpa halangan (langit terlihat). Di mode offline, GPS murni butuh waktu lebih lama untuk mengunci.');
                        }
                    },
                    { enableHighAccuracy: highAcc, timeout: highAcc ? 30000 : 15000, maximumAge: 10000 }
                );
            };
            getPos(true);
        } else {
            Alert.alert('Error', 'Izin lokasi diperlukan untuk melanjutkan.');
        }
    };


    const addLokasi = () => {
        setIsLoading(true); // Mulai loading
        const getPos = (highAcc) => {
            Geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    // console.log(`Menambahkan lokasi baru (High Acc: ${highAcc}):`, { latitude, longitude });
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
                    if (highAcc) {
                        // console.log("Timeout saat menambah lokasi, mencoba dengan akurasi rendah...");
                        getPos(false); // Fallback ke akurasi rendah
                    } else {
                        Alert.alert('Perhatian', 'Gagal mengambil koordinat. Pastikan GPS aktif.');
                        setIsLoading(false); 
                    }
                },
                { enableHighAccuracy: highAcc, timeout: 15000, maximumAge: 10000 }
            );
        };
        getPos(true);
    };

    const addLokasiDenganFoto = () => {
        navigation.navigate('GeoTagCamera', {
            onPhotoTaken: (photoData) => {
                // console.log('Photo taken for polygon:', photoData);
                const { latitude, longitude } = photoData.metadata;
                
                // Add the new point with the photo data
                setLokasi((prevLokasi) => [
                    ...prevLokasi,
                    { 
                        lat: latitude.toString(), 
                        lng: longitude.toString(), 
                        photo_uri: photoData.uri 
                    }
                ]);
                setPolygonCoords((prevCoords) => [
                    ...prevCoords,
                    { latitude, longitude }
                ]);
            }
        });
    };

        const saveDataToAsyncStorage = async () => {
            try {
                const dataToSave = {
                    lokasi,
                    polygonCoords, // Simpan polygonCoords juga
                };
                await AsyncStorage.setItem('lokasiData', JSON.stringify(dataToSave));
                // console.log("Data disimpan di AsyncStorage:", dataToSave); // Debug: Cek data yang disimpan
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
                // console.log("Lokasi yang dipulihkan setelah pemuatan:", lokasi); // Debug: Cek data yang dimuat
            };
            loadData();
        }, []);

        const loadDataFromAsyncStorage = async () => {
            try {
                const savedData = await AsyncStorage.getItem('lokasiData');
                if (savedData !== null) {
                    const parsedData = JSON.parse(savedData);
                    // console.log("Data diambil dari AsyncStorage:", parsedData); // Debug: Cek data yang dimuat
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
            if (typeof key === 'object') {
                updatedLokasi[index] = { ...updatedLokasi[index], ...key };
            } else {
                updatedLokasi[index][key] = value;
            }
        
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
        // console.log("📍 Mencoba mendapatkan lokasi terkini dan memusatkan map...");
        getUserLocation((newLocation) => {
            // console.log('📍 Memusatkan map ke lokasi pengguna terbaru:', newLocation);
            mapViewRef.current?.animateToRegion({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            }, 1000);
        });
    };


        useEffect(() => {
        // console.log("Checking and fetching user location...");
        getUserLocation((newLocation) => {
            // Jika belum ada titik sama sekali, otomatis tambahkan Titik 1
            if (!lokasiAwal || lokasiAwal.length === 0) {
                // console.log("🆕 Otomatis menambahkan Titik 1:", newLocation);
                setLokasi([{
                    lat: newLocation.latitude.toString(),
                    lng: newLocation.longitude.toString(),
                }]);
            }
        });
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

            <View style={{ height: 300, width: '100%', overflow: 'hidden' }}>
                <MapView
                    style={{ flex: 1 }}
                    provider="google"
                    ref={mapViewRef}
                    initialRegion={region}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                >
                    {/* Polyline untuk menggambar jalur titik-titik secara ringan */}
                    {polygonCoords.length > 1 && (
                        <Polyline
                            coordinates={polygonCoords}
                            strokeColor="#FF5722"
                            strokeWidth={3}
                            lineDashPattern={[5, 5]}
                        />
                    )}

                    {/* Render titik-titik koordinat dengan Pin Bawaan (Native Red Pin) */}
                    {lokasi.map((loc, index) => {
                        // Optimasi Performa: Jika titik > 50, HANYA render Pin Awal dan Pin Terakhir untuk menghindari lag
                        if (lokasi.length > 50 && index !== 0 && index !== lokasi.length - 1) {
                            return null;
                        }

                        const lat = parseFloat(loc.lat);
                        const lng = parseFloat(loc.lng);
                        if (isNaN(lat) || isNaN(lng)) return null;
                        const coord = { latitude: lat, longitude: lng };
                        return (
                            <Marker
                                key={`point-${index}`}
                                coordinate={coord}
                                title={`Titik ${index + 1}`}
                                description={`${lat.toFixed(6)}, ${lng.toFixed(6)}`}
                                draggable={true}
                                onDragEnd={(e) => {
                                    const newLat = e.nativeEvent.coordinate.latitude.toString();
                                    const newLng = e.nativeEvent.coordinate.longitude.toString();
                                    updateLokasi(index, { lat: newLat, lng: newLng });
                                }}
                            />
                        );
                    })}

                    {/* Polygon: minimal 3 titik */}
                    {polygonCoords.length > 2 && (
                        <Polygon
                            coordinates={polygonCoords}
                            strokeColor="#208DC0"
                            fillColor="rgba(32, 141, 192, 0.2)"
                            strokeWidth={2}
                        />
                    )}
                </MapView>
            </View>

            <View style={[styles.body, { backgroundColor: '#f5f7fa', flex: 1 }]}>
                <FlatList
                    data={lokasi}
                    keyExtractor={(item, index) => `card-${index}`}
                    initialNumToRender={5}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    ListHeaderComponent={() => (
                        <View style={localStyles.actionRow}>
                            <TouchableOpacity style={[localStyles.actionBtn, { backgroundColor: '#FF9800' }]} onPress={addLokasiDenganFoto}>
                                <Text style={localStyles.actionBtnText}>📷</Text>
                                <Text style={localStyles.actionBtnLabel}>Foto</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[localStyles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={addLokasi}>
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={localStyles.actionBtnText}>+</Text>
                                )}
                                <Text style={localStyles.actionBtnLabel}>Titik</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[localStyles.actionBtn, { backgroundColor: '#208DC0' }]} onPress={centerToUserLocation}>
                                <Text style={localStyles.actionBtnText}>📍</Text>
                                <Text style={localStyles.actionBtnLabel}>Lokasi</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[localStyles.actionBtn, { backgroundColor: '#F44336' }]} onPress={hapusLokasi}>
                                <Text style={localStyles.actionBtnText}>−</Text>
                                <Text style={localStyles.actionBtnLabel}>Hapus</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    renderItem={({ item, index }) => (
                        <CoordinateCard 
                            find={item} 
                            index={index} 
                            updateLokasi={updateLokasi} 
                            localStyles={localStyles} 
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            </View>

            {/* Sticky Bottom Footer untuk Tombol Simpan */}
            <View style={{ padding: 15, backgroundColor: '#ffffff', borderTopWidth: 1, borderColor: '#e0e0e0', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 3 }}>
                <TouchableOpacity onPress={sendBackLokasi} style={[localStyles.submitBtn, { marginTop: 0, marginHorizontal: 0 }]}>
                    <Text style={localStyles.submitBtnText}>💾 Simpan & Kirim Lokasi</Text>
                </TouchableOpacity>
            </View>

            <TabBar />
        </View>
    );
};

const localStyles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        padding: 8,
        marginHorizontal: 10,
        marginTop: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#208DC0',
    },
    label: {
        fontSize: 9,
        color: '#888',
        marginBottom: 2,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 4,
        color: '#334155',
        fontSize: 10,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
        paddingHorizontal: 10,
    },
    actionBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
        marginHorizontal: 8,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    actionBtnLabel: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
        marginTop: 1,
    },
    submitBtn: {
        backgroundColor: '#208DC0',
        marginHorizontal: 15,
        borderRadius: 25,
        paddingVertical: 12,
        alignItems: 'center',
        shadowColor: '#208DC0',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 4,
        marginTop: 5,
    },
    submitBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 0.3,
    }
});

export default MetodeText;
