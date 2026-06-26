//import liraries
import React, { Component, useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, ImageBackground, StyleSheet as RNStyleSheet } from 'react-native';
import FastImage from "react-native-fast-image";
import TabBar from '../components/TabBar'
// import PdfWebViewModal from './PdfWebViewModal';

import moment from "moment";
import { useSelector } from 'react-redux'
import { useIsFocused } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';

const usulanStyles = RNStyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 15,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPending: { },
  cardRejected: { backgroundColor: '#FEF2F2' },
  cardApproved: { backgroundColor: '#F0FDF4' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusRejected: { backgroundColor: '#FEE2E2' },
  statusApproved: { backgroundColor: '#D1FAE5' },
  statusTextPending: { color: '#D97706', fontSize: 10, fontWeight: 'bold' },
  statusTextRejected: { color: '#DC2626', fontSize: 10, fontWeight: 'bold' },
  statusTextApproved: { color: '#059669', fontSize: 10, fontWeight: 'bold' },
  cardDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    backgroundColor: '#2563EB',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    marginTop: -2,
    fontWeight: 'bold',
  }
});

// create a component
const Usulan = ({navigation, route}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }
    const isFocused = useIsFocused();

    const TOKEN = useSelector(state => state.TOKEN);
      const PROFILE = useSelector(state => state.PROFILE);
      const URL = useSelector(state => state.URL);
    const [isLoading, setIsLoading] = useState(true);
    const [DATA_USULAN, SET_USULAN] = useState([]);
    
    const [isModalVisible, setModalVisible] = useState(false);
    // const [pdfUrl, setPdfUrl] = useState('');

    // const openPdf = (file) => {
    //     const url = "https://server-simbada.konaweselatankab.go.id/uploads/" + file;
    //     setPdfUrl(url);
    //     setModalVisible(true);
    // };

    const getView = async () => {
        try {
            const userStatus = PROFILE?.profile?.status;
            const idDesaUser = PROFILE?.profile?.id_desa;
            const idKecamatanUser = PROFILE?.profile?.id_kecamatan;

            const cacheKey = `@usulan_cache_${PROFILE.id}`;

            // Cek Cache Lokal Dulu (Stale-while-revalidate style)
            if (DATA_USULAN.length === 0) {
                try {
                    const cachedStr = await AsyncStorage.getItem(cacheKey);
                    if (cachedStr) {
                        SET_USULAN(JSON.parse(cachedStr));
                        setIsLoading(false); // Matikan loading karena data lokal sudah ada
                    } else {
                        setIsLoading(true); // Loading cuma jika belum ada cache sama sekali
                    }
                } catch (e) {
                    setIsLoading(true);
                }
            }

            const requestBody = {
                data_ke: 1,
                cari_value: "",
                id: PROFILE.id,
                status: userStatus,
                ...(userStatus === "2" && { id_des_kel: idDesaUser }),
                ...(userStatus === "3" && { id_kecamatan: idKecamatanUser }), // Filter desa jika status user 2
            };
    
            const response = await fetch(URL.URL_ADD_ZONA + "viewUsulanNative", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "kikensbatara " + TOKEN,
                },
                body: JSON.stringify(requestBody),
            });
    
            const result = await response.json();
    
            if (response.ok) {
                const freshData = result[0].data1;
                SET_USULAN(freshData); // Update state dengan data segar
                await AsyncStorage.setItem(cacheKey, JSON.stringify(freshData)); // Simpan ke cache
            } else {
                console.error("Error fetching data:", result);
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setIsLoading(false);
        }
    };


      const dataparams = route.params;

      useEffect(
              ()=>{
                //   console.log(dataparams);
                  getView()
              }
           , [isFocused]);



    return (
        <View style={usulanStyles.container}>
            <TouchableOpacity
                onPress={() => navigation.navigate('AddUsulan')}
                style={usulanStyles.fab}
            >
                <Text style={usulanStyles.fabText}>+</Text>
            </TouchableOpacity>

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
                        Pengajuan Batas Desa
                        </Text>
                    </View>

                    <View style={styles.top3}>
                        <Text>
                            
                        </Text>
                    </View>

                </View>

                <View  style={styles.body}>

                
                <ImageBackground
                    source={require('../assets/img/bgbg.jpg')}
                    style={styles.background}
                    resizeMode="cover"
                >
                {isLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={usulanStyles.listContainer}>
                        {DATA_USULAN.map((item, index) => {
                            // Menentukan style berdasarkan status
                            let cardStyle = usulanStyles.cardPending;
                            let badgeStyle = usulanStyles.statusPending;
                            let textStyle = usulanStyles.statusTextPending;
                            let icon = '⏳ Menunggu';

                            if (item.status_pengajuan === '2') {
                                cardStyle = usulanStyles.cardRejected;
                                badgeStyle = usulanStyles.statusRejected;
                                textStyle = usulanStyles.statusTextRejected;
                                icon = '🚫 Ditolak';
                            } else if (item.status_pengajuan === '3') {
                                cardStyle = usulanStyles.cardApproved;
                                badgeStyle = usulanStyles.statusApproved;
                                textStyle = usulanStyles.statusTextApproved;
                                icon = '✅ Disetujui';
                            }

                            return (
                                <TouchableOpacity
                                    key={item.id || index}
                                    style={[usulanStyles.card, cardStyle]}
                                    onPress={() => navigation.navigate('Zona', {
                                        id_usulan: item.id,
                                        nik: item.nik,
                                        nama: item.nama,
                                        alamat: item.alamat,
                                        id_kecamatan: item.kecamatan_id,
                                        nama_kecamatan: item.nama_kecamatan,
                                        id_des_kel: item.des_kel_id,
                                        nama_des_kel: item.nama_des_kel,
                                        rwrt: item.rwrt,
                                        no_telp: item.no_telp,
                                        catatan: item.catatan,
                                        lokasi: item.lokasi,
                                        file: item.file,
                                        status_pengajuan: item.status_pengajuan,
                                    })}
                                >
                                    <View style={usulanStyles.cardHeader}>
                                        <Text style={usulanStyles.cardTitle} numberOfLines={1}>{item.nama}</Text>
                                        <View style={[usulanStyles.statusBadge, badgeStyle]}>
                                            <Text style={textStyle}>{icon}</Text>
                                        </View>
                                    </View>
                                    
                                    <Text style={usulanStyles.cardDesc} numberOfLines={2}>{item.alamat}</Text>
                                    
                                    <View style={usulanStyles.cardFooter}>
                                        <Text style={usulanStyles.dateText}>
                                            ⏰ {moment(item.createAt).format("DD MMMM YYYY")}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        {DATA_USULAN.length === 0 && (
                            <View style={{ alignItems: 'center', marginTop: 50 }}>
                                <Text style={{ color: '#94A3B8', fontSize: 16 }}>Belum ada pengajuan usulan.</Text>
                            </View>
                        )}
                    </ScrollView>
                )}
           </ImageBackground>

           </View>

            <TabBar/>
        </View>
    );
};



//make this component available to the app
export default Usulan;
