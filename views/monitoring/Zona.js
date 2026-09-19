//import libraries
import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from '../assets/style';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView, 
    StyleSheet, 
    ActivityIndicator, 
    Alert, 
    Modal, 
    Image, 
    Linking, 
    Dimensions 
} from 'react-native';
import FastImage from "react-native-fast-image";
import MapView, { Polygon, Polyline, Marker } from 'react-native-maps';
import TabBar from '../components/TabBar';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PdfWebViewModal from '../usulan_peta/PdfWebViewModal';

const { width } = Dimensions.get('window');

// create a component
const Zona = ({ navigation, route }) => {
    const {
        id_usulan, nik, nama, alamat, id_kecamatan, nama_kecamatan,
        id_des_kel, nama_des_kel, rwrt, no_telp, catatan, lokasi, file, status_pengajuan
    } = route.params || {};

    const TOKEN = useSelector(state => state.TOKEN);
    const PROFILE = useSelector(state => state.PROFILE);
    const URL = useSelector(state => state.URL);

    const fileBaseUrl = URL.URL_APP 
        ? (URL.URL_APP.endsWith('/') ? URL.URL_APP + 'uploads/' : URL.URL_APP + '/uploads/') 
        : 'https://server-simbada.konaweselatankab.go.id/uploads/';

    let initialLokasi = [];
    try {
        if (typeof lokasi === 'string') {
            initialLokasi = JSON.parse(lokasi);
        } else if (Array.isArray(lokasi)) {
            initialLokasi = lokasi;
        }
    } catch (e) {
        initialLokasi = [];
    }

    const [detailData, setDetailData] = useState({
        id_usulan: id_usulan || '',
        nik: nik || '',
        nama: nama || '',
        alamat: alamat || '',
        id_kecamatan: id_kecamatan || '',
        nama_kecamatan: nama_kecamatan || '',
        id_des_kel: id_des_kel || '',
        nama_des_kel: nama_des_kel || '',
        rwrt: rwrt || '',
        no_telp: no_telp || '',
        catatan: catatan || '',
        file: file || '',
        status_pengajuan: status_pengajuan ? String(status_pengajuan) : '1',
        lokasi: initialLokasi,
    });

    const [isLoading, setIsLoading] = useState(true);
    const [petaPengajuan, setPetaPengajuan] = useState([]);
    const [petaDasar, setPetaDasar] = useState([]);
    const [mapRegion, setMapRegion] = useState(null);
    const [isPolygonReady, setIsPolygonReady] = useState(false);
    const [mapType, setMapType] = useState('hybrid');
    const [showLayerModal, setShowLayerModal] = useState(false);
    const mapRef = useRef(null);

    const handleZoomIn = () => {
        if (mapRef.current && mapRegion) {
            const newRegion = {
                ...mapRegion,
                latitudeDelta: Math.max(mapRegion.latitudeDelta / 2, 0.002),
                longitudeDelta: Math.max(mapRegion.longitudeDelta / 2, 0.002),
            };
            setMapRegion(newRegion);
            mapRef.current.animateToRegion(newRegion, 300);
        }
    };

    const handleZoomOut = () => {
        if (mapRef.current && mapRegion) {
            const newRegion = {
                ...mapRegion,
                latitudeDelta: Math.min(mapRegion.latitudeDelta * 2, 40),
                longitudeDelta: Math.min(mapRegion.longitudeDelta * 2, 40),
            };
            setMapRegion(newRegion);
            mapRef.current.animateToRegion(newRegion, 300);
        }
    };

    const handleResetCenter = () => {
        if (mapRef.current && mapRegion) {
            mapRef.current.animateToRegion(mapRegion, 500);
        }
    };

    // Modal PDF & Zoom Foto
    const [isModalVisible, setModalVisible] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState({ uri: '', title: '', lat: '', lng: '', index: 0 });

    const handleOpenDocument = (docFile) => {
        if (!docFile) {
            Alert.alert('Info', 'Tidak ada berkas dokumen terlampir.');
            return;
        }
        const fullUrl = docFile.startsWith('http') ? docFile : (fileBaseUrl + docFile);
        const lower = docFile.toLowerCase();

        if (lower.endsWith('.pdf')) {
            setPdfUrl(fullUrl);
            setModalVisible(true);
        } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lower)) {
            setSelectedPhoto({ uri: fullUrl, title: 'Dokumen: ' + docFile, lat: '', lng: '', index: 0 });
            setIsPhotoModalVisible(true);
        } else if (/\.(doc|docx|xls|xlsx|csv)$/i.test(lower)) {
            Alert.alert(
                'Buka Dokumen',
                `Buka / Unduh berkas ${docFile}?`,
                [
                    { text: 'Batal', style: 'cancel' },
                    { 
                        text: 'Buka / Unduh', 
                        onPress: () => Linking.openURL(fullUrl).catch(() => {
                            Alert.alert('Error', 'Gagal membuka berkas dokumen.');
                        })
                    }
                ]
            );
        } else {
            Linking.openURL(fullUrl).catch(() => {
                Alert.alert('Error', 'Gagal membuka berkas.');
            });
        }
    };

    const handleOpenPhotoModal = (uri, title, lat, lng, index) => {
        setSelectedPhoto({ uri, title, lat, lng, index });
        setIsPhotoModalVisible(true);
    };

    const getPetaPengajuan = async () => {
        try {
            setIsLoading(true);
            setIsPolygonReady(false);
        
            const response = await fetch(`${URL.URL_APP}api/v1/monitoring/viewnative`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `kikensbatara ${TOKEN}`
                },
                body: JSON.stringify({ 
                    id_kecamatan: detailData.id_kecamatan || id_kecamatan, 
                    id_des_kel: detailData.id_des_kel || id_des_kel, 
                    data_ke: 1 
                })
            });
    
            const data = await response.json();
    
            if (data.length > 0 && data[0].data1 && data[0].data1.length > 0) {
                const rawFirst = data[0].data1[0];
                let fetchedLokasi = [];
                try {
                    if (Array.isArray(rawFirst.lokasi)) {
                        fetchedLokasi = rawFirst.lokasi;
                    } else if (typeof rawFirst.lokasi === 'string') {
                        fetchedLokasi = JSON.parse(rawFirst.lokasi);
                    }
                } catch (err) {
                    fetchedLokasi = [];
                }

                setDetailData(prev => ({
                    ...prev,
                    id_usulan: prev.id_usulan || rawFirst.id || '',
                    nik: prev.nik || rawFirst.nik || '',
                    nama: prev.nama || rawFirst.nama || '',
                    alamat: prev.alamat || rawFirst.alamat || '',
                    nama_kecamatan: prev.nama_kecamatan || rawFirst.nama_kecamatan || '',
                    nama_des_kel: prev.nama_des_kel || rawFirst.nama_des_kel || '',
                    rwrt: prev.rwrt || rawFirst.rwrt || '',
                    no_telp: prev.no_telp || rawFirst.no_telp || '',
                    catatan: prev.catatan || rawFirst.catatan || '',
                    file: prev.file || rawFirst.file || '',
                    status_pengajuan: prev.status_pengajuan || (rawFirst.status_pengajuan ? String(rawFirst.status_pengajuan) : '1'),
                    lokasi: (prev.lokasi && prev.lokasi.length > 0) ? prev.lokasi : fetchedLokasi,
                }));

                const processedData = data[0].data1.map(polygon => ({
                    tipe: polygon.tipe || 'polygon',
                    coordinates: (polygon.lokasi || []).map(coord => ({
                        latitude: parseFloat(coord.lat), 
                        longitude: parseFloat(coord.lng)
                    }))
                }));
    
                setPetaPengajuan(processedData);

                if (processedData.length > 0 && processedData[0].coordinates.length > 0) {
                    const center = processedData[0].coordinates[0];
                    setMapRegion({
                        latitude: center.latitude,
                        longitude: center.longitude,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02
                    });
                    setIsPolygonReady(true);
                }
            } else {
                setPetaPengajuan([]);
                setIsPolygonReady(true);
            }
        } catch (error) {
            console.error("❌ Error Fetching Peta Pengajuan:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getPetaDasar = async () => {
        try {
            setIsLoading(true);
    
            const response = await fetch(`${URL.URL_APP}api/v1/monitoring/petadasar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `kikensbatara ${TOKEN}`
                },
                body: JSON.stringify({ des_kel_id: detailData.id_des_kel || id_des_kel })
            });
    
            const result = await response.json();
    
            if (!result || result.length === 0) {
                setPetaDasar([]);
                return;
            }
    
            const processedData = result[0].data1.map(item => {
                if (!item.geometry || !item.geometry.coordinates) {
                    return { coordinates: [] };
                }

                return {
                    coordinates: item.geometry.coordinates[0].map(coord => ({
                        latitude: coord[1],
                        longitude: coord[0]
                    }))
                };
            });

            setPetaDasar(processedData);
    
            if (processedData.length > 0 && processedData[0].coordinates.length > 0 && !mapRegion) {
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

    useFocusEffect(
        useCallback(() => {
            getPetaPengajuan();
            getPetaDasar();
        }, [id_des_kel])
    );
   
    useEffect(() => {
        return () => {
            setPetaPengajuan([]);
            setPetaDasar([]);
        };
    }, []);

    const renderStatusBadge = (status) => {
        if (status === '1') {
            return (
                <View style={[localStyles.badgeContainer, { backgroundColor: '#FFF8E1', borderColor: '#FFE082' }]}>
                    <Text style={{ color: '#F57F17', fontWeight: 'bold', fontSize: 12 }}>⏳ Menunggu Verifikasi</Text>
                </View>
            );
        } else if (status === '2') {
            return (
                <View style={[localStyles.badgeContainer, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' }]}>
                    <Text style={{ color: '#C62828', fontWeight: 'bold', fontSize: 12 }}>🚫 Ditolak</Text>
                </View>
            );
        } else if (status === '3') {
            return (
                <View style={[localStyles.badgeContainer, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
                    <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 12 }}>✅ Disetujui</Text>
                </View>
            );
        }
        return (
            <View style={[localStyles.badgeContainer, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}>
                <Text style={{ color: '#1565C0', fontWeight: 'bold', fontSize: 12 }}>📋 Usulan Wilayah</Text>
            </View>
        );
    };

    const getFileIcon = (fileName) => {
        if (!fileName) return '📁';
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.pdf')) return '📄';
        if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
        if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return '📊';
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lower)) return '🖼️';
        return '📎';
    };

    const handleDeleteZonaUsulan = () => {
        const usulanId = detailData.id_usulan || id_usulan;
        if (!usulanId) {
            Alert.alert("Error", "ID usulan tidak valid.");
            return;
        }

        Alert.alert(
            "Hapus Pengajuan Usulan",
            `Apakah Anda yakin ingin menghapus pengajuan batas desa "${detailData.nama || 'ini'}"? Tindakan ini akan menghapus data secara permanen dari server.`,
            [
                { text: "Batal", style: "cancel" },
                {
                    text: "Hapus",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await fetch(URL.URL_ADD_ZONA + "removeData", {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: "kikensbatara " + TOKEN,
                                },
                                body: JSON.stringify({
                                    id: usulanId,
                                    file: detailData.file || '',
                                }),
                            });

                            if (response.ok) {
                                const cacheKey = `@usulan_cache_${PROFILE?.id || 'user'}`;
                                await AsyncStorage.removeItem(cacheKey);

                                Alert.alert("Berhasil", "Pengajuan usulan telah berhasil dihapus.", [
                                    {
                                        text: "OK",
                                        onPress: () => navigation.goBack()
                                    }
                                ]);
                            } else {
                                Alert.alert("Gagal", "Gagal menghapus pengajuan dari server.");
                            }
                        } catch (err) {
                            console.error("Error deleting usulan in Zona:", err);
                            Alert.alert("Error", "Terjadi kesalahan koneksi saat menghapus usulan.");
                        }
                    }
                }
            ]
        );
    };

    const handleEditZonaUsulan = () => {
        navigation.navigate('EditUsulan', {
            id_usulan: detailData.id_usulan || id_usulan,
            nik: detailData.nik,
            nama: detailData.nama,
            alamat: detailData.alamat,
            id_kecamatan: detailData.id_kecamatan,
            nama_kecamatan: detailData.nama_kecamatan,
            id_des_kel: detailData.id_des_kel,
            nama_des_kel: detailData.nama_des_kel,
            rwrt: detailData.rwrt,
            no_telp: detailData.no_telp,
            catatan: detailData.catatan,
            lokasi: detailData.lokasi,
            file: detailData.file,
            status_pengajuan: detailData.status_pengajuan,
            tipe: detailData.tipe || (petaPengajuan[0]?.tipe) || 'polygon',
        });
    };

    const currentStatusStr = String(detailData.status_pengajuan || status_pengajuan || '1');
    const canEditOrDelete = currentStatusStr === '1' || currentStatusStr === '2'; // Status 1 (Menunggu) atau 2 (Ditolak) bisa edit & hapus

    return (
        <View style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
            {/* TOP NAVIGATION */}
            <View style={styles.navTop}>
                <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()} activeOpacity={0.7}>
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

                <View style={styles.top3} />
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                
                {/* KARTU 1: INFO WILAYAH & STATUS */}
                <View style={localStyles.headerCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 16, marginRight: 6 }}>📍</Text>
                                <Text style={localStyles.desaTitle} numberOfLines={1}>
                                    Desa {detailData.nama_des_kel || 'Desa'}
                                </Text>
                            </View>
                            <Text style={localStyles.kecamatanSubtitle}>
                                Kec. {detailData.nama_kecamatan || 'Kecamatan'} • Kab. Konawe Selatan
                            </Text>
                        </View>
                        {renderStatusBadge(detailData.status_pengajuan)}
                    </View>

                    {/* Tombol Aksi: Edit & Hapus jika Belum Diverifikasi (1) atau Ditolak (2) */}
                    {canEditOrDelete ? (
                        <View style={localStyles.actionBox}>
                            <View style={localStyles.actionBoxTop}>
                                <Text style={localStyles.actionBoxTitle}>⚙️ Tindakan Pengajuan Usulan</Text>
                                <Text style={localStyles.actionBoxSubtitle}>
                                    {currentStatusStr === '1' 
                                        ? 'Pengajuan masih dalam status "Menunggu Verifikasi". Anda dapat mengubah data atau membatalkan usulan.' 
                                        : 'Pengajuan ditolak. Anda dapat memperbaiki dokumen atau data usulan, lalu mengajukannya kembali.'}
                                </Text>
                            </View>
                            <View style={localStyles.actionButtonsGroup}>
                                <TouchableOpacity
                                    style={localStyles.detailEditBtn}
                                    onPress={handleEditZonaUsulan}
                                    activeOpacity={0.8}
                                >
                                    <Text style={localStyles.detailEditBtnText}>✏️ Edit Usulan</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={localStyles.detailDeleteBtn}
                                    onPress={handleDeleteZonaUsulan}
                                    activeOpacity={0.8}
                                >
                                    <Text style={localStyles.detailDeleteBtnText}>🗑️ Hapus Usulan</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* Jika status === '3' (Disetujui): Fitur edit dan hapus tidak ada, tampilkan informasi pengesahan */
                        <View style={localStyles.verifiedNoticeBox}>
                            <Text style={{ fontSize: 20 }}>🔒</Text>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={localStyles.verifiedNoticeTitle}>Usulan Telah Disahkan</Text>
                                <Text style={localStyles.verifiedNoticeSub}>
                                    Batas wilayah desa ini telah diverifikasi & disetujui resmi oleh Kabupaten. Data terkunci permanen.
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* KARTU 2: PETA INTERAKTIF */}
                <View style={localStyles.card}>
                    <View style={localStyles.cardHeaderRow}>
                        <Text style={localStyles.cardTitle}>🗺️ Visualisasi Peta Zona</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => setShowLayerModal(true)}
                                style={localStyles.layerButton}
                                activeOpacity={0.7}
                            >
                                <Text style={localStyles.layerButtonText}>
                                    {mapType === 'satellite' ? '🌍 Satelit' : mapType === 'terrain' ? '⛰️ Terrain' : mapType === 'standard' ? '🗺️ Standar' : '🛰️ Hybrid'} ⌵
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('FullMap', {
                                    petaPengajuan,
                                    petaDasar,
                                    region: mapRegion,
                                    mapType,
                                })}
                                style={localStyles.fullMapButton}
                                activeOpacity={0.7}
                            >
                                <Text style={localStyles.fullMapText}>⛶ Layar Penuh</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Legend Pills */}
                    <View style={localStyles.legendRow}>
                        <View style={localStyles.legendItem}>
                            <View style={[localStyles.legendColor, { backgroundColor: 'rgba(9, 9, 255, 0.6)', borderColor: 'blue' }]} />
                            <Text style={localStyles.legendText}>Peta Pengajuan</Text>
                        </View>
                        <View style={localStyles.legendItem}>
                            <View style={[localStyles.legendColor, { backgroundColor: 'rgba(255, 0, 0, 0.4)', borderColor: 'red' }]} />
                            <Text style={localStyles.legendText}>Peta Dasar</Text>
                        </View>
                    </View>

                    {/* Map Box */}
                    <View style={localStyles.mapWrapper}>
                        {(petaPengajuan.length > 0 || petaDasar.length > 0) ? (
                            <>
                                <MapView
                                    ref={mapRef}
                                    style={{ flex: 1 }}
                                    region={mapRegion}
                                    mapType={mapType}
                                >
                                    {petaPengajuan.map((item, index) => (
                                        item.tipe === 'polyline' ? (
                                            <Polyline
                                                key={`pengajuan-${index}`}
                                                coordinates={item.coordinates}
                                                strokeColor="blue"
                                                strokeWidth={3}
                                            />
                                        ) : (
                                            <Polygon
                                                key={`pengajuan-${index}`}
                                                coordinates={item.coordinates}
                                                strokeColor="blue"
                                                fillColor="rgba(0,0,255,0.25)"
                                            />
                                        )
                                    ))}

                                    {petaDasar.map((item, index) => (
                                        <Polygon
                                            key={`dasar-${index}`}
                                            coordinates={item.coordinates}
                                            strokeColor="red"
                                            fillColor="rgba(255,0,0,0.2)"
                                        />
                                    ))}

                                    {/* Marker Titik-titik Koordinat */}
                                    {detailData.lokasi && detailData.lokasi.map((pt, idx) => {
                                        const lat = parseFloat(pt.lat);
                                        const lng = parseFloat(pt.lng);
                                        if (isNaN(lat) || isNaN(lng)) return null;
                                        return (
                                            <Marker
                                                key={`marker-pt-${idx}`}
                                                coordinate={{ latitude: lat, longitude: lng }}
                                                title={`Patok #${idx + 1}`}
                                                description={`Lat: ${lat}, Lng: ${lng}`}
                                                pinColor="blue"
                                            />
                                        );
                                    })}
                                </MapView>

                                {/* Floating Map Controls: Zoom & Center */}
                                <View style={localStyles.mapFloatingControls}>
                                    <TouchableOpacity style={localStyles.mapControlBtn} onPress={handleZoomIn} activeOpacity={0.75}>
                                        <Text style={localStyles.mapControlBtnText}>+</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={localStyles.mapControlBtn} onPress={handleZoomOut} activeOpacity={0.75}>
                                        <Text style={localStyles.mapControlBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={localStyles.mapControlBtn} onPress={handleResetCenter} activeOpacity={0.75}>
                                        <Text style={{ fontSize: 13 }}>🎯</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <View style={localStyles.mapLoading}>
                                {isLoading ? (
                                    <>
                                        <ActivityIndicator size="small" color="#208DC0" />
                                        <Text style={{ marginTop: 8, color: '#777', fontSize: 13 }}>Memuat peta...</Text>
                                    </>
                                ) : (
                                    <Text style={{ color: '#999', fontSize: 13 }}>Belum ada koordinat peta tersimpan</Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {/* KARTU 3: DETAIL PEMOHON */}
                <View style={localStyles.card}>
                    <Text style={localStyles.cardTitle}>👤 Detail Pemohon Usulan</Text>

                    <View style={localStyles.infoRow}>
                        <Text style={localStyles.infoLabel}>Nama Pemohon</Text>
                        <Text style={localStyles.infoValue}>{detailData.nama || '-'}</Text>
                    </View>
                    <View style={localStyles.infoRow}>
                        <Text style={localStyles.infoLabel}>NIK</Text>
                        <Text style={localStyles.infoValue}>{detailData.nik || '-'}</Text>
                    </View>
                    <View style={localStyles.infoRow}>
                        <Text style={localStyles.infoLabel}>No. Telepon</Text>
                        <Text style={localStyles.infoValue}>{detailData.no_telp || '-'}</Text>
                    </View>
                    <View style={localStyles.infoRow}>
                        <Text style={localStyles.infoLabel}>Alamat Detail</Text>
                        <Text style={localStyles.infoValue}>{detailData.alamat || '-'}</Text>
                    </View>
                    <View style={localStyles.infoRow}>
                        <Text style={localStyles.infoLabel}>RT / RW</Text>
                        <Text style={localStyles.infoValue}>{detailData.rwrt || '-'}</Text>
                    </View>
                    {detailData.catatan ? (
                        <View style={[localStyles.infoRow, { borderBottomWidth: 0 }]}>
                            <Text style={localStyles.infoLabel}>Catatan</Text>
                            <Text style={[localStyles.infoValue, { fontStyle: 'italic' }]}>{detailData.catatan}</Text>
                        </View>
                    ) : null}
                </View>

                {/* KARTU 4: DOKUMEN PENDUKUNG */}
                <View style={localStyles.card}>
                    <Text style={localStyles.cardTitle}>📎 Dokumen Pendukung</Text>

                    {detailData.file ? (
                        <View style={localStyles.docContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                                <Text style={{ fontSize: 28, marginRight: 10 }}>
                                    {getFileIcon(detailData.file)}
                                </Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.docFileName} numberOfLines={1}>
                                        {detailData.file}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                                        Lampiran berkas persyaratan
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={localStyles.docActionButton}
                                onPress={() => handleOpenDocument(detailData.file)}
                            >
                                <Text style={localStyles.docActionText}>Buka Berkas</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={localStyles.emptyDoc}>
                            <Text style={{ fontSize: 13, color: '#999' }}>Tidak ada berkas pendukung terlampir</Text>
                        </View>
                    )}
                </View>

                {/* KARTU 5: TITIK KOORDINAT & FOTO PATOK LAPANGAN */}
                <View style={localStyles.card}>
                    <View style={localStyles.cardHeaderRow}>
                        <Text style={localStyles.cardTitle}>📍 Titik Koordinat & Foto Patok</Text>
                        <View style={localStyles.countBadge}>
                            <Text style={localStyles.countBadgeText}>
                                {detailData.lokasi ? detailData.lokasi.length : 0} Titik
                            </Text>
                        </View>
                    </View>

                    {detailData.lokasi && detailData.lokasi.length > 0 ? (
                        <View style={{ marginTop: 10 }}>
                            {detailData.lokasi.map((point, index) => {
                                const photoRef = point.photo_uri || point.photo_file;
                                const fullPhotoUrl = photoRef 
                                    ? (photoRef.startsWith('http') || photoRef.startsWith('file') ? photoRef : fileBaseUrl + photoRef) 
                                    : null;

                                return (
                                    <View key={`pt-row-${index}`} style={localStyles.pointRow}>
                                        <View style={localStyles.pointIndexBadge}>
                                            <Text style={localStyles.pointIndexText}>#{index + 1}</Text>
                                        </View>

                                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                                            <Text style={localStyles.pointCoordText}>Lat: {point.lat}</Text>
                                            <Text style={localStyles.pointCoordText}>Lng: {point.lng}</Text>
                                            
                                            {fullPhotoUrl ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <View style={localStyles.photoCheckBadge}>
                                                        <Text style={localStyles.photoCheckText}>✓ Ada Foto Patok</Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <View style={localStyles.noPhotoBadge}>
                                                        <Text style={localStyles.noPhotoText}>Tanpa Foto (Excel)</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>

                                        {fullPhotoUrl ? (
                                            <TouchableOpacity 
                                                onPress={() => handleOpenPhotoModal(
                                                    fullPhotoUrl, 
                                                    `Foto Patok #${index + 1}`, 
                                                    point.lat, 
                                                    point.lng, 
                                                    index
                                                )}
                                                style={localStyles.thumbnailWrapper}
                                                activeOpacity={0.8}
                                            >
                                                <Image 
                                                    source={{ uri: fullPhotoUrl }} 
                                                    style={localStyles.thumbnailImage} 
                                                />
                                                <View style={localStyles.zoomOverlay}>
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>👁️</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={localStyles.emptyDoc}>
                            <Text style={{ fontSize: 13, color: '#999' }}>Belum ada rincian titik koordinat</Text>
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* MODAL PRATINJAU PDF */}
            <PdfWebViewModal
                isVisible={isModalVisible}
                onClose={() => setModalVisible(false)}
                pdfUrl={pdfUrl}
            />

            {/* MODAL ZOOM FOTO PATOK RESOLUSI PENUH */}
            <Modal
                visible={isPhotoModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsPhotoModalVisible(false)}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        <View style={localStyles.modalHeader}>
                            <Text style={localStyles.modalTitle} numberOfLines={1}>
                                {selectedPhoto.title || 'Foto Lapangan'}
                            </Text>
                            <TouchableOpacity 
                                onPress={() => setIsPhotoModalVisible(false)}
                                style={localStyles.modalCloseBtn}
                            >
                                <Text style={{ fontSize: 16, color: '#444', fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedPhoto.lat && selectedPhoto.lng ? (
                            <View style={localStyles.modalCoordPill}>
                                <Text style={localStyles.modalCoordText}>
                                    📍 Lat: {selectedPhoto.lat} | Lng: {selectedPhoto.lng}
                                </Text>
                            </View>
                        ) : null}

                        {selectedPhoto.uri ? (
                            <Image
                                source={{ uri: selectedPhoto.uri }}
                                style={localStyles.modalFullImage}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={{ height: 280, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#999' }}>Foto tidak dapat dimuat</Text>
                            </View>
                        )}

                        <TouchableOpacity 
                            style={localStyles.modalActionClose}
                            onPress={() => setIsPhotoModalVisible(false)}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Tutup</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL PILIH TIPE LAYER BASEMAP */}
            <Modal
                visible={showLayerModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLayerModal(false)}
            >
                <TouchableOpacity
                    style={localStyles.layerModalBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowLayerModal(false)}
                >
                    <View style={localStyles.layerModalCard}>
                        <View style={localStyles.layerModalHeader}>
                            <Text style={localStyles.layerModalTitle}>🗺️ Pilih Tipe Layer Peta</Text>
                            <TouchableOpacity onPress={() => setShowLayerModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={{ fontSize: 18, color: '#64748B', fontWeight: 'bold' }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={localStyles.layerModalDesc}>
                            Pilih tampilan peta dasar untuk melihat batas wilayah desa dengan lebih jelas:
                        </Text>

                        <TouchableOpacity
                            style={[localStyles.layerOptionRow, mapType === 'hybrid' && localStyles.layerOptionActive]}
                            onPress={() => { setMapType('hybrid'); setShowLayerModal(false); }}
                        >
                            <Text style={localStyles.layerOptionIcon}>🛰️</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[localStyles.layerOptionText, mapType === 'hybrid' && { color: '#0284C7', fontWeight: 'bold' }]}>
                                    Citra Satelit & Jalan (Hybrid)
                                </Text>
                                <Text style={localStyles.layerOptionSub}>Foto satelit lengkap dengan label nama jalan & batas wilayah</Text>
                            </View>
                            {mapType === 'hybrid' && <Text style={localStyles.checkIcon}>✓</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[localStyles.layerOptionRow, mapType === 'satellite' && localStyles.layerOptionActive]}
                            onPress={() => { setMapType('satellite'); setShowLayerModal(false); }}
                        >
                            <Text style={localStyles.layerOptionIcon}>🌍</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[localStyles.layerOptionText, mapType === 'satellite' && { color: '#0284C7', fontWeight: 'bold' }]}>
                                    Citra Satelit Murni
                                </Text>
                                <Text style={localStyles.layerOptionSub}>Foto udara resolusi tinggi tanpa overlay teks/vektor</Text>
                            </View>
                            {mapType === 'satellite' && <Text style={localStyles.checkIcon}>✓</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[localStyles.layerOptionRow, mapType === 'standard' && localStyles.layerOptionActive]}
                            onPress={() => { setMapType('standard'); setShowLayerModal(false); }}
                        >
                            <Text style={[localStyles.layerOptionIcon]}>🗺️</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[localStyles.layerOptionText, mapType === 'standard' && { color: '#0284C7', fontWeight: 'bold' }]}>
                                    Peta Jalan Vektor (Standar)
                                </Text>
                                <Text style={localStyles.layerOptionSub}>Peta skematik jalan Google Maps, hemat kuota data</Text>
                            </View>
                            {mapType === 'standard' && <Text style={localStyles.checkIcon}>✓</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[localStyles.layerOptionRow, mapType === 'terrain' && localStyles.layerOptionActive]}
                            onPress={() => { setMapType('terrain'); setShowLayerModal(false); }}
                        >
                            <Text style={localStyles.layerOptionIcon}>⛰️</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[localStyles.layerOptionText, mapType === 'terrain' && { color: '#0284C7', fontWeight: 'bold' }]}>
                                    Kontur Medan (Terrain)
                                </Text>
                                <Text style={localStyles.layerOptionSub}>Menampilkan topografi, kontur elevasi, dan perbukitan</Text>
                            </View>
                            {mapType === 'terrain' && <Text style={localStyles.checkIcon}>✓</Text>}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <TabBar />
        </View>
    );
};

const localStyles = StyleSheet.create({
    headerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 15,
        marginTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#208DC0',
    },
    desaTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    kecamatanSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3,
    },
    badgeContainer: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
    },
    actionBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 12,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    actionBoxTop: {
        marginBottom: 10,
    },
    actionBoxTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    actionBoxSubtitle: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    actionButtonsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailEditBtn: {
        flex: 1,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    detailEditBtnText: {
        color: '#1D4ED8',
        fontWeight: 'bold',
        fontSize: 13,
    },
    detailDeleteBtn: {
        flex: 1,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 8,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailDeleteBtnText: {
        color: '#DC2626',
        fontWeight: 'bold',
        fontSize: 13,
    },
    verifiedNoticeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 10,
        padding: 12,
        marginTop: 14,
    },
    verifiedNoticeTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#15803D',
    },
    verifiedNoticeSub: {
        fontSize: 11,
        color: '#166534',
        marginTop: 2,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 15,
        marginHorizontal: 15,
        marginTop: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    fullMapButton: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    fullMapText: {
        color: '#0284C7',
        fontSize: 12,
        fontWeight: 'bold',
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    legendColor: {
        width: 14,
        height: 14,
        borderRadius: 3,
        borderWidth: 1,
        marginRight: 6,
    },
    legendText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
    },
    mapWrapper: {
        height: 280,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginTop: 4,
    },
    mapLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    infoLabel: {
        fontSize: 12,
        color: '#64748B',
        flex: 1,
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1.5,
        textAlign: 'right',
    },
    docContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        marginTop: 10,
    },
    docFileName: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    docActionButton: {
        backgroundColor: '#208DC0',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 6,
    },
    docActionText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyDoc: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadge: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    countBadgeText: {
        color: '#0369A1',
        fontSize: 11,
        fontWeight: 'bold',
    },
    pointRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    pointIndexBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pointIndexText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#475569',
    },
    pointCoordText: {
        fontSize: 12,
        color: '#334155',
        fontFamily: 'monospace',
    },
    photoCheckBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    photoCheckText: {
        fontSize: 10,
        color: '#15803D',
        fontWeight: '600',
    },
    noPhotoBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    noPhotoText: {
        fontSize: 10,
        color: '#64748B',
    },
    thumbnailWrapper: {
        width: 56,
        height: 56,
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        position: 'relative',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    zoomOverlay: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 3,
        paddingHorizontal: 3,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1E293B',
        flex: 1,
        marginRight: 10,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalCoordPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    modalCoordText: {
        fontSize: 11,
        color: '#475569',
        fontFamily: 'monospace',
    },
    modalFullImage: {
        width: '100%',
        height: 320,
        borderRadius: 8,
        backgroundColor: '#000',
    },
    modalActionClose: {
        backgroundColor: '#208DC0',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        marginTop: 14,
    },
    layerButton: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    layerButtonText: {
        fontSize: 11,
        color: '#0284C7',
        fontWeight: 'bold',
    },
    mapFloatingControls: {
        position: 'absolute',
        right: 12,
        bottom: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderRadius: 8,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 4,
        alignItems: 'center',
    },
    mapControlBtn: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E2E8F0',
    },
    mapControlBtnText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#334155',
        lineHeight: 20,
    },
    layerModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    layerModalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 34,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    layerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    layerModalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    layerModalDesc: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 16,
    },
    layerOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    layerOptionActive: {
        backgroundColor: '#F0F9FF',
        borderColor: '#0284C7',
    },
    layerOptionIcon: {
        fontSize: 22,
        marginRight: 12,
    },
    layerOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
    },
    layerOptionSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    checkIcon: {
        fontSize: 16,
        color: '#0284C7',
        fontWeight: 'bold',
        marginLeft: 8,
    },
});

//make this component available to the app
export default Zona;
