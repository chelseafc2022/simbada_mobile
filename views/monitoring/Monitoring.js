//import liraries
import React, { Component,useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, ImageBackground, TextInput } from 'react-native';
import FastImage from "react-native-fast-image";
import { useSelector } from 'react-redux'
import { useIsFocused } from "@react-navigation/native";
// import PdfWebViewModal from '../usulan_peta/PdfWebViewModal';

import TabBar from '../components/TabBar'
import { Assets } from '@react-navigation/elements';
import moment from "moment";

// create a component
const Monitoring = ({navigation}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }

      const isFocused = useIsFocused();
      const token = useSelector(state => state.TOKEN);
      const profile = useSelector(state => state.PROFILE);
      const url = useSelector(state => state.URL);

      const [isLoading, setIsLoading] = useState(true);
      const [LOADING, SET_LOADING] = useState('false')
      const [DATA_MONITORING, SET_MONITORING] = useState([]);
      const [userStatus, setUserStatus] = useState(profile?.profile?.status || "1"); // Ambil status user
      const [isModalVisible, setModalVisible] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');
      const [filteredData, setFilteredData] = useState([]);
      const [page, setPage] = useState(1);
        //   const [pdfUrl, setPdfUrl] = useState('');
      
        //   const openPdf = (file) => {
        //       const url = "https://server-simbada.konaweselatankab.go.id/uploads/" + file;
        //       setPdfUrl(url);
        //       setModalVisible(true);
        //   };


     

          const getView = async () => {
            try {
                setIsLoading(true);
        
                const idKecamatanUser = profile.profile?.id_kecamatan;
        
                const requestBody = {
                    data_ke: page,
                    cari_value: "",
                    id: profile.id,
                    status: userStatus,
                    ...(userStatus === "3" && { id_kecamatan: idKecamatanUser }), // Hanya tambahkan jika status user 3
                };
        
                // console.log('Request Body:', requestBody); // Debug log untuk memastikan parameter benar
        
                const response = await fetch(url.URL_LIST_MONITORING + "viewmonitornative", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `kikensbatara ${token}`
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

        <View style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
  {/* Header Navigation */}
  <View style={styles.navTop}>
    <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()}>
      <FastImage
        style={styles.backIcon}
        source={require('../assets/img/chevron-left.png')}
        resizeMode={FastImage.resizeMode.contain}
      />
    </TouchableOpacity>

    <View style={styles.top2}>
      <Text style={styles.headerTitle}>Monitoring</Text>
    </View>

    <View style={styles.top3}>
      <Text>{/* Kosongkan jika tidak ada aksi */}</Text>
    </View>
  </View>

  {/* Body */}
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
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Search Input */}
          <TextInput
            style={[styles.searchInput, { marginHorizontal: 16, marginBottom: 12 }]}
            placeholder="🔍 Cari nama desa"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={handleSearch}
          />

<View
  style={{
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  }}
>
  {filteredData.map((item, index) => (
    <TouchableOpacity
      key={`item-${index}`}
      style={{
        width: '48%',
        backgroundColor:
          item.status_pengajuan === '2'
            ? '#FFEBEE'
            : item.status_pengajuan === '3'
            ? '#E8F5E9'
            : '#FFFFFF',
        marginBottom: 12,
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
      }}
      onPress={() =>
        navigation.navigate('Zona', {
          nama_kecamatan: item.nama_kecamatan,
          nama_des_kel: item.nama_des_kel,
          id_kecamatan: item.kecamatan_id,
          id_des_kel: item.des_kel_id,
          file: item.file
        })
      }
    >
      {/* Nama Desa */}
      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#208DC0' }}>
        {item.nama_des_kel}
        {item.status_pengajuan === '1' && ' ⌛️'}
        {item.status_pengajuan === '2' && ' 🚫'}
        {item.status_pengajuan === '3' && ' ✅'}
      </Text>

      {/* Kecamatan */}
      <Text style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
        {item.nama_kecamatan}
      </Text>

      {/* Waktu + Lihat Lampiran */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <Text style={{ fontSize: 10, color: '#777' }}>
          ⏰ {moment(item.createAt).format('DD MMM YYYY')}
        </Text>

        {/* <TouchableOpacity
          onPress={() => openPdf(item.file)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f2f2f2',
            paddingVertical: 2,
            paddingHorizontal: 6,
            borderRadius: 6,
          }}
        >
          <FastImage
            source={require('../assets/img/lampiran-icon.png')}
            style={{ width: 10, height: 10, marginRight: 4 }}
            resizeMode={FastImage.resizeMode.contain}
          />
          <Text style={{ fontSize: 9, color: '#208DC0', fontWeight: '600' }}>
            Lihat Lampiran
          </Text>
        </TouchableOpacity> */}
      </View>
    </TouchableOpacity>
  ))}
</View>


          {/* Modal PDF */}
          {/* <PdfWebViewModal
            isVisible={isModalVisible}
            onClose={() => setModalVisible(false)}
            pdfUrl={pdfUrl}
          /> */}
        </ScrollView>
      )}
    </ImageBackground>
  </View>

  {/* Tab Bar */}
  <TabBar />
</View>



    );
};



//make this component available to the app
export default Monitoring;
