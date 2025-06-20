//import liraries
import React, { Component, useState, useEffect } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ImageBackground, ActivityIndicator, ScrollView } from 'react-native';
import FastImage from "react-native-fast-image";
import TabBar from '../components/TabBar'
// import PdfWebViewModal from './PdfWebViewModal';

import moment from "moment";
import { useSelector } from 'react-redux'
import { useIsFocused } from "@react-navigation/native";

import { Assets } from '@react-navigation/elements';

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
          setIsLoading(true);

          const userStatus = PROFILE.profile?.status;
            const idDesaUser = PROFILE.profile?.id_desa;
            const idKecamatanUser = PROFILE.profile?.id_kecamatan;

              // Log debugging untuk memastikan parameter benar
        console.log('User Status:', userStatus);
        console.log('ID Desa:', idDesaUser);
        console.log('ID Kecamatan:', idKecamatanUser);

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
            SET_USULAN(result[0].data1); // Simpan data ke state
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

        <View style={{flex:1}}>
            <TouchableOpacity
                onPress={() => navigation.navigate('AddUsulan')}
                style={{
                    position: 'absolute',
                    bottom: 80, // sesuaikan agar tidak ketumpuk tab bar
                    right: 20,
                    backgroundColor: '#208DC0',
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 5,
                    zIndex: 999,
                }}
                >
                <Text style={{ color: '#fff', fontSize: 30, marginTop: -2 }}>+</Text>
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
                    <ActivityIndicator size="large" color="#208DC0" />
                ) : (
                    <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 10 }}>
  {DATA_USULAN.map((item, index) => (
    <TouchableOpacity
      key={item.id || index}
      style={[
        {
          width: '48%',
          backgroundColor: '#fff',
          borderRadius: 8,
          marginBottom: 15,
          padding: 10,
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 1,
        },
        item.status_pengajuan === '2' && { backgroundColor: '#FFCDD2' },
        item.status_pengajuan === '3' && { backgroundColor: '#BAD8B6' },
      ]}
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
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#208DC0', marginBottom: 4 }}>
        {item.nama}{' '}
        {item.status_pengajuan === '1' && '⌛️'}
        {item.status_pengajuan === '2' && '🚫'}
        {item.status_pengajuan === '3' && '✅'}
      </Text>
      <Text style={{ fontSize: 12, color: '#080808', marginBottom: 2 }}>{item.alamat}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
  <Text style={{ fontSize: 10, color: '#737373' }}>
    ⏰ {moment(item.createAt).format("DD MMMM YYYY")}
  </Text>

  {/* <TouchableOpacity
    onPress={() => openPdf(item.file)}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
  >
    <FastImage
      source={require('../assets/img/lampiran-icon.png')}
      style={{ width: 14, height: 14 }}
      resizeMode={FastImage.resizeMode.contain}
    />
    <Text style={{ color: '#208DC0', fontSize: 10, fontWeight: 'bold' }}>
      Lihat Lampiran
    </Text>
  </TouchableOpacity> */}
</View>


      {/* <PdfWebViewModal
        isVisible={isModalVisible}
        onClose={() => setModalVisible(false)}
        pdfUrl={pdfUrl}
      /> */}
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
export default Usulan;
