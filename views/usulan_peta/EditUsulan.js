import React, { useState } from 'react';
import styles from '../assets/style';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ImageBackground,
    Alert,
    StyleSheet,
    ActivityIndicator
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import FastImage from 'react-native-fast-image';
import TabBar from '../components/TabBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { parseGeoFileFromUri, downsampleCoordinates } from '../library/GeoFileParser';
import TrackDB from '../library/TrackDB';

const EditUsulan = ({ route, navigation }) => {
    const {
        id_usulan, nik, nama, alamat, id_kecamatan,
        nama_kecamatan, id_des_kel, nama_des_kel,
        rwrt, no_telp, catatan, lokasi, file, tipe
    } = route.params || {};

    const TOKEN = useSelector(state => state.TOKEN);
    const PROFILE = useSelector(state => state.PROFILE);
    const URL = useSelector(state => state.URL);

    // Parse lokasi awal dengan aman
    let parsedLokasi = [];
    try {
        if (typeof lokasi === 'string') {
            parsedLokasi = JSON.parse(lokasi);
        } else if (Array.isArray(lokasi)) {
            parsedLokasi = lokasi;
        }
    } catch (e) {
        parsedLokasi = [];
    }

    const [form, setForm] = useState({
        id: id_usulan,
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
        lokasi: parsedLokasi,
        tipe: tipe || 'polygon',
        file: file || '', 
        file_old: file || ''
    });

    const [fileName, setFileName] = useState(null);
    const [geoFileName, setGeoFileName] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeoParsing, setIsGeoParsing] = useState(false);

    // Helper centroid
    const calculateCentroid = (locations) => {
        if (!locations || locations.length === 0) return { lat: 0, lng: 0 };
        let totalLat = 0;
        let totalLng = 0;
        locations.forEach((loc) => {
            totalLat += parseFloat(loc.lat || 0);
            totalLng += parseFloat(loc.lng || 0);
        });
        return {
            lat: totalLat / locations.length,
            lng: totalLng / locations.length,
        };
    };

    // Upload dokumen pendukung
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

    // Impor data geospasial KML / GPX / KMZ
    const handleGeoFileUpload = () => {
        Alert.alert(
            'Ubah / Impor Geometri Spasial',
            'Pilih metode untuk mengimpor atau memperbarui koordinat batas desa:',
            [
                {
                    text: '📁 Unggah Berkas KML / GPX / KMZ',
                    onPress: () => pickGeoFile(),
                },
                {
                    text: '🛤 Ambil dari Riwayat Survei GPS',
                    onPress: () => pickFromTrackHistory(),
                },
                { text: 'Batal', style: 'cancel' },
            ]
        );
    };

    const pickGeoFile = async () => {
        try {
            const result = await DocumentPicker.pickSingle({
                type: [DocumentPicker.types.allFiles],
            });

            if (!result?.uri) return;

            const fname = result.name || '';
            const lower = fname.toLowerCase();
            const validExts = ['.kml', '.kmz', '.gpx', '.geojson', '.json', '.xml'];
            const isValid = validExts.some(ext => lower.endsWith(ext));

            if (!isValid) {
                Alert.alert(
                    'Format Berkas Tidak Didukung',
                    'Hanya berkas berformat .kml, .kmz, .gpx, atau .geojson yang didukung untuk data spasial.'
                );
                return;
            }

            setIsGeoParsing(true);
            const parsed = await parseGeoFileFromUri(result.uri, fname);
            setIsGeoParsing(false);

            if (!parsed.success) {
                Alert.alert('Gagal Mengurai Berkas', parsed.error || 'Tidak ditemukan koordinat yang valid.');
                return;
            }

            setForm((prev) => ({
                ...prev,
                lokasi: parsed.points,
                tipe: 'polygon',
            }));
            setGeoFileName(fname);

            Alert.alert(
                '✅ Berhasil Mengimpor Geometri',
                `Berhasil memperbarui ${parsed.points.length} titik koordinat (${parsed.format}) dari berkas "${fname}".`
            );
        } catch (err) {
            setIsGeoParsing(false);
            if (!DocumentPicker.isCancel(err)) {
                Alert.alert('Error', 'Gagal memilih berkas: ' + (err.message || 'Terjadi kesalahan'));
            }
        }
    };

    const pickFromTrackHistory = async () => {
        try {
            const tracks = await TrackDB.getAllTracks();
            if (!tracks || tracks.length === 0) {
                Alert.alert(
                    'Belum Ada Riwayat Survei',
                    'Belum ada rekaman jejak GPS yang tersimpan di perangkat ini.'
                );
                return;
            }

            const options = tracks.slice(0, 5).map((tr) => ({
                text: `${tr.label} (${tr.waypoints?.length || 0} ttk)`,
                onPress: () => {
                    if (!tr.waypoints || tr.waypoints.length < 3) {
                        Alert.alert('Data Kurang', 'Trek ini memiliki kurang dari 3 titik koordinat untuk membentuk poligon.');
                        return;
                    }

                    const rawPoints = tr.waypoints.map((w) => ({
                        lat: parseFloat(w.lat).toFixed(7),
                        lng: parseFloat(w.lon).toFixed(7),
                        photo_uri: null,
                        photo_file: null,
                    }));

                    const sampled = downsampleCoordinates(rawPoints);

                    setForm((prev) => ({
                        ...prev,
                        lokasi: sampled,
                        tipe: 'polygon',
                    }));
                    setGeoFileName(`Survei: ${tr.label}`);

                    Alert.alert(
                        '✅ Berhasil Mengimpor Jejak',
                        `Berhasil menerapkan ${sampled.length} titik koordinat dari riwayat survei "${tr.label}".`
                    );
                },
            }));

            Alert.alert('Pilih Rekaman Survei', 'Pilih rekaman jejak batas untuk diterapkan pada usulan ini:', [
                ...options,
                { text: 'Batal', style: 'cancel' },
            ]);
        } catch (err) {
            Alert.alert('Error', 'Gagal membaca riwayat survei: ' + err.message);
        }
    };

    const handleSubmit = async () => {
        if (!form.nama || !form.nik) {
            Alert.alert('Perhatian', 'Nama pemohon dan NIK wajib diisi.');
            return;
        }

        if (!form.lokasi || form.lokasi.length === 0) {
            Alert.alert('Perhatian', 'Titik koordinat batas wilayah wajib ada.');
            return;
        }

        try {
            setIsSubmitting(true);
            const formData = new FormData();
        
            formData.append('id', form.id);
            formData.append('nik', form.nik);
            formData.append('nama', form.nama);
            formData.append('alamat', form.alamat);
            formData.append('no_telp', form.no_telp);
            formData.append('rwrt', form.rwrt);
            formData.append('catatan', form.catatan);
            formData.append('file_old', form.file_old || '');
            formData.append('status_pengajuan', 1); // Reset kembali ke 1 (Menunggu)
            
            // Geometri dan metode
            formData.append('lokasi', JSON.stringify(form.lokasi));
            formData.append('marker', JSON.stringify(calculateCentroid(form.lokasi)));
            formData.append('tipe', form.tipe || 'polygon');
        
            // File baru jika user mengunggah pengganti
            if (form.file && form.file.uri) {
                formData.append('file', {
                    uri: form.file.uri,
                    name: form.file.name || 'berkas_usulan.pdf',
                    type: form.file.type || 'application/pdf',
                });
            }
        
            const response = await fetch(URL.URL_ADD_ZONA + "editDatax", {
                method: 'POST',
                headers: {
                    Authorization: "kikensbatara " + TOKEN,
                },
                body: formData,
            });
        
            if (response.ok) {
                // Bersihkan cache usulan lokal agar sinkron langsung
                const cacheKey = `@usulan_cache_${PROFILE?.id || 'user'}`;
                await AsyncStorage.removeItem(cacheKey);

                Alert.alert(
                    'Berhasil Diperbarui',
                    'Perubahan data pengajuan dan metode geometri berhasil disimpan. Status usulan kini menjadi "Menunggu Verifikasi".',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack()
                        }
                    ],
                    { cancelable: false }
                );
            } else {
                const errorText = await response.text();
                console.error('Error Response:', errorText);
                Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui data di server.');
            }
        } catch (error) {
            console.error('Error submitting data:', error);
            Alert.alert('Error', 'Terjadi kesalahan jaringan saat memperbarui data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header Top Nav */}
            <View style={styles.navTop}>
                <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()}>
                    <FastImage 
                        style={styles.backIcon}
                        source={require('../assets/img/chevron-left.png')}
                        resizeMode={FastImage.resizeMode.contain}
                    />
                </TouchableOpacity>
                
                <View style={styles.top2}>
                    <Text style={styles.headerTitle}>Edit Pengajuan Usulan</Text>
                </View>

                <View style={styles.top3} />
            </View>

            <View style={styles.body}>
                <ImageBackground
                    source={require('../assets/img/bgbg.jpg')}
                    style={styles.background}
                    resizeMode="cover"
                >
                    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
                        {/* Info Wilayah Read-only */}
                        <View style={localStyles.infoBanner}>
                            <Text style={localStyles.infoBannerTitle}>📍 Wilayah Desa Pengusul</Text>
                            <Text style={localStyles.infoBannerText}>
                                {form.nama_des_kel || 'Desa'} • Kec. {form.nama_kecamatan || 'Kecamatan'}
                            </Text>
                            <Text style={localStyles.infoBannerNote}>
                                Wilayah desa pengusul terikat secara otomatis pada akun operator desa Anda.
                            </Text>
                        </View>

                        {/* KARTU 1: Informasi Pemohon */}
                        <View style={localStyles.card}>
                            <Text style={localStyles.cardHeader}>👤 Informasi Pemohon</Text>

                            <Text style={localStyles.label}>NIK</Text>
                            <TextInput
                                style={localStyles.input}
                                value={form.nik}
                                onChangeText={text => setForm(prev => ({ ...prev, nik: text }))}
                                keyboardType="numeric"
                                maxLength={16}
                                placeholder="Nomor Induk Kependudukan (16 digit)"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={localStyles.label}>Nama Pemohon</Text>
                            <TextInput
                                style={localStyles.input}
                                value={form.nama}
                                onChangeText={text => setForm(prev => ({ ...prev, nama: text }))}
                                placeholder="Nama lengkap pemohon"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={localStyles.label}>Nomor Telepon / WhatsApp</Text>
                            <TextInput
                                style={localStyles.input}
                                value={form.no_telp}
                                onChangeText={text => setForm(prev => ({ ...prev, no_telp: text }))}
                                keyboardType="phone-pad"
                                placeholder="Contoh: 08123456789"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={localStyles.label}>Alamat Lengkap</Text>
                            <TextInput
                                style={[localStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                                value={form.alamat}
                                onChangeText={text => setForm(prev => ({ ...prev, alamat: text }))}
                                multiline
                                placeholder="Alamat domisili pemohon"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={localStyles.label}>RT / RW</Text>
                            <TextInput
                                style={localStyles.input}
                                value={form.rwrt}
                                onChangeText={text => setForm(prev => ({ ...prev, rwrt: text }))}
                                placeholder="Contoh: RT 01 / RW 02"
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={localStyles.label}>Catatan Tambahan</Text>
                            <TextInput
                                style={[localStyles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                                value={form.catatan}
                                onChangeText={text => setForm(prev => ({ ...prev, catatan: text }))}
                                multiline
                                placeholder="Keterangan perbaikan usulan..."
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        {/* KARTU 2: Metode & Pemetaan Koordinat Batas */}
                        <View style={localStyles.card}>
                            <Text style={localStyles.cardHeader}>🗺️ Metode Pemetaan Batas Desa</Text>
                            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
                                Anda dapat mengganti atau memperbarui titik koordinat dan metode pemetaan batas desa:
                            </Text>

                            <View style={localStyles.methodRow}>
                                <TouchableOpacity 
                                    style={[
                                        localStyles.methodBtn, 
                                        form.tipe === 'polygon' ? localStyles.methodBtnActivePolygon : localStyles.methodBtnInactive
                                    ]}
                                    onPress={() => navigation.navigate('MetodeText', { 
                                        lokasiAwal: form.lokasi || [],
                                        onLokasiUpdate: (updatedLokasi) => {
                                            setForm(prev => ({
                                                ...prev,
                                                lokasi: updatedLokasi,
                                                tipe: 'polygon'
                                            }));
                                        }
                                    })}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[localStyles.methodBtnTitle, form.tipe === 'polygon' && { color: '#fff' }]}>
                                        📍 POLYGON
                                    </Text>
                                    <Text style={[localStyles.methodBtnSub, form.tipe === 'polygon' && { color: 'rgba(255,255,255,0.85)' }]}>
                                        Area Batas Wilayah
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[
                                        localStyles.methodBtn, 
                                        form.tipe === 'polyline' ? localStyles.methodBtnActivePolyline : localStyles.methodBtnInactive
                                    ]}
                                    onPress={() => navigation.navigate('MetodePolyline', { 
                                        lokasiAwal: form.lokasi || [],
                                        onLokasiUpdate: (updatedLokasi) => {
                                            setForm(prev => ({
                                                ...prev,
                                                lokasi: updatedLokasi,
                                                tipe: 'polyline'
                                            }));
                                        }
                                    })}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[localStyles.methodBtnTitle, form.tipe === 'polyline' && { color: '#fff' }]}>
                                        〰️ POLYLINE
                                    </Text>
                                    <Text style={[localStyles.methodBtnSub, form.tipe === 'polyline' && { color: 'rgba(255,255,255,0.85)' }]}>
                                        Garis Batas Jalan/Sungai
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Tombol Impor KML / GPX */}
                            <TouchableOpacity 
                                style={localStyles.uploadGeoButton}
                                onPress={handleGeoFileUpload}
                                activeOpacity={0.85}
                            >
                                <Text style={{ fontSize: 24 }}>📁</Text>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={localStyles.uploadGeoTitle}>UNGGAH KML / GPX / KMZ</Text>
                                    <Text style={localStyles.uploadGeoSub}>Impor ulang berkas spasial GIS atau jejak survei GPS</Text>
                                </View>
                                <Text style={{ fontSize: 18, color: '#0284C7', fontWeight: 'bold' }}>›</Text>
                            </TouchableOpacity>

                            {/* Indikator Status Lokasi Tersimpan */}
                            {form.lokasi && form.lokasi.length > 0 ? (
                                <View style={localStyles.statusLokasiBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, marginRight: 6 }}>✅</Text>
                                        <Text style={localStyles.statusLokasiText}>
                                            Tersimpan {form.lokasi.length} titik koordinat ({form.tipe === 'polyline' ? 'Polyline' : 'Polygon'})
                                        </Text>
                                    </View>
                                    {geoFileName ? (
                                        <Text style={localStyles.geoFileNameBadge}>
                                            📁 Sumber: {geoFileName}
                                        </Text>
                                    ) : null}
                                    <TouchableOpacity
                                        onPress={() => {
                                            const targetScreen = form.tipe === 'polyline' ? 'MetodePolyline' : 'MetodeText';
                                            navigation.navigate(targetScreen, { 
                                                lokasiAwal: form.lokasi || [],
                                                onLokasiUpdate: (updatedLokasi) => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        lokasi: updatedLokasi,
                                                    }));
                                                }
                                            });
                                        }}
                                        style={localStyles.reviewLocationBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={localStyles.reviewLocationBtnText}>
                                            👁️ Tinjau / Edit Titik Koordinat & Foto di Peta
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={localStyles.emptyLocationBox}>
                                    <Text style={{ fontSize: 12, color: '#EF4444' }}>
                                        ⚠️ Belum ada koordinat pemetaan tersimpan. Silakan pilih salah satu metode di atas.
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* KARTU 3: Berkas Dokumen Pendukung */}
                        <View style={localStyles.card}>
                            <Text style={localStyles.cardHeader}>📎 Berkas Dokumen Pendukung</Text>
                            
                            {form.file_old ? (
                                <View style={localStyles.currentFileBox}>
                                    <Text style={localStyles.currentFileLabel}>Berkas Tersimpan Saat Ini:</Text>
                                    <Text style={localStyles.currentFileName} numberOfLines={1}>
                                        📄 {form.file_old}
                                    </Text>
                                </View>
                            ) : null}

                            <TouchableOpacity 
                                onPress={handleFileUpload} 
                                style={localStyles.uploadBtn}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.uploadBtnIcon}>📁</Text>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={localStyles.uploadBtnText}>
                                        {fileName ? fileName : 'Pilih Berkas Baru (Opsional)'}
                                    </Text>
                                    <Text style={localStyles.uploadBtnSub}>
                                        {fileName ? 'Berkas baru siap diunggah' : 'Ketuk untuk mengganti dokumen pengajuan'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Tombol Simpan Perubahan */}
                        <TouchableOpacity 
                            style={[localStyles.submitBtn, (isSubmitting || isGeoParsing) && { opacity: 0.6 }]} 
                            onPress={handleSubmit}
                            disabled={isSubmitting || isGeoParsing}
                            activeOpacity={0.8}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={localStyles.submitBtnText}>💾 Simpan Perubahan Usulan</Text>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </ImageBackground>
            </View>

            <TabBar />
        </View>
    );
};

export default EditUsulan;

const localStyles = StyleSheet.create({
    infoBanner: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    infoBannerTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1D4ED8',
    },
    infoBannerText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginTop: 2,
    },
    infoBannerNote: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
        marginTop: 6,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1E293B',
        marginBottom: 8,
    },
    methodRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    methodBtn: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        marginRight: 6,
    },
    methodBtnActivePolygon: {
        backgroundColor: '#208DC0',
        borderColor: '#0284C7',
    },
    methodBtnActivePolyline: {
        backgroundColor: '#0D9488',
        borderColor: '#0F766E',
    },
    methodBtnInactive: {
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
    },
    methodBtnTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#334155',
    },
    methodBtnSub: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 2,
    },
    uploadGeoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    uploadGeoTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0369A1',
    },
    uploadGeoSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    statusLokasiBox: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 10,
        padding: 12,
    },
    statusLokasiText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#15803D',
        flex: 1,
    },
    geoFileNameBadge: {
        fontSize: 11,
        color: '#166534',
        fontWeight: '600',
        marginTop: 4,
    },
    reviewLocationBtn: {
        marginTop: 10,
        backgroundColor: '#208DC0',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    reviewLocationBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    emptyLocationBox: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 10,
        padding: 12,
    },
    currentFileBox: {
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    currentFileLabel: {
        fontSize: 11,
        color: '#64748B',
    },
    currentFileName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginTop: 2,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderWidth: 1.5,
        borderColor: '#BAE6FD',
        borderStyle: 'dashed',
        borderRadius: 10,
        padding: 14,
        marginTop: 4,
    },
    uploadBtnIcon: {
        fontSize: 24,
    },
    uploadBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0284C7',
    },
    uploadBtnSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    submitBtn: {
        backgroundColor: '#208DC0',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#208DC0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
        marginTop: 4,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
