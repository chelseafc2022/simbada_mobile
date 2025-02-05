//import liraries
import React, { useEffect, useState, useCallback } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView ,StyleSheet, ActivityIndicator, Alert } from 'react-native';
import FastImage from "react-native-fast-image";
import MapView, { Polygon } from 'react-native-maps';
import TabBar from '../components/TabBar'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native';

// create a component
const Zona = ({navigation, route}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }

      const {
        id_usulan, nik, nama, alamat, id_kecamatan, nama_kecamatan,
        id_des_kel, nama_des_kel, rwrt, no_telp, catatan, lokasi, file, status_pengajuan
    } = route.params; 
    const store = useSelector(state => state);
    const [isLoading, setIsLoading] = useState(true);
    const [petaPengajuan, setPetaPengajuan] = useState([]);
    const [petaDasar, setPetaDasar] = useState([]);
    const [mapRegion, setMapRegion] = useState(null);
    const [isPolygonReady, setIsPolygonReady] = useState(false);

    const getPetaPengajuan = async () => {
        try {
            setIsLoading(true);
            setIsPolygonReady(false);
            // console.log("📌 Mengambil data Peta Pengajuan...");
        
            const response = await fetch(`${store.URL.URL_APP}api/v1/monitoring/viewnative`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "kikensbatara " + store.TOKEN,
                },
                body: JSON.stringify({ id_kecamatan, id_des_kel, data_ke: 1 })
            });
    
            const data = await response.json();
            // console.log("📥 Response API Peta Pengajuan:", JSON.stringify(data, null, 2));
    
            if (data.length > 0 && data[0].data1.length > 0) {
                const processedData = data[0].data1.map(polygon => ({
                    coordinates: polygon.lokasi.map(coord => ({
                        latitude: parseFloat(coord.lat), 
                        longitude: parseFloat(coord.lng)
                    }))
                }));
    
                setPetaPengajuan(processedData);
                // console.log("📌 Data Peta Pengajuan setelah diproses:", JSON.stringify(processedData, null, 2));

                if (processedData.length > 0 && processedData[0].coordinates.length > 0) {
                    const center = processedData[0].coordinates[0];
                    setMapRegion({
                        latitude: center.latitude,
                        longitude: center.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02
                    });
                    setIsPolygonReady(true); // ✅ Sekarang polygon siap untuk digambar
                }
            } else {
                console.warn("⚠️ Tidak ada data untuk Peta Pengajuan.");
                setPetaPengajuan([]);
                setIsPolygonReady(true);
            }
        } catch (error) {
            console.error("❌ Error Fetching Peta Pengajuan:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // const getPetaPengajuan = async () => {
    //     try {
    //         setIsLoading(true);
    //         console.log("📌 Mengambil data Peta Pengajuan...");

    //         const response = await fetch(`${store.URL.URL_APP}api/v1/monitoring/viewnative`, {
    //             method: "POST",
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 Authorization: "kikensbatara " + store.TOKEN
    //             },
    //             body: JSON.stringify({ des_kel_id: id_des_kel })
    //         });

    //         const result = await response.json();
    //         console.log("📥 Response API Peta Pengajuan:", JSON.stringify(result, null, 2));

    //         if (!result || result.length === 0 || !result[0].data1) {
    //             console.warn("⚠️ Data Peta Pengajuan tidak ditemukan.");
    //             setPetaPengajuan([]);
    //             return;
    //         }

    //         const processedData = result[0].data1.map(item => {
    //             if (!item.geometry || !item.geometry.coordinates) {
    //                 console.error("❌ Kesalahan Struktur Data! `geometry.coordinates` tidak ditemukan:", item);
    //                 return { coordinates: [] }; // Kembalikan array kosong agar tidak error
    //             }

    //             return {
    //                 coordinates: item.geometry.coordinates[0].map(coord => ({
    //                     latitude: coord[1], // Format latitude-latitude
    //                     longitude: coord[0]
    //                 }))
    //             };
    //         });

    //         setPetaPengajuan(processedData);

    //         // ✅ Update peta agar fokus ke desa
    //         if (processedData.length > 0 && processedData[0].coordinates.length > 0) {
    //             const center = processedData[0].coordinates[0];
    //             setMapRegion({
    //                 latitude: center.latitude,
    //                 longitude: center.longitude,
    //                 latitudeDelta: 0.05,
    //                 longitudeDelta: 0.05
    //             });
    //         }

    //     } catch (error) {
    //         console.error("❌ Error Fetching Peta Pengajuan:", error);
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };
    
    

    const getPetaDasar = async () => {
        try {
            setIsLoading(true);
            console.log("📌 Mengambil data Peta Dasar untuk desa:", id_des_kel);
    
            const response = await fetch(`${store.URL.URL_APP}api/v1/monitoring/petadasar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "kikensbatara " + store.TOKEN
                },
                body: JSON.stringify({ des_kel_id: id_des_kel })
            });
    
            const result = await response.json();
            // console.log("📥 Response API Peta Dasar:", JSON.stringify(result, null, 2));
    
            if (!result || result.length === 0) {
                // console.warn("⚠️ Data Peta Dasar tidak ditemukan.");
                setPetaDasar([]);
                return;
            }
    
            // 🔹 Ambil `geometry.coordinates` dari dalam `data1`
        const processedData = result[0].data1.map(item => {
            if (!item.geometry || !item.geometry.coordinates) {
                // console.error("❌ Kesalahan Struktur Data! `geometry.coordinates` tidak ditemukan:", item);
                return { coordinates: [] }; // Kembalikan array kosong agar tidak error
            }

            return {
                coordinates: item.geometry.coordinates[0].map(coord => ({
                    latitude: coord[1], // Pastikan urutan lat-lng benar
                    longitude: coord[0]
                }))
            };
        });

        setPetaDasar(processedData);
    
            // ✅ Update peta agar fokus ke desa
            if (processedData.length > 0 && processedData[0].coordinates.length > 0) {
                const center = processedData[0].coordinates[0];
                setMapRegion({
                    latitude: center.latitude,
                    longitude: center.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05
                });
            }
    
        } catch (error) {
            console.error("❌ Error Fetching Peta Dasar:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    

    // useEffect(() => {
    //     const unsubscribe = navigation.addListener('focus', () => {
    //         getPetaPengajuan();
    //     });

    //     return unsubscribe;
    // }, [navigation]);
    useFocusEffect(
        useCallback(() => {
            // console.log("🔄 Halaman difokuskan ulang. Memanggil ulang API...");
            getPetaPengajuan();
            getPetaDasar();
        }, [id_des_kel]) // Tambahkan dependency agar selalu update
    );
   
    useEffect(() => {
        return () => {
            // console.log("♻️ Halaman Zona di-unmount. Reset state polygon.");
            setPetaPengajuan([]);
            setPetaDasar([]);
        };
    }, []);

    useEffect(() => {
        // console.log("📌 Peta Pengajuan saat ini:", JSON.stringify(petaPengajuan, null, 2));
    }, [petaPengajuan]);
    
    useEffect(() => {
        // console.log("📌 Peta Dasar saat ini:", JSON.stringify(petaDasar, null, 2));
    }, [petaDasar]);

    useEffect(() => {
        if (petaPengajuan.length > 0) {
            const center = petaPengajuan[0].coordinates[0];
            // console.log("📌 Memperbarui `mapRegion` setelah mendapatkan data polygon:", center);
    
            setMapRegion({
                latitude: center.latitude,
                longitude: center.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05
            });
        }
    }, [petaPengajuan]);
    
    useEffect(() => {
        if (petaDasar.length > 0) {
            const center = petaDasar[0].coordinates[0];
            // console.log("📌 Memperbarui `mapRegion` setelah mendapatkan data peta dasar:", center);
    
            setMapRegion({
                latitude: center.latitude,
                longitude: center.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05
            });
        }
    }, [petaDasar]);

    
    


//     useEffect(() => {
//     console.log("🎯 Polygon yang akan digambar:", JSON.stringify(petaPengajuan, null, 2));
// }, [petaPengajuan]); // Jalankan setiap kali petaPengajuan berubah



    return (

        <View style={{flex:1}}>
            <View style={styles.navTop}>
                    <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()} >
                        <FastImage 
                            style={styles.backIcon}
                            source={require('../assets/img/chevron-left.png')}
                            resizeMode={FastImage.resizeMode.contain}
                        />
                    </TouchableOpacity>
                    
                    <View style={styles.top2}>
                        <Text style={styles.headerTitle}>
                        Lihat Zona Batas Desa 
                        </Text>
                    </View>

                    <View style={styles.top3}>
                        <Text>
                            
                        </Text>
                    </View>

                </View>
            
            <ScrollView>
            <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    width: '90%',
                    alignSelf: 'center',
                    marginTop: 20,
                    alignItems: 'center'
                }}>
                    <Text style={{
                        color: '#208DC0',
                        fontWeight: 'bold',
                        fontSize: 12,
                    }}>Zona Batas Tanah</Text>

                    {/* Tombol Edit Data hanya muncul jika status_pengajuan == 2 */}
                    {status_pengajuan === '2' && (
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#208DC0',
                                padding: 5,
                                borderRadius: 5,
                            }}
                            
                            onPress={() => navigation.navigate('EditUsulan', {
                                id_usulan, nik, nama, alamat, id_kecamatan,
                                nama_kecamatan, id_des_kel, nama_des_kel,
                                rwrt, no_telp, catatan, lokasi, file,
                            })}
                        >
                            <Text style={{
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: 12
                            }}>
                                Edit Data
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
              <Text style={{
                color: '#98A9B9', 
                fontWeight:'bold', 
                fontSize:12, 
                height: 'auto', 
                width:'90%', 
                marginTop:10, 
                alignSelf:'center'}}>

                Kecamatan {nama_kecamatan} - Desa {nama_des_kel} 
            </Text>

                <View style={{flex:1, flexDirection:"row"}}>

                <Text style={{
                color: 'rgb(9, 9, 255)', 
                fontWeight:'bold', 
                fontSize:16, 
                height: 'auto', 
                width:'40%', 
                marginTop:20,
                marginLeft:20, 
                alignSelf:'center'}}>

                PETA PENGAJUAN
            </Text>
            <Text style={{
                color: '#208DC0', 
                fontWeight:'bold', 
                fontSize:16, 
                height: 'auto', 
                width:'10%', 
                marginTop:20,
                marginLeft:20}}>

          -
            </Text>
            <Text style={{
                color: "rgba(255,0,0,0.5)", 
                fontWeight:'bold', 
                fontSize:16, 
                height: 'auto', 
                width:'40%', 
                marginTop:20, 
                alignSelf:'center'}}>

          PETA DASAR
            </Text>
                </View>
            
            


            

            <View style={styles.mapx}>
           
{(petaPengajuan.length > 0 || petaDasar.length > 0) ? (
    <MapView style={{ flex: 1 }} region={mapRegion}>
        {petaPengajuan.length > 0 &&
            petaPengajuan.map((polygon, index) => (
                <Polygon
                    key={`pengajuan-${index}`}
                    coordinates={polygon.coordinates}
                    strokeColor="blue"
                    fillColor="rgba(0,0,255,0.5)"
                />
            ))}
        
        {petaDasar.length > 0 &&
            petaDasar.map((polygon, index) => (
                <Polygon
                    key={`dasar-${index}`}
                    coordinates={polygon.coordinates}
                    strokeColor="red"
                    fillColor="rgba(255,0,0,0.5)"
                />
            ))}
    </MapView>
) : (
    <Text style={{ textAlign: "center", marginTop: 20, color: "gray" }}>
        🔄 Memuat Peta...
    </Text>
)}

            </View>

           </ScrollView>



           <TabBar/>
            
           
        </View>



    );
};

//make this component available to the app
export default Zona;
