//import liraries
import React, { Component,useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, ImageBackground, TextInput } from 'react-native';
import FastImage from "react-native-fast-image";
import { useSelector } from 'react-redux'
import { useIsFocused } from "@react-navigation/native";
import PdfWebViewModal from '../usulan_peta/PdfWebViewModal';

import TabBar from '../components/TabBar'
import { Assets } from '@react-navigation/elements';
import moment from "moment";

// create a component
const Monitoring = ({navigation}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }

      const isFocused = useIsFocused();
      const store = useSelector(state => state)
      const [isLoading, setIsLoading] = useState(true);
      const [LOADING, SET_LOADING] = useState('false')
      const [DATA_MONITORING, SET_MONITORING] = useState([]);
      const [userStatus, setUserStatus] = useState(store.PROFILE.profile?.status || "1"); // Ambil status user
      const [isModalVisible, setModalVisible] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');
      const [filteredData, setFilteredData] = useState([]);
      const [page, setPage] = useState(1);
          const [pdfUrl, setPdfUrl] = useState('');
      
          const openPdf = (file) => {
              const url = "https://server-simbada.konaweselatankab.go.id/uploads/" + file;
              setPdfUrl(url);
              setModalVisible(true);
          };


     

          const getView = async () => {
            try {
                setIsLoading(true);
        
                const idKecamatanUser = store.PROFILE.profile?.id_kecamatan;
        
                const requestBody = {
                    data_ke: page,
                    cari_value: "",
                    id: store.PROFILE.id,
                    status: userStatus,
                    ...(userStatus === "3" && { id_kecamatan: idKecamatanUser }), // Hanya tambahkan jika status user 3
                };
        
                // console.log('Request Body:', requestBody); // Debug log untuk memastikan parameter benar
        
                const response = await fetch(store.URL.URL_LIST_MONITORING + "viewmonitornative", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "kikensbatara " + store.TOKEN,
                    },
                    body: JSON.stringify(requestBody),
                });
        
                const result = await response.json();
                // console.log('API Response:', result); // Debug hasil response
        
                if (response.ok) {
                    SET_MONITORING(prevData => [...prevData, ...(result[0]?.data1 || [])]);
                    setFilteredData(prevData => [...prevData, ...(result[0]?.data1 || [])]);
                } else {
                    console.error("Error fetching data:", result);
                }
            } catch (error) {
                console.error("Fetch Error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        

      useEffect(() => {
        if (userStatus !== "2") {
            getView(); // Jika status user bukan 2, fetch data monitoring
        }
    }, [isFocused]);

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query === '') {
            setFilteredData(DATA_MONITORING);
        } else {
            const filtered = DATA_MONITORING.filter(item =>
                item.nama_des_kel.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredData(filtered);
        }
    };



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
                        Monitoring
                        </Text>
                    </View>

                    <View style={styles.top3}>
                        <Text>
                            
                        </Text>
                    </View>

                </View>

                
                <View style={styles.body}>
                    <ImageBackground
                        source={require('../assets/img/bgbg.jpg')}
                        style={styles.background}
                        resizeMode="cover"
                    >

                        {userStatus === "2" ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <FastImage
                                    style={{ width: 100, height: 100, marginBottom: 20 }}
                                    source={require('../assets/img/error.png')}
                                    resizeMode={FastImage.resizeMode.contain}
                                />
                                <Text style={{ color: '#721c24', fontWeight: 'bold', fontSize: 22, textAlign: 'center', paddingHorizontal: 20 }}>
                                    ⚠️ Akses Ditolak
                                </Text>
                                <Text style={{ color: '#721c24', fontSize: 16, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }}>
                                    Halaman Monitoring ini tidak bisa diakses oleh Operator Desa.
                                </Text>
                            </View>
                        ) : isLoading ? (
                            <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#208DC0" />
                        ) : (
                            <ScrollView>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Cari berdasarkan nama desa"
                                    placeholderTextColor="#aaa"
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                />
                                {filteredData.map((item, index) => (
                                    <TouchableOpacity key={`item-${index}`}
                                        style={[
                                            styles.batas,
                                            item.status_pengajuan === '2' && { backgroundColor: '#FFCDD2' },
                                            item.status_pengajuan === '3' && { backgroundColor: '#BAD8B6' }
                                        ]}
                                        onPress={() => navigation.navigate('Zona', {
                                            nama_kecamatan: item.nama_kecamatan,
                                            nama_des_kel: item.nama_des_kel,
                                            id_kecamatan: item.kecamatan_id,
                                            id_des_kel: item.des_kel_id,
                                        })}
                                    >
                                        <View style={styles.batasx}>
                                            <Text style={{ flexDirection: 'row', fontSize: 26, marginLeft: 10, fontWeight: 'bold', color: '#208DC0' }}>
                                                {item.nama_des_kel}
                                                {item.status_pengajuan === '1' && <Text> ⌛️</Text>}
                                                {item.status_pengajuan === '2' && <Text> 🚫</Text>}
                                                {item.status_pengajuan === '3' && <Text> ✅</Text>}
                                            </Text>
                                            <Text style={{ fontSize: 12, marginLeft: 10, color: '#080808' }}>
                                                {item.nama_kecamatan}
                                            </Text>
                                            <Text style={{ fontSize: 8, marginLeft: 10, fontWeight: '600', color: '#737373' }}>
                                                ⏰ {moment(item.createAt).format("DD MMMM YYYY")}
                                            </Text>
                                        </View>
                                        <View style={styles.batasy}>
                                            <TouchableOpacity
                                                style={[styles.button, { marginRight: 10 }]}
                                                onPress={() => openPdf(item.file)}
                                            >
                                                <FastImage
                                                    style={{ width: 60, height: 60, alignSelf: 'center' }}
                                                    source={require('../assets/img/lampiran-icon.png')}
                                                    resizeMode={FastImage.resizeMode.contain}
                                                />
                                            </TouchableOpacity>
                                            <PdfWebViewModal
                                                isVisible={isModalVisible}
                                                onClose={() => setModalVisible(false)}
                                                pdfUrl={pdfUrl}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    
                                ))}
                                
                            </ScrollView>
                        )}
                    </ImageBackground>
                </View>


            
           <TabBar/>
        
        </View>

    );
};



//make this component available to the app
export default Monitoring;
