import React, { useState } from 'react';
import styles from '../assets/style'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ImageBackground, Alert } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import FastImage from "react-native-fast-image";
// import DocumentPicker from 'react-native-document-picker';
import TabBar from '../components/TabBar'

import { useSelector } from 'react-redux';

const EditUsulan = ({ route, navigation }) => {
    const {
        id_usulan, nik, nama, alamat, id_kecamatan,
        nama_kecamatan, id_des_kel, nama_des_kel,
        rwrt, no_telp, catatan, lokasi, file
    } = route.params;
    const TOKEN = useSelector(state => state.TOKEN);
    //   const PROFILE = useSelector(state => state.PROFILE);
      const URL = useSelector(state => state.URL);

    const [form, setForm] = useState({
        id: id_usulan, nik, nama, alamat,
        id_kecamatan, nama_kecamatan,
        id_des_kel, nama_des_kel, rwrt, no_telp, catatan,
        lokasi, file, 
        file_old: file 

    });
     const [fileName, setFileName] = useState(null); // State untuk menyimpan nama file

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.pick({
                type: [
                    DocumentPicker.types.images,
                    DocumentPicker.types.pdf,
                    DocumentPicker.types.doc,
                    DocumentPicker.types.docx,
                    DocumentPicker.types.xls,
                    DocumentPicker.types.xlsx,
                ],
            });
            if (result && result.length > 0) {
                const pickedFile = result[0];
                const allowedExtensions = /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx)$/i;
                if (pickedFile.name && !allowedExtensions.test(pickedFile.name)) {
                    Alert.alert(
                        'Format Berkas Tidak Didukung',
                        'Hanya berkas Gambar (JPG, PNG), PDF, Word (.doc, .docx), atau Excel (.xls, .xlsx) yang diperbolehkan.'
                    );
                    return;
                }
                setForm(prevForm => ({ ...prevForm, file: pickedFile }));
                setFileName(pickedFile.name);
            }
        } catch (err) {
            if (!DocumentPicker.isCancel(err)) {
                console.error('Error picking file:', err);
            }
        }
    };

    const handleSubmit = async () => {
        try {
            const formData = new FormData();
        
            formData.append('id', form.id);  // ID usulan
            formData.append('nik', form.nik);
            formData.append('nama', form.nama);
            formData.append('alamat', form.alamat);
            formData.append('file_old', form.file_old);  // Nama file lama
            formData.append('status_pengajuan', 1); 
        
            // File baru (jika ada)
            if (form.file && form.file.uri) {
                formData.append('file', {
                    uri: form.file.uri,
                    name: form.file.name || 'file.pdf',
                    type: form.file.type || 'application/pdf',
                });
            }
        
            console.log('FormData yang dikirim:', {
                id: form.id,
                nik: form.nik,
                nama: form.nama,
                alamat: form.alamat,
                file: form.file,
                status_pengajuan: 1
            });
        
            const response = await fetch(URL.URL_ADD_ZONA + "editDatax", {
                method: 'POST',
                headers: {
                    Authorization: "kikensbatara " + TOKEN, // Token authorization
                },
                body: formData,
            });
        
            if (response.ok) {
                Alert.alert('Success', 'Data berhasil diperbarui.');
                navigation.goBack();
            } else {
                const errorText = await response.text();
                console.error('Error Response:', errorText);
                Alert.alert('Error', 'Gagal memperbarui data.');
            }
        } catch (error) {
            console.error('Error submitting data:', error);
            Alert.alert('Error', 'Terjadi kesalahan saat memperbarui data.');
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
                        Edit Usulan
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
                    onChangeText={text => setForm(prevForm => ({ ...prevForm, nik: text }))}
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
                    onChangeText={text => setForm(prevForm => ({ ...prevForm, nama: text }))}
                    // placeholder="Enter NIK"
                    placeholderTextColor="#aaa" // Warna teks placeholder
                />

                <Text style={{color: '#98A9B9', fontWeight:'bold', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                    ALAMAT    
                </Text>
                <TextInput
                
                    style={styles.input}
                    value={form.alamat}
                    onChangeText={text => setForm(prevForm => ({ ...prevForm, alamat: text }))}
                    // placeholder="Enter NIK"
                    placeholderTextColor="#aaa" // Warna teks placeholder
                />

                

              



                


                
                

               

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







        

export default EditUsulan;
