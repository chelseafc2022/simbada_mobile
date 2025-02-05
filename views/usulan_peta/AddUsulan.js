//import liraries
import React, { Component, useState, useEffect, useContext } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView, TextInput,ImageBackground, Button,  Alert, ActivityIndicator } from 'react-native';
import FastImage from "react-native-fast-image";
// import DocumentPicker from 'react-native-document-picker';
import TabBar from '../components/TabBar'
import { useSelector } from 'react-redux';
import DocumentPicker from 'react-native-document-picker';
import { Picker } from '@react-native-picker/picker';
// import { LokasiContext } from '../library/context';

import { Assets } from '@react-navigation/elements';

// create a component
const AddUsulan = ({navigation}) => {
    const Route = (routex, data)=>{
        navigation.navigate(routex, data)
      }

      const [kecamatan, setKecamatan] = useState([]);
    const [desa, setDesa] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState(null); // State untuk menyimpan nama file
    // const { lokasi, setLokasi } = useContext(LokasiContext);
    

      const store = useSelector((state) => state);


    //   const [fileName, setFileName] = useState('');
    //   const handleDocumentPick = async () => {
    //     try {
    //       const result = await DocumentPicker.pick({
    //         type: [DocumentPicker.types.allFiles], // Semua jenis file
    //       });
    
    //       // Ambil nama file
    //       setFileName(result[0].name);
    //     } catch (err) {
    //       if (DocumentPicker.isCancel(err)) {
    //         console.log('User cancelled file picker');
    //       } else {
    //         console.error(err);
    //       }
    //     }
    //   };

      const [form, SET_FORM] = useState(
        {
            id: '',
            nik: '',
            nama: '',
            alamat: '',
            kecamatan_id : '',
            nama_kecamatan : '',
            des_kel_id : '',
            nama_des_kel: '',
            rwrt: '',
            no_telp: '',
            catatan: '',
            status_pengajuan: null,
            file: '',
            lokasi: [],

        }
      )

      useEffect(() => {
        console.log('Token:', store.TOKEN);
        console.log('Endpoint:', store.URL.URL_KECAMATAN + 'desa');
        // Load Kecamatan on mount
        const loadKecamatan = async () => {
          setLoading(true);
          const kecamatanList = await getKecamatan();
          setKecamatan(kecamatanList);
          setLoading(false);
        };
      
        loadKecamatan();
      }, []);
    
      const getKecamatan = async () => {
        try {
            console.log('Fetching kecamatan from:', store.URL.URL_KECAMATAN + 'kecamatan');
    
            const response = await fetch(store.URL.URL_KECAMATAN + 'kecamatan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: "kikensbatara " + store.TOKEN,
                },
            });
    
            if (!response.ok) {
                throw new Error(`Failed to fetch kecamatan. Status: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('Kecamatan Data:', data);
    
            // Ambil status user dan id_kecamatan user
            const userStatus = store.PROFILE.profile?.status || "1";
            const userKecamatanId = store.PROFILE.profile?.id_kecamatan;
    
            console.log('Status User:', userStatus);
            console.log('User Kecamatan ID:', userKecamatanId);
    
            // Filter kecamatan hanya untuk user status 2
            const filteredKecamatan = userStatus === "2"
                ? data.filter(item => {
                    // Ambil no_kab dan kode dengan fallback value untuk menghindari undefined
                    const no_kab = item.hasil?.no_kab ? item.hasil.no_kab.toString().padStart(2, '0') : "00";
                    const kode = item.hasil?.kode ? item.hasil.kode.toString().padStart(2, '0') : "00";
                    const kecamatanId = `${item.hasil.no_prop}.${no_kab}.${kode}`;
    
                    console.log('Checking kecamatanId:', kecamatanId); // Debugging kecamatanId
                    return kecamatanId === userKecamatanId;
                })
                : data;
    
            return filteredKecamatan.map((item) => {
                const no_kab = item.hasil?.no_kab ? item.hasil.no_kab.toString().padStart(2, '0') : "00";
                const kode = item.hasil?.kode ? item.hasil.kode.toString().padStart(2, '0') : "00";
    
                return {
                    id: `${item.hasil.no_prop}.${no_kab}.${kode}`,
                    nama: item.hasil.uraian,
                };
            });
        } catch (error) {
            console.error('Error fetching kecamatan:', error.message);
            return [];
        }
    };
    

      const getDesa = async (kecamatanId) => {
        try {
          console.log('Fetching desa for kecamatan_id:', kecamatanId); // Debug kecamatan_id
      
          const response = await fetch(store.URL.URL_KECAMATAN + 'desa', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: "kikensbatara " + store.TOKEN,
            },
            body: JSON.stringify({ kecamatan_id: kecamatanId }),
          });
      
          console.log('HTTP Status:', response.status);
      
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error Response Body:', errorText); // Debug body error dari backend
            throw new Error(`Failed to fetch desa. Status: ${response.status}`);
          }
      
          const data = await response.json();
          console.log('Desa Data:', data);
      
          return data.map((item) => ({
            id: `${item.no_prop}.${item.no_kab}.${item.no_kec}.${item.kode}`,
            nama: item.uraian,
          }));
        } catch (error) {
          console.error('Error fetching desa:', error.message);
          return [];
        }
      };


    // const getDesa = async (kecamatanId) => {
    //     console.log('Fetching desa for kecamatan_id (mock):', kecamatanId);
    //     return [
    //       { id: '74.05.18.001', nama: 'Desa A' },
    //       { id: '74.05.18.002', nama: 'Desa B' },
    //       { id: '74.05.18.003', nama: 'Desa C' },
    //     ];
    //   };  
    
    const formatKecamatanId = (id) => {
        const parts = id.split('.');
        return parts.map((part) => part.padStart(2, '0')).join('.'); // Tambahkan 0 jika panjang kurang dari 2
      };
      const formatDesKelId = (desKelId) => {
        // Pisahkan id desa berdasarkan titik
        const parts = desKelId.split('.');
      
        // Pastikan setiap bagian memiliki dua digit (misalnya, "5" -> "05")
        const formattedParts = parts.map((part) => part.padStart(2, '0'));
      
        // Gabungkan kembali menjadi format yang diinginkan
        return formattedParts.join('.');
      };
      
      // Contoh penggunaan
      let originalDesKelId = "74.5.2.2006";
      let formattedDesKelId = formatDesKelId(originalDesKelId);
      console.log(formattedDesKelId); // Output: 74.05.02.2006
      
      
      const handleKecamatanChange = async (kecamatanId) => {
        const formattedKecamatanId = formatKecamatanId(kecamatanId);

        const selectedKecamatan = kecamatan.find(item => item.id === formattedKecamatanId);
        const namaKecamatan = selectedKecamatan ? selectedKecamatan.nama : '';
        
        console.log('Formatted Kecamatan ID:', formattedKecamatanId); // Debugging
      
        SET_FORM({ 
            ...form, 
            kecamatan_id: formattedKecamatanId, 
            nama_kecamatan: namaKecamatan,
            des_kel_id: null,
            nama_des_kel: '' }); // Reset desa saat kecamatan berubah
        setLoading(true);
      
        try {
          const desaList = await getDesa(formattedKecamatanId); // Kirim formatted kecamatan_id
          console.log('Desa List:', desaList); // Debug daftar desa
          setDesa(desaList); // Perbarui state desa
        } catch (error) {
          console.error('Error in handleKecamatanChange:', error.message);
          Alert.alert('Error', 'Gagal memuat data desa. Silakan coba lagi.');
        } finally {
          setLoading(false);
        }
      };

      const handleFileUpload = async () => {
        try {
            // Membatasi ke PDF dan gambar saja
            const result = await DocumentPicker.pick({
                type: [DocumentPicker.types.images, DocumentPicker.types.pdf], // Hanya PDF dan gambar
            });
    
            // Jika berhasil
            console.log('File yang dipilih:', result);
            console.log('Form saat ini:', {
                ...form,
                file: result[0],
            });
            SET_FORM((prevForm) => ({
                ...prevForm,
                file: result[0], // Simpan file di form
            }));
            console.log('File yang dipilih:', result);
            setFileName(result[0].name); // Menyimpan nama file
        } catch (err) {
            // Jika pengguna membatalkan pemilihan file
            if (DocumentPicker.isCancel(err)) {
                console.log('Pemilihan file dibatalkan oleh pengguna.');
            } else {
                console.error('Error uploading file:', err);
            }
        }
    };

    const handleSubmit = async () => {
        try {
            // Validasi input
            if (!form.nik || !form.nama || !form.alamat || !form.kecamatan_id || !form.des_kel_id) {
                Alert.alert('Validation Error', 'Please fill all required fields.');
                return;
            }

            const desKelIdFormatted = formatDesKelId(form.des_kel_id);
    
            const formData = new FormData();
    
            // Tambahkan semua data ke FormData
            formData.append("nik", form.nik);
            formData.append("nama", form.nama);
            formData.append("alamat", form.alamat);
            formData.append("kecamatan_id", form.kecamatan_id);
            formData.append("nama_kecamatan", form.nama_kecamatan);
            formData.append("des_kel_id", desKelIdFormatted);
            formData.append("nama_des_kel", form.nama_des_kel, );
            formData.append("rwrt", form.rwrt);
            formData.append("catatan", form.catatan);
            formData.append("no_telp", form.no_telp);
            formData.append("status_pengajuan", form.status_pengajuan || 1); // Default ke status 1
            formData.append("file", form.file); // Pastikan file adalah objek hasil DocumentPicker
            formData.append("lokasi", JSON.stringify(form.lokasi)); // Konversi lokasi menjadi string JSON
            formData.append("marker", JSON.stringify(calculateCentroid(form.lokasi))); // Hitung centroid dan tambahkan ke form
    
            console.log("Data yang dikirim:", formData);
    
            // Kirim data ke server
            const response = await fetch(store.URL.URL_ADD_ZONA + "addData", {
                method: "POST",
                headers: {
                    Authorization: "kikensbatara " + store.TOKEN, // Token authorization
                },
                body: formData,
            });
    
            if (response.ok) {
                const result = await response.json();
                console.log("Response server:", result);
                Alert.alert("Success", "Data berhasil disubmit.");
            } else {
                const errorText = await response.text();
                console.error("Error Response Body:", errorText);
                throw new Error(`Failed to submit data. Status: ${response.status}`);
            }
        } catch (error) {
            console.error("Error submitting data:", error.message);
            Alert.alert("Error", "Gagal mengirim data. Silakan coba lagi.");
        }
    };
    
    // Fungsi untuk menghitung centroid
    const calculateCentroid = (locations) => {
        if (!locations || locations.length === 0) return { lat: 0, lng: 0 };
    
        let totalLat = 0;
        let totalLng = 0;
    
        locations.forEach((location) => {
            totalLat += parseFloat(location.lat);
            totalLng += parseFloat(location.lng);
        });
    
        const centroid = {
            lat: totalLat / locations.length,
            lng: totalLng / locations.length,
        };
    
        console.log("Centroid:", centroid);
        return centroid;
    };
    
    
      const constchangeInput = async (val, objek) => {
        SET_FORM((prevState) => ({
            ...prevState,
            [objek]: val
                }));
        }

        /// constchangeInput dan useState, onChangeText pada textInput


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
                        Tambah Usulan
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

             
            <ScrollView>
                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:20, alignSelf:'center'}}>
                    NIK
                </Text>
                <TextInput
                
                    style={styles.input}
                    value={form.nik}
                    onChangeText={(value) => {
                        // Pastikan hanya angka yang diterima
                        const numericValue = value.replace(/[^0-9]/g, ''); // Hapus karakter non-angka
                        SET_FORM({ ...form, nik: numericValue });
                      }}
                      keyboardType="numeric" // Membuka keyboard angka
                      maxLength={16} // Maksimal 16 digit untuk NIK
                      placeholder="Masukkan NIK"
                      placeholderTextColor="#aaa"
                />
                
                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    NAMA
                </Text>
                <TextInput
                
                    style={styles.input}
                    value={form.nama}
                    onChangeText={(value) => SET_FORM({ ...form, nama: value })}
                    // placeholder="Enter NIK"
                    placeholderTextColor="#aaa" // Warna teks placeholder
                />

                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    ALAMAT    
                </Text>
                <TextInput
                
                    style={styles.input}
                    value={form.alamat}
                    onChangeText={(value) => SET_FORM({ ...form, alamat: value })}
                    // placeholder="Enter NIK"
                    placeholderTextColor="#aaa" // Warna teks placeholder
                />

                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    RT / RW    
                </Text>
                <TextInput
                
                    style={styles.input}
                    value={form.rwrt}
                    onChangeText={(value) => SET_FORM({ ...form, rwrt: value })}
                    // placeholder="Enter NIK"
                    placeholderTextColor="#aaa" // Warna teks placeholder
                />


                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    Kecamatan    
                </Text>
                {loading && <ActivityIndicator size="small" color="#0000ff" />}
                <Picker
                selectedValue={form.kecamatan_id}
                onValueChange={(value) => {
                    console.log('Selected Kecamatan ID:', value); // Debug kecamatan_id
                    handleKecamatanChange(value);
                  }}
                style={styles.input}
                >
                <Picker.Item label="Pilih Kecamatan" value="" />
                {kecamatan.map((item) => (
                    <Picker.Item key={item.id} label={item.nama} value={item.id} />
                ))}
                </Picker>



                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    Desa
                    </Text>
                    {/* <Text>{JSON.stringify(desa)}</Text> */}

                    <Picker
                    selectedValue={form.des_kel_id}
                    onValueChange={(value) => {
                        const selectedDesa = desa.find((item) => item.id === value); // Temukan nama desa berdasarkan ID
                        console.log('Selected Desa:', selectedDesa); // Debugging

                        console.log('Selected Desa ID:', value); // Log desa_id yang dipilih
                        SET_FORM({ ...form, des_kel_id: value, nama_des_kel: selectedDesa ? selectedDesa.nama : '' });
                      }}
                    style={styles.input}
                    enabled={!!form.kecamatan_id && desa.length > 0} // Dropdown hanya aktif jika kecamatan dipilih
                    >
                    <Picker.Item label="Pilih Desa" value="" />
                    {desa.map((item) => (
                        <Picker.Item key={item.id} label={item.nama} value={item.id} />
                    ))}
                    </Picker>
                    
                


                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    Telepon
                </Text>
                <TextInput
                
                    style={styles.input}
                    value={form.no_telp}
                    onChangeText={(value) => SET_FORM({ ...form, no_telp: value })}
                    // placeholder="Enter NIK"
                    placeholderTextColor="#aaa" // Warna teks placeholder
                />

                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    Metode 
                </Text>

                

                <View style={{flex:1, alignSelf:'center', width:'90%'}}>
                    <View style={{flexDirection:'row'}}>
                    <TouchableOpacity 
                        style={styles.metodeText} 
                        onPress={() => navigation.navigate('MetodeText', { 
                            lokasiAwal: form.lokasi || [], // Pastikan ini adalah array lokasi terbaru
                            onLokasiUpdate: (updatedLokasi) => {
                                console.log("Received updated lokasi[] from MetodeText:", updatedLokasi);
                                SET_FORM((prevForm) => ({
                                    ...prevForm,
                                    lokasi: updatedLokasi, // Perbarui lokasi di form
                                }));
                            }
                        })}
                        >
                        <Text style={{ color: 'white' }}>LOKASI</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Lokasi yang diterima */}
                    {/* <Text style={{ color: '#98A9B9', fontWeight: 'bold', fontSize: 12, height: 'auto', width: '90%', marginTop: 10, alignSelf: 'center' }}>
                            Lokasi Terpilih:
                        </Text>
                        <Text style={{ color: '#000', fontSize: 12, width: '90%', alignSelf: 'center' }}>
                            {JSON.stringify(form.lokasi, null, 2)}
                        </Text> */}
                </View>

                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                DOKUMEN / FILE PENDUKUNG    
                </Text>
                <TouchableOpacity onPress={handleFileUpload} style={styles.inputDoc}>
                    <Text style={styles.textSelected}>{fileName || '📎 Pilih Dokumen'}</Text>
                </TouchableOpacity>
               

                
                
                {/* <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                DOKUMEN / FILE PENDUKUNG    
                </Text>
                <TouchableOpacity onPress={handleDocumentPick} style={styles.inputDoc}>
                    <Text style={fileName ? styles.textSelected : styles.placeholder}>
                    {fileName || '📎 Pilih Dokumen'}
                    </Text>
                </TouchableOpacity> */}

                <TouchableOpacity style={styles.addbatas} onPress={handleSubmit}>
                    <Text style={styles.addbatasx}>
                        SIMPAN
                    </Text>
                </TouchableOpacity>



                    
                {/* 
                
                // UPLOAD DOKUMEN

                <Text style={styles.label}>Upload Dokumen</Text>
                <TouchableOpacity onPress={handleDocumentPick} style={styles.input}>
                    <Text style={fileName ? styles.textSelected : styles.placeholder}>
                    {fileName || 'Pilih Dokumen'}
                    </Text>
                </TouchableOpacity>
                <Button title="Submit" onPress={() => alert(`File: ${fileName}`)} /> 
                
                // UPLOAD DOKUMEN */}



           </ScrollView>
           </ImageBackground>

           </View>
        
           <TabBar/>
        
        </View>


    );
};



//make this component available to the app
export default AddUsulan;
