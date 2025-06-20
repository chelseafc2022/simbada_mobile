import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import FastImage from "react-native-fast-image";
import TabBar from '../components/TabBar';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';



const User = ({ navigation }) => {
    const dispatch = useDispatch();
    const [selectedUser, setSelectedUser] = useState(null);
    const [userInfo, setUserInfo] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // const TOKEN = useSelector(state => state.TOKEN);
      const PROFILE = useSelector(state => state.PROFILE);
      const URL = useSelector(state => state.URL);
    const dummyStatus = null; // coba ganti ke null, 1, 2, dll

// Ganti semua akses status di komponen dengan dummyStatus untuk tes
const userStatus = dummyStatus;

    const statusMapping = {
        1: 'Administrator',
        2: 'Operator Desa',
        3: 'Operator Kecamatan',
        4: 'Operator Kabupaten',
        5: 'Pimpinan',
        6: 'Stakeholder',
        7: 'Stakeholder Home'
    };

    const getDriveLink = (userStatus) => {
        switch (parseInt(userStatus)) {
            case 1: // Administrator
                return 'https://drive.google.com/drive/u/9/folders/1I11vcZ5EJw7yKeancH8wSkEopTq7Ncsq';
            case 2: // Operator Desa
                return 'https://drive.google.com/file/d/1kquuuYuPkpOpZstnFyGO_sjHyv70uUXQ/view?usp=sharing';
            case 3: // Operator Kecamatan
                return 'https://drive.google.com/file/d/10xnnShnsb4n5VdKLuTHC2DNmuhJHpMxb/view?usp=sharing';
            case 4: // Operator Kabupaten
                return 'https://drive.google.com/file/d/1kuDZwXheQwQWSWs0I9rjztAcKS__ae2N/view?usp=sharing';
            case 5: // Pimpinan
                return 'https://drive.google.com/file/d/1kuDZwXheQwQWSWs0I9rjztAcKS__ae2N/view?usp=sharing';
            case 6: // Stakeholder
                return 'https://drive.google.com/file/d/1kuDZwXheQwQWSWs0I9rjztAcKS__ae2N/view?usp=sharing';
            default:
                return 'https://drive.google.com/default-link'; // Link default jika status tidak dikenali
        }
    };

    const fetchUserProfile = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('TOKEN');

            const response = await fetch(URL.URL_PENGGUNA + "view", {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    "Content-Type": "application/json",
                    Authorization: "kikensbatara " + token,
                },
                body: JSON.stringify({
                    data_ke: 1, 
                    cari_value: "", 
                    id: PROFILE.id,
                    status: PROFILE.profile?.status || 1, 
                    id_kecamatan: PROFILE.profile?.id_kecamatan || ""
                }),
            });

            const result = await response.json();
            console.log('Response JSON:', result);

            if (response.ok && Array.isArray(result) && result.length > 0) {
                if (PROFILE.profile?.status === 1) {
                    // Jika status Administrator, ambil hanya 1 pengguna
                    setSelectedUser(result[0]?.data1[0] || null);
                } else {
                    setUserInfo(result[0]?.data1 || []);
                }
            } else {
                console.error('Error fetching user info: Data kosong atau struktur tidak sesuai.');
                setSelectedUser(null);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserProfile();
        console.log("User Status dari Redux:", PROFILE.profile?.status);
    }, []);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#208DC0" />
            </View>
        );
    }

    if (!selectedUser && userInfo.length === 0) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Gagal memuat data pengguna.</Text>
                <View style={styles.top3}>
                <TouchableOpacity onPress={() => logOut(navigation)} style={styles.logoutButton}>
                    <Text style={styles.menuText}>❌ Logout</Text>
                </TouchableOpacity>
            </View>
                
            </View>
        );
    }

    const logOut = async (navigation) => {
        try {
            await AsyncStorage.removeItem('TOKEN');
            await AsyncStorage.removeItem('PROFILE');
            await AsyncStorage.removeItem('LAST_LOGIN');
            await AsyncStorage.removeItem('lokasiPolylineData');
            await AsyncStorage.removeItem('lokasiData');


            // Reset nilai di Redux menggunakan dispatch
            dispatch({ type: 'RESET_AUTH' });

            // Arahkan ke halaman Login
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.error('Error saat logout:', error);
            Alert.alert('Error', 'Gagal melakukan logout. Silakan coba lagi.');
        }
    };
    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
            <ScrollView style={styles.body}>
                <View style={styles.navTop}>
                    {/* Tombol Back */}
                    <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()}>
                        <FastImage 
                            style={styles.backIcon}
                            source={require('../assets/img/chevron-left.png')}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    
                    {/* Judul Profil */}
                    <View style={styles.top2}>
                        <Text style={styles.headerTitle}>Profil</Text>
                    </View>

                    {/* Tombol Logout (Hanya jika status_user === 3) */}
                    {/* {parseInt(PROFILE.profile?.status) === 3 && (
                    <View style={styles.top3}>
                        <TouchableOpacity onPress={() => logOut(navigation)} style={styles.logoutButton}>
                            <Text style={styles.menuText}>❌</Text>
                        </TouchableOpacity>
                    </View>
                    )} */}

                {/* {userStatus == null && (
                <TouchableOpacity onPress={() => logOut(navigation)} style={styles.logoutButton}>
                    <Text style={styles.menuText}>❌ Logout</Text>
                </TouchableOpacity>
                )} */}
                </View>

                {/* Tampilkan jika status adalah Administrator */}
                {parseInt(PROFILE.profile?.status) === 1 && selectedUser && (
                <View style={styles.profileContainer}>
                    <FastImage 
                        style={styles.profileImage}
                        source={require('../assets/img/profilbg.png')}
                        resizeMode="cover"
                    />
                    <Text style={styles.nameText}>Administrator</Text>
                    <Text style={styles.phoneText}>📞 {selectedUser.no_telp || "Nomor telepon tidak ditemukan"}</Text>
                    {/* <Text style={styles.statusText}>
                        Status: {statusMapping[selectedUser.status] || 'Status tidak diketahui'}
                    </Text> */}
                </View>
            )}

            {/* Tampilkan tabel hanya untuk status 3 (Operator Kecamatan) */}
            {parseInt(PROFILE.profile?.status) === 3 && (
                <View style={styles.tableContainer}>
                    <Text style={styles.tableHeader}>Desa di Kecamatan</Text>
                    <View style={styles.tableRowHeader}>
                        <Text style={[styles.tableCell, styles.cellNo]}>No</Text>
                        <Text style={[styles.tableCell, styles.cellNo]}>Nama Desa</Text>
                        <Text style={[styles.tableCell, styles.cellNo]}>No. Hp</Text>
                    </View>
                    {userInfo.map((user, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.cellNo1]}>{index + 1}</Text>
                            <Text style={styles.tableCell}>{user.nama}</Text>
                            <Text style={styles.tableCell}>{user.no_telp || '-'}</Text>
                        </View>
                    ))}
                </View>
            )}

                {/* Tampilkan data list untuk status user selain Administrator */}
                {parseInt(PROFILE.profile?.status) !== 1 || 3 && userInfo.map((user, index) => (
                    <View key={index} style={styles.profileContainer}>
                        <FastImage 
                            style={styles.profileImage}
                            source={require('../assets/img/profilbg.png')}
                            resizeMode="cover"
                        />
                        <Text style={styles.nameText}>{user.nama}</Text>
                        <Text style={styles.kecamatanText}>
                            Kecamatan: {user.kecamatan?.text || "Kecamatan tidak ditemukan"}
                        </Text>
                        <Text style={styles.desaText}>
                            Desa: {user.des_kel_id?.text || "Desa tidak ditemukan"}
                        </Text>
                        <Text style={styles.phoneText}>📞 {user.no_telp || "Nomor telepon tidak ditemukan"}</Text>
                        <Text style={styles.statusText}>
                            Status: {statusMapping[user.status] || 'Status tidak diketahui'}
                        </Text>
                    </View>
                ))}

                {/* Tampilkan data list untuk status user selain Administrator */}
                {parseInt(PROFILE.profile?.status) == 2 && userInfo.map((user, index) => (
                    <View key={index} style={styles.profileContainer}>
                        <FastImage 
                            style={styles.profileImage}
                            source={require('../assets/img/profilbg.png')}
                            resizeMode="cover"
                        />
                        <Text style={styles.nameText}>{user.nama}</Text>
                        <Text style={styles.kecamatanText}>
                            Kecamatan: {user.kecamatan?.text || "Kecamatan tidak ditemukan"}
                        </Text>
                        <Text style={styles.desaText}>
                            Desa: {user.des_kel_id?.text || "Desa tidak ditemukan"}
                        </Text>
                        <Text style={styles.phoneText}>📞 {user.no_telp || "Nomor telepon tidak ditemukan"}</Text>
                        <Text style={styles.statusText}>
                            Status: {statusMapping[user.status] || 'Status tidak diketahui'}
                        </Text>
                    </View>
                ))}

                {/* Menu Options */}
                <View style={styles.menuContainer}>
                    <TouchableOpacity
                        style={styles.menuOption}
                        onPress={() => {
                            const userStatus = PROFILE.profile?.status || 1; // Ambil status user dari Redux Store
                            const driveLink = getDriveLink(userStatus); // Dapatkan link sesuai status
                            Linking.openURL(driveLink);
                        }}
                    >
                        <Text style={styles.menuText}>📘 Buku Panduan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuOption} onPress={() => logOut(navigation)}>
                        <Text style={styles.menuText}>◀️ Keluar</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            <TabBar />
        </View>
    );
};

const styles = StyleSheet.create({
    body: { flex: 1, backgroundColor: '#f5f5f5' },
    navTop: { flexDirection: 'row', padding: 15, alignItems: 'center', backgroundColor: '#ffffff', elevation: 5 },
    backIcon: { width: 20, height: 20 },
    top2: { flex: 3, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#208DC0' },
    profileContainer: { alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 3 },
    profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
    nameText: { fontSize: 22, fontWeight: 'bold', color: '#208DC0' },
    kecamatanText: { fontSize: 16, color: '#555' },
    desaText: { fontSize: 14, color: '#777' },
    phoneText: { fontSize: 14, color: '#888' },
    menuContainer: { paddingHorizontal: 20, marginTop: 20 },
    menuOption: { paddingVertical: 15, paddingHorizontal: 10, backgroundColor: '#ffffff', marginBottom: 10, borderRadius: 8, elevation: 2 },
    menuText: { fontSize: 16, color: '#208DC0', fontWeight: 'bold' },
    tableContainer: { paddingHorizontal: 20, paddingTop: 10 },
    tableHeader: { fontSize: 18, fontWeight: 'bold', color: '#208DC0', marginBottom: 10 },
    tableRowHeader: { flexDirection: 'row', backgroundColor: '#208DC0', padding: 10, borderRadius: 5 },
    tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    tableCell: { flex: 1, color: '#777', textAlign: 'center' },
    cellNo: { flex: 0.3, color: '#ddd' },
    cellNo1: { flex: 0.3, color: '#777' }
});

export default User;
