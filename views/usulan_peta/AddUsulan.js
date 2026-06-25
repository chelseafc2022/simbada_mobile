//import liraries
import React, { Component, useState, useEffect, useContext } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView, TextInput,ImageBackground, Button,  Alert, ActivityIndicator, StyleSheet } from 'react-native';
import FastImage from "react-native-fast-image";
// import DocumentPicker from 'react-native-document-picker';
import TabBar from '../components/TabBar'
import { useSelector, useDispatch } from 'react-redux';
import DocumentPicker from 'react-native-document-picker';
import { Picker } from '@react-native-picker/picker';
// import { LokasiContext } from '../library/context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import OfflineManager from '../library/OfflineManager';

import { Assets } from '@react-navigation/elements';

// create a component
const AddUsulan = ({navigation}) => {
    const Route = (routex, data)=>{
        navigation.navigate(routex, data)
      }
    const dispatch = useDispatch();

      const [kecamatan, setKecamatan] = useState([]);
    const [desa, setDesa] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState(null); // State untuk menyimpan nama file
    const [isOnline, setIsOnline] = useState(true); // Status koneksi
    // const { lokasi, setLokasi } = useContext(LokasiContext);
    

    const TOKEN = useSelector(state => state.TOKEN);
    const PROFILE = useSelector(state => state.PROFILE);
    const URL = useSelector(state => state.URL);

    // Monitor status koneksi
    useEffect(() => {
      const unsubscribe = NetInfo.addEventListener(state => {
        setIsOnline(state.isConnected);
      });
      return () => unsubscribe();
    }, []);


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
            tipe: '', // ⬅️ tambahkan ini

        }
      )

      useEffect(() => {
        // console.log('Token:', TOKEN);
        // console.log('Endpoint:', URL.URL_KECAMATAN + 'desa');
        
        // Cek apakah user adalah Operator Desa (bukan admin)
        const userStatus = PROFILE?.profile?.status?.toString();
        if (userStatus && userStatus !== '1') {
            // Auto-fill dari profile
            SET_FORM(prev => ({
                ...prev,
                kecamatan_id: PROFILE?.profile?.id_kecamatan || '',
                nama_kecamatan: PROFILE?.profile?.nama_kecamatan || '',
                des_kel_id: PROFILE?.profile?.id_desa || PROFILE?.profile?.id_kelurahan || '',
                nama_des_kel: PROFILE?.profile?.nama_desa || PROFILE?.profile?.nama_kelurahan || ''
            }));
            // Jika dia operator, tidak perlu load seluruh daftar kecamatan untuk dipilih
        } else {
            // Load Kecamatan on mount hanya untuk Admin (status == 1)
            const loadKecamatan = async () => {
              setLoading(true);
              const kecamatanList = await getKecamatan();
              setKecamatan(kecamatanList);
              setLoading(false);
            };
            loadKecamatan();
        }
      }, []);
    
      const getKecamatan = async () => {
        try {
            // console.log('Fetching kecamatan from:', URL.URL_KECAMATAN + 'kecamatan');
    
            const response = await fetch(URL.URL_KECAMATAN + 'kecamatan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: "kikensbatara " + TOKEN,
                },
            });
    
            if (!response.ok) {
                throw new Error(`Failed to fetch kecamatan. Status: ${response.status}`);
            }
    
            const data = await response.json();
            // console.log('Kecamatan Data:', data);
    
            // Simpan ke cache untuk offline
            await AsyncStorage.setItem('CACHE_KECAMATAN', JSON.stringify(data));
    
            // Ambil status user dan id_kecamatan user
            const userStatus = PROFILE.profile?.status || "1";
            const userKecamatanId = PROFILE.profile?.id_kecamatan;
    
            // Filter kecamatan hanya untuk user status 2
            const filteredKecamatan = userStatus === "2"
                ? data.filter(item => {
                    const no_kab = item.hasil?.no_kab ? item.hasil.no_kab.toString().padStart(2, '0') : "00";
                    const kode = item.hasil?.kode ? item.hasil.kode.toString().padStart(2, '0') : "00";
                    const kecamatanId = `${item.hasil.no_prop}.${no_kab}.${kode}`;
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
            console.warn('Error fetching kecamatan, mencoba load dari cache offline:', error.message);
            try {
                const cached = await AsyncStorage.getItem('CACHE_KECAMATAN');
                if (cached) {
                    const data = JSON.parse(cached);
                    const userStatus = PROFILE.profile?.status || "1";
                    const userKecamatanId = PROFILE.profile?.id_kecamatan;
                    
                    const filteredKecamatan = userStatus === "2"
                        ? data.filter(item => {
                            const no_kab = item.hasil?.no_kab ? item.hasil.no_kab.toString().padStart(2, '0') : "00";
                            const kode = item.hasil?.kode ? item.hasil.kode.toString().padStart(2, '0') : "00";
                            return `${item.hasil.no_prop}.${no_kab}.${kode}` === userKecamatanId;
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
                }
            } catch (e) {
                console.error('Gagal load cache kecamatan:', e);
            }
            return [];
        }
    };
    

      const getDesa = async (kecamatanId) => {
        try {
          // console.log('Fetching desa for kecamatan_id:', kecamatanId); // Debug kecamatan_id
      
          const response = await fetch(URL.URL_KECAMATAN + 'desa', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: "kikensbatara " + TOKEN,
            },
            body: JSON.stringify({ kecamatan_id: kecamatanId }),
          });
      
          // console.log('HTTP Status:', response.status);
      
          if (!response.ok) {
            throw new Error(`Failed to fetch desa. Status: ${response.status}`);
          }
      
          const data = await response.json();
          // console.log('Desa Data:', data);
          
          // Simpan ke cache untuk offline, gunakan key per kecamatan
          await AsyncStorage.setItem(`CACHE_DESA_${kecamatanId}`, JSON.stringify(data));
      
          return data.map((item) => ({
            id: `${item.no_prop}.${item.no_kab}.${item.no_kec}.${item.kode}`,
            nama: item.uraian,
          }));
        } catch (error) {
          console.warn('Error fetching desa, mencoba load dari cache offline:', error.message);
          try {
            const cached = await AsyncStorage.getItem(`CACHE_DESA_${kecamatanId}`);
            if (cached) {
                const data = JSON.parse(cached);
                return data.map((item) => ({
                    id: `${item.no_prop}.${item.no_kab}.${item.no_kec}.${item.kode}`,
                    nama: item.uraian,
                }));
            }
          } catch (e) {
              console.error('Gagal load cache desa:', e);
          }
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
      // console.log(formattedDesKelId); // Output: 74.05.02.2006
      
      
      const handleKecamatanChange = async (kecamatanId) => {
        const formattedKecamatanId = formatKecamatanId(kecamatanId);

        const selectedKecamatan = kecamatan.find(item => item.id === formattedKecamatanId);
        const namaKecamatan = selectedKecamatan ? selectedKecamatan.nama : '';
        
        // console.log('Formatted Kecamatan ID:', formattedKecamatanId); // Debugging
      
        SET_FORM({ 
            ...form, 
            kecamatan_id: formattedKecamatanId, 
            nama_kecamatan: namaKecamatan,
            des_kel_id: null,
            nama_des_kel: '' }); // Reset desa saat kecamatan berubah
        setLoading(true);
      
        try {
          const desaList = await getDesa(formattedKecamatanId); // Kirim formatted kecamatan_id
          // console.log('Desa List:', desaList); // Debug daftar desa
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

            // === CEK KONEKSI: Jika offline, simpan ke antrian ===
            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
                const offlineData = {
                    nik: form.nik,
                    nama: form.nama,
                    alamat: form.alamat,
                    kecamatan_id: form.kecamatan_id,
                    nama_kecamatan: form.nama_kecamatan,
                    des_kel_id: desKelIdFormatted,
                    nama_des_kel: form.nama_des_kel,
                    rwrt: form.rwrt,
                    catatan: form.catatan,
                    no_telp: form.no_telp,
                    status_pengajuan: form.status_pengajuan || 1,
                    file: form.file,
                    lokasi: form.lokasi,
                    marker: calculateCentroid(form.lokasi),
                    tipe: form.tipe || 'polygon',
                };

                await OfflineManager.addToQueue(
                    offlineData,
                    URL.URL_ADD_ZONA + 'addData',
                    TOKEN
                );

                // Update offline queue count di Redux
                const stats = await OfflineManager.getQueueStats();
                dispatch({ type: 'SET_OFFLINE_QUEUE_COUNT', payload: stats.pending + stats.failed });

                // Reset form
                SET_FORM({
                    id: '', nik: '', nama: '', alamat: '',
                    kecamatan_id: '', nama_kecamatan: '',
                    des_kel_id: '', nama_des_kel: '',
                    rwrt: '', no_telp: '', catatan: '',
                    status_pengajuan: null, file: '', lokasi: [], tipe: '',
                });
                setFileName(null);

                Alert.alert(
                    '📴 Disimpan Offline',
                    'Data berhasil disimpan di perangkat. Data akan otomatis terkirim saat koneksi internet tersedia.',
                    [{ text: 'OK' }]
                );
                return;
            }
            // === END OFFLINE CHECK ===
    
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
            formData.append("tipe", form.tipe || "polygon"); // ✅ WAJIB PASTIKAN
            // console.log("Data yang dikirim:", formData);
    
            // Kirim data ke server
            const response = await fetch(URL.URL_ADD_ZONA + "addData", {
                method: "POST",
                headers: {
                    Authorization: "kikensbatara " + TOKEN, // Token authorization
                },
                body: formData,
            });
    
            if (response.ok) {
                const result = await response.json();
            
                // Kosongkan semua field
                SET_FORM({
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
                    tipe: '',
                });
            
                // Kosongkan penyimpanan lokal
                await AsyncStorage.removeItem('lokasiData');
                await AsyncStorage.removeItem('lokasiPolylineData');

                // Setelah berhasil submit online, coba sync antrian offline juga
                const offlineResult = await OfflineManager.syncAll();
                if (offlineResult.synced > 0) {
                    Alert.alert("Berhasil", `Data berhasil dikirim.\n\n📤 ${offlineResult.synced} data offline juga berhasil disinkronkan.`);
                } else {
                    Alert.alert("Berhasil", "Data berhasil dikirim dan form telah dikosongkan.");
                }
            }
            
            
            
            else {
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
    
        // console.log("Centroid:", centroid);
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
            {/* === OFFLINE STATUS BANNER === */}
            {!isOnline && (
              <View style={{backgroundColor: '#FFF3E0', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 15}}>
                <Text style={{fontSize: 12, color: '#E65100', fontWeight: '600'}}>📴 Mode Offline — Data akan disimpan di perangkat</Text>
              </View>
            )}
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

             
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                {/* KARTU 1: Informasi Pemohon */}
                <View style={localStyles.card}>
                    <Text style={localStyles.cardTitle}>Informasi Pemohon</Text>

                    <Text style={localStyles.inputLabel}>NIK</Text>
                    <TextInput
                        style={localStyles.inputModern}
                        value={form.nik}
                        onChangeText={(value) => {
                            const numericValue = value.replace(/[^0-9]/g, '');
                            SET_FORM({ ...form, nik: numericValue });
                        }}
                        keyboardType="numeric"
                        maxLength={16}
                        placeholder="Masukkan 16 digit NIK"
                        placeholderTextColor="#aaa"
                    />

                    <Text style={localStyles.inputLabel}>Nama Lengkap</Text>
                    <TextInput
                        style={localStyles.inputModern}
                        value={form.nama}
                        onChangeText={(value) => SET_FORM({ ...form, nama: value })}
                        placeholder="Nama Lengkap sesuai KTP"
                        placeholderTextColor="#aaa"
                    />

                    <Text style={localStyles.inputLabel}>Nomor Telepon</Text>
                    <TextInput
                        style={localStyles.inputModern}
                        value={form.no_telp}
                        onChangeText={(value) => SET_FORM({ ...form, no_telp: value })}
                        placeholder="Contoh: 08123456789"
                        keyboardType="phone-pad"
                        placeholderTextColor="#aaa"
                    />
                </View>

                {/* KARTU 2: Detail Lokasi */}
                <View style={localStyles.card}>
                    <Text style={localStyles.cardTitle}>Detail Lokasi</Text>

                    <Text style={localStyles.inputLabel}>Kecamatan</Text>
                    {PROFILE?.profile?.status?.toString() === '1' ? (
                        <>
                            {loading && <ActivityIndicator size="small" color="#208DC0" style={{marginTop: 5}} />}
                            <View style={localStyles.pickerContainer}>
                                <Picker
                                    selectedValue={form.kecamatan_id}
                                    onValueChange={(value) => handleKecamatanChange(value)}
                                    style={localStyles.pickerElement}
                                >
                                    <Picker.Item label="Pilih Kecamatan" value="" />
                                    {kecamatan.map((item) => (
                                        <Picker.Item key={item.id} label={item.nama} value={item.id} />
                                    ))}
                                </Picker>
                            </View>
                        </>
                    ) : (
                        <TextInput
                            style={[localStyles.inputModern, { backgroundColor: '#f0f0f0', color: '#555' }]}
                            value={form.nama_kecamatan || 'Memuat...'}
                            editable={false}
                        />
                    )}

                    <Text style={localStyles.inputLabel}>Desa / Kelurahan</Text>
                    {PROFILE?.profile?.status?.toString() === '1' ? (
                        <View style={[localStyles.pickerContainer, !(!!form.kecamatan_id && desa.length > 0) && {opacity: 0.5}]}>
                            <Picker
                                selectedValue={form.des_kel_id}
                                onValueChange={(value) => {
                                    const selectedDesa = desa.find((item) => item.id === value);
                                    SET_FORM({ ...form, des_kel_id: value, nama_des_kel: selectedDesa ? selectedDesa.nama : '' });
                                }}
                                style={localStyles.pickerElement}
                                enabled={!!form.kecamatan_id && desa.length > 0}
                            >
                                <Picker.Item label="Pilih Desa" value="" />
                                {desa.map((item) => (
                                    <Picker.Item key={item.id} label={item.nama} value={item.id} />
                                ))}
                            </Picker>
                        </View>
                    ) : (
                        <TextInput
                            style={[localStyles.inputModern, { backgroundColor: '#f0f0f0', color: '#555' }]}
                            value={form.nama_des_kel || 'Memuat...'}
                            editable={false}
                        />
                    )}

                    <Text style={localStyles.inputLabel}>Alamat Detail</Text>
                    <TextInput
                        style={localStyles.inputModern}
                        value={form.alamat}
                        onChangeText={(value) => SET_FORM({ ...form, alamat: value })}
                        placeholder="Nama Jalan, Gedung, dll"
                        placeholderTextColor="#aaa"
                    />

                    <Text style={localStyles.inputLabel}>RT / RW</Text>
                    <TextInput
                        style={localStyles.inputModern}
                        value={form.rwrt}
                        onChangeText={(value) => SET_FORM({ ...form, rwrt: value })}
                        placeholder="Contoh: 001/002"
                        placeholderTextColor="#aaa"
                    />
                </View>

                {/* KARTU 3: Pemetaan & Lampiran */}
                <View style={localStyles.card}>
                    <Text style={localStyles.cardTitle}>Pemetaan & Lampiran</Text>

                    <Text style={localStyles.inputLabel}>Pilih Metode Pemetaan</Text>
                    <View style={localStyles.methodContainer}>
                        <TouchableOpacity 
                            style={[localStyles.methodButton, { backgroundColor: '#208DC0' }]} 
                            onPress={() => navigation.navigate('MetodeText', { 
                                lokasiAwal: form.lokasi || [],
                                onLokasiUpdate: (updatedLokasi) => {
                                    SET_FORM((prevForm) => ({
                                        ...prevForm,
                                        lokasi: updatedLokasi,
                                        tipe: 'polygon'
                                    }));
                                }
                            })}
                        >
                            <Text style={localStyles.methodButtonText}>📍 POLYGON</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[localStyles.methodButton, { backgroundColor: '#26A69A' }]} 
                            onPress={() => navigation.navigate('MetodePolyline', { 
                                lokasiAwal: form.lokasi || [],
                                onLokasiUpdate: (updatedLokasi) => {
                                    SET_FORM(prevForm => ({ 
                                        ...prevForm, 
                                        lokasi: updatedLokasi,
                                        tipe: 'polyline'
                                    }));
                                }
                            })}
                        >
                            <Text style={localStyles.methodButtonText}>〰️ POLYLINE</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Indikator Status Lokasi */}
                    {form.lokasi && form.lokasi.length > 0 && (
                        <View style={localStyles.statusLokasi}>
                            <Text style={localStyles.statusLokasiText}>
                                ✅ Tersimpan {form.lokasi.length} titik koordinat ({form.tipe === 'polygon' ? 'Polygon' : 'Polyline'})
                            </Text>
                        </View>
                    )}

                    <Text style={[localStyles.inputLabel, { marginTop: 15 }]}>Dokumen / File Pendukung</Text>
                    <TouchableOpacity onPress={handleFileUpload} style={localStyles.docButton}>
                        <Text style={localStyles.docButtonText}>{fileName || '📎 Pilih Dokumen'}</Text>
                    </TouchableOpacity>
                </View>

                {/* TOMBOL SIMPAN */}
                <TouchableOpacity style={localStyles.submitButton} onPress={handleSubmit}>
                    <Text style={localStyles.submitButtonText}>SIMPAN USULAN</Text>
                </TouchableOpacity>

            </ScrollView>
           </ImageBackground>

           </View>
        
           <TabBar/>
        
        </View>


    );
};



const localStyles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 15,
        marginHorizontal: 15,
        marginTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#208DC0',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 8,
    },
    inputLabel: {
        color: '#666',
        fontWeight: '600',
        fontSize: 12,
        marginBottom: 5,
        marginTop: 10,
    },
    inputModern: {
        height: 45,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        paddingHorizontal: 15,
        color: '#333',
        backgroundColor: '#fafafa',
        fontSize: 14,
    },
    pickerContainer: {
        height: 45,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        backgroundColor: '#fafafa',
        justifyContent: 'center',
    },
    pickerElement: {
        color: '#333',
    },
    methodContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    methodButton: {
        flex: 1,
        height: 45,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 5,
        elevation: 2,
    },
    methodButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    statusLokasi: {
        marginTop: 15,
        backgroundColor: '#E8F5E9',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    statusLokasiText: {
        color: '#2E7D32',
        fontSize: 12,
        fontWeight: 'bold',
    },
    docButton: {
        height: 45,
        borderWidth: 1,
        borderColor: '#208DC0',
        borderStyle: 'dashed',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F8FF',
    },
    docButtonText: {
        color: '#208DC0',
        fontWeight: 'bold',
        fontSize: 14,
    },
    submitButton: {
        backgroundColor: '#208DC0',
        marginHorizontal: 15,
        marginTop: 25,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});

//make this component available to the app
export default AddUsulan;
