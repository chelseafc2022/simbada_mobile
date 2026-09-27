import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Image,
    FlatList,
    Modal,
    StatusBar,
    Dimensions,
    PermissionsAndroid,
    Platform
} from 'react-native';
import FastImage from "react-native-fast-image";
import Geolocation from '@react-native-community/geolocation'; 
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import TabBar from '../components/TabBar';
import StreetViewModal from '../components/StreetViewModal';
import PlacemarkDB from '../library/PlacemarkDB';
import styles from '../assets/style';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── UTILITY: Konversi & Luas Geodesik ─────────────────────────────────────────
const toRad = (deg) => (deg * Math.PI) / 180;

const calcGeodesicArea = (coords) => {
    if (!coords || coords.length < 3) return { m2: 0, ha: 0 };
    const R = 6371009;
    let area = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % n];
        const lat1 = parseFloat(p1.latitude ?? p1.lat);
        const lon1 = parseFloat(p1.longitude ?? p1.lng);
        const lat2 = parseFloat(p2.latitude ?? p2.lat);
        const lon2 = parseFloat(p2.longitude ?? p2.lng);
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) continue;
        area += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
    }
    const m2 = Math.abs((area * R * R) / 2);
    return { m2: Math.round(m2), ha: parseFloat((m2 / 10000).toFixed(4)) };
};

const calcPolylineLength = (coords) => {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    const R = 6371009;
    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const lat1 = parseFloat(p1.latitude ?? p1.lat);
        const lon1 = parseFloat(p1.longitude ?? p1.lng);
        const lat2 = parseFloat(p2.latitude ?? p2.lat);
        const lon2 = parseFloat(p2.longitude ?? p2.lng);
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) continue;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        total += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return Math.round(total);
};

const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`);

// ── UTILITY: Generator Ekspor Excel & CSV ─────────────────────────────────────
const generateExcelHtml = (coords, label = 'Format_EXCEL') => {
    const rows = coords.map((c, i) => {
        const lat = c.latitude !== undefined ? c.latitude : (c.lat !== undefined ? c.lat : '');
        const lng = c.longitude !== undefined ? c.longitude : (c.lng !== undefined ? c.lng : '');
        const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        return `    <tr style="background-color: ${bg};">
      <td style="padding: 8px 24px; border: 1px solid #CBD5E1; text-align: center; font-family: Calibri, Arial, sans-serif; font-size: 11pt;">${lat}</td>
      <td style="padding: 8px 24px; border: 1px solid #CBD5E1; text-align: center; font-family: Calibri, Arial, sans-serif; font-size: 11pt;">${lng}</td>
    </tr>`;
    }).join('\n');

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${label}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    .excel-title {
      font-family: Calibri, Arial, sans-serif;
      font-size: 13pt;
      font-weight: bold;
      color: #334155;
      padding: 6px 0;
    }
    table {
      border-collapse: collapse;
      margin-top: 4px;
    }
    th {
      background-color: #BAE6FD;
      color: #0369A1;
      font-family: Calibri, Arial, sans-serif;
      font-weight: bold;
      font-size: 11pt;
      text-align: center;
      padding: 10px 24px;
      border: 1px solid #7DD3FC;
    }
  </style>
</head>
<body>
  <div class="excel-title">Format EXCEL</div>
  <table>
    <thead>
      <tr>
        <th>lat</th>
        <th>lng</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
};

const generateCsvContent = (coords) => {
    const lines = ['lat,lng'];
    coords.forEach((c) => {
        const lat = c.latitude !== undefined ? c.latitude : (c.lat !== undefined ? c.lat : '');
        const lng = c.longitude !== undefined ? c.longitude : (c.lng !== undefined ? c.lng : '');
        lines.push(`${lat},${lng}`);
    });
    return lines.join('\r\n');
};

// ── KOMPONEN KARTU KOORDINAT LIST ─────────────────────────────────────────────
const CoordinateCard = React.memo(({ item, index, onSelectPoint, onDeletePoint, onOpenStreetView, takePhotoForPoint, previewPhoto, isSelected }) => {
    return (
        <TouchableOpacity
            style={[localStyles.card, isSelected && localStyles.cardSelected]}
            onPress={() => onSelectPoint(index)}
            activeOpacity={0.85}
        >
            <View style={localStyles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[localStyles.pointBadge, isSelected && { backgroundColor: '#0284C7' }]}>
                        <Text style={localStyles.pointBadgeText}>{index + 1}</Text>
                    </View>
                    <Text style={localStyles.cardTitle}>Titik {index + 1}</Text>
                    {item.is_patok ? (
                        <View style={localStyles.hasPatokBadge}>
                            <Text style={localStyles.hasPatokText}>🚩 {item.patok_name || 'Patok'}</Text>
                        </View>
                    ) : null}
                    {item.photo_uri ? (
                        <View style={localStyles.hasPhotoBadge}>
                            <Text style={localStyles.hasPhotoText}>✓ Foto (Opsional)</Text>
                        </View>
                    ) : null}
                </View>

                {/* Tombol Aksi di Header Kartu */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => onOpenStreetView && onOpenStreetView(item, index + 1)}
                        style={localStyles.btnCardStreet}
                    >
                        <Text style={localStyles.btnCardStreetText}>🚶‍♂️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onSelectPoint(index)}
                        style={localStyles.btnCardEdit}
                    >
                        <Text style={localStyles.btnCardEditText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onDeletePoint(index)}
                        style={localStyles.btnCardDelete}
                    >
                        <Text style={localStyles.btnCardDeleteText}>🗑️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Thumbnail Preview jika ada foto */}
            {item.photo_uri && (
                <TouchableOpacity 
                    onPress={() => previewPhoto(item.photo_uri, index + 1)}
                    style={localStyles.thumbnailContainer}
                >
                    <Image source={{ uri: item.photo_uri }} style={localStyles.thumbnailImg} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0369A1' }}>Foto Patok Tersimpan</Text>
                        <Text style={{ fontSize: 9, color: '#64748B' }}>Ketuk untuk memperbesar</Text>
                    </View>
                    <Text style={{ fontSize: 13 }}>🔍</Text>
                </TouchableOpacity>
            )}

            {/* Informasi Koordinat */}
            <View style={localStyles.coordRow}>
                <Text style={localStyles.coordLabel}>Lat:</Text>
                <Text style={localStyles.coordVal}>{item.lat}</Text>
                <Text style={[localStyles.coordLabel, { marginLeft: 12 }]}>Lng:</Text>
                <Text style={localStyles.coordVal}>{item.lng}</Text>
            </View>
        </TouchableOpacity>
    );
});

// ── KOMPONEN UTAMA METODE TEXT / PEMETAAN POLYGON ─────────────────────────────
const MetodeText = ({ navigation, route }) => {
    const { lokasiAwal, onLokasiUpdate } = route.params || {};
    const insets = useSafeAreaInsets();
    const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 44) + 12;

    // Standardisasi format titik awal
    const parsedInitial = useMemo(() => {
        if (!lokasiAwal) return [];
        if (typeof lokasiAwal === 'string') {
            try { return JSON.parse(lokasiAwal); } catch (e) { return []; }
        }
        return Array.isArray(lokasiAwal) ? lokasiAwal : [];
    }, [lokasiAwal]);

    const [lokasi, setLokasi] = useState(parsedInitial);
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawMode, setIsDrawMode] = useState(true); // Default ON agar bisa langsung gambar
    const [mapType, setMapType] = useState('hybrid'); // hybrid, standard, satellite
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [activeTab, setActiveTab] = useState('map'); // 'map' | 'list'
    const [selectedPointIndex, setSelectedPointIndex] = useState(null);

    // Street View State
    const [streetViewVisible, setStreetViewVisible] = useState(false);
    const [streetViewCoord, setStreetViewCoord] = useState(null);
    const [streetViewTitle, setStreetViewTitle] = useState('Street View 360°');
    const [isPegmanMode, setIsPegmanMode] = useState(false);

    const openStreetView = (coord, title = 'Street View 360°') => {
        if (!coord) return;
        setStreetViewCoord(coord);
        setStreetViewTitle(title);
        setStreetViewVisible(true);
    };

    // Modal Edit Titik Tertentu
    const [pointModalVisible, setPointModalVisible] = useState(false);
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');

    // Modal Preview Foto Patok
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [previewImageUri, setPreviewImageUri] = useState(null);
    const [previewPointIndex, setPreviewPointIndex] = useState(null);

    const mapViewRef = useRef(null);
    const isMounted = useRef(true);

    const TOKEN = useSelector(state => state.TOKEN);
    const PROFILE = useSelector(state => state.PROFILE);
    const URL = useSelector(state => state.URL);

    const desKelId = route.params?.des_kel_id || route.params?.id_des_kel || PROFILE?.profile?.id_desa || PROFILE?.profile?.id_kelurahan;
    const namaDesa = route.params?.nama_des_kel || PROFILE?.profile?.nama_desa || PROFILE?.profile?.nama_kelurahan;

    const [petaDasarCoords, setPetaDasarCoords] = useState([]);
    const [showPetaDasar, setShowPetaDasar] = useState(true);

    // Integrasi Patok Lapangan Mandiri (PlacemarkDB dari menu Home)
    const [isPatokMode, setIsPatokMode] = useState(false);
    const [existingPatokList, setExistingPatokList] = useState([]);
    const [showExistingPatok, setShowExistingPatok] = useState(true);

    const [region, setRegion] = useState({
        latitude: -4.3332916,
        longitude: 122.2788887,
        latitudeDelta: 0.05,
        longitudeDelta: 0.03,
    });

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // ── FETCH POLIGON PETA DASAR DESA SEBAGAI REFERENSI SAMAR ─────────────────
    useEffect(() => {
        let cancel = false;
        const loadPetaDasar = async () => {
            if (!desKelId) return;
            try {
                const urlApp = URL?.URL_APP || 'http://103.23.198.113:3000/';
                const formattedDesKelId = String(desKelId).split('.').map(p => p.padStart(2, '0')).join('.');

                let response = await fetch(`${urlApp}api/v1/monitoring/petadasar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `kikensbatara ${TOKEN}`
                    },
                    body: JSON.stringify({ des_kel_id: formattedDesKelId })
                });
                let result = await response.json();

                // Jika format padded tidak menghasilkan data, coba dengan desKelId asli
                if ((!result || !result[0]?.data1?.length) && formattedDesKelId !== String(desKelId)) {
                    const fallbackRes = await fetch(`${urlApp}api/v1/monitoring/petadasar`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `kikensbatara ${TOKEN}`
                        },
                        body: JSON.stringify({ des_kel_id: desKelId })
                    });
                    const fallbackResult = await fallbackRes.json();
                    if (fallbackResult && fallbackResult[0]?.data1?.length) {
                        result = fallbackResult;
                    }
                }
                if (cancel) return;

                const ringsList = [];
                if (result && result.length > 0 && result[0]?.data1) {
                    result[0].data1.forEach((item) => {
                        if (item?.geometry?.coordinates) {
                            const raw = item.geometry.coordinates;
                            if (Array.isArray(raw)) {
                                if (Array.isArray(raw[0]) && Array.isArray(raw[0][0]) && typeof raw[0][0][0] === 'number') {
                                    raw.forEach(ring => {
                                        const parsed = ring.map(c => ({
                                            latitude: parseFloat(c[1]),
                                            longitude: parseFloat(c[0])
                                        })).filter(c => !isNaN(c.latitude) && !isNaN(c.longitude));
                                        if (parsed.length >= 3) ringsList.push(parsed);
                                    });
                                } else if (Array.isArray(raw[0]) && typeof raw[0][0] === 'number') {
                                    const parsed = raw.map(c => ({
                                        latitude: parseFloat(c[1]),
                                        longitude: parseFloat(c[0])
                                    })).filter(c => !isNaN(c.latitude) && !isNaN(c.longitude));
                                    if (parsed.length >= 3) ringsList.push(parsed);
                                } else if (Array.isArray(raw[0]) && Array.isArray(raw[0][0]) && Array.isArray(raw[0][0][0])) {
                                    raw.forEach(poly => {
                                        poly.forEach(ring => {
                                            const parsed = ring.map(c => ({
                                                latitude: parseFloat(c[1]),
                                                longitude: parseFloat(c[0])
                                            })).filter(c => !isNaN(c.latitude) && !isNaN(c.longitude));
                                            if (parsed.length >= 3) ringsList.push(parsed);
                                        });
                                    });
                                }
                            }
                        }
                    });
                } else if (Array.isArray(result)) {
                    result.forEach(item => {
                        if (Array.isArray(item?.lokasi?.coordinat) && item.lokasi.coordinat.length >= 3) {
                            const parsed = item.lokasi.coordinat.map(c => ({
                                latitude: parseFloat(c.lat),
                                longitude: parseFloat(c.lng)
                            })).filter(c => !isNaN(c.latitude) && !isNaN(c.longitude));
                            if (parsed.length >= 3) ringsList.push(parsed);
                        }
                    });
                }

                if (ringsList.length > 0) {
                    setPetaDasarCoords(ringsList);
                    // Jika belum ada titik gambar yang dibuat, pusatkan peta ke batas peta dasar desa
                    if (parsedInitial.length === 0 && mapViewRef.current && ringsList[0].length > 0) {
                        const pts = ringsList[0];
                        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                        pts.forEach(p => {
                            if (p.latitude < minLat) minLat = p.latitude;
                            if (p.latitude > maxLat) maxLat = p.latitude;
                            if (p.longitude < minLng) minLng = p.longitude;
                            if (p.longitude > maxLng) maxLng = p.longitude;
                        });
                        const cLat = (minLat + maxLat) / 2;
                        const cLng = (minLng + maxLng) / 2;
                        const latD = Math.max(0.015, (maxLat - minLat) * 1.3);
                        const lngD = Math.max(0.015, (maxLng - minLng) * 1.3);
                        setRegion({
                            latitude: cLat,
                            longitude: cLng,
                            latitudeDelta: latD,
                            longitudeDelta: lngD,
                        });
                        mapViewRef.current.animateToRegion({
                            latitude: cLat,
                            longitude: cLng,
                            latitudeDelta: latD,
                            longitudeDelta: lngD,
                        }, 800);
                    }
                }
            } catch (err) {
                console.warn('Gagal memuat peta dasar desa:', err);
            }
        };

        loadPetaDasar();
        return () => { cancel = true; };
    }, [desKelId, TOKEN, URL, parsedInitial.length]);

    // ── LOAD PATOK LAPANGAN DARI PLACEMARKDB (MENU HOME) ─────────────────────
    const loadPatok = useCallback(async () => {
        try {
            const userId = PROFILE?.id || null;
            const list = await PlacemarkDB.getAllWithPublic(userId);
            if (Array.isArray(list)) {
                const valid = list.filter(p => !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lon)));
                setExistingPatokList(valid);
            }
        } catch (err) {
            console.warn('Gagal memuat patok lapangan:', err);
        }
    }, [PROFILE?.id]);

    useEffect(() => {
        loadPatok();
    }, [loadPatok]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadPatok();
        });
        return unsubscribe;
    }, [navigation, loadPatok]);

    // Konversi koordinat lokasi ke format react-native-maps
    const polygonCoords = useMemo(() => {
        return lokasi.map((loc) => ({
            latitude: parseFloat(loc.lat || 0),
            longitude: parseFloat(loc.lng || 0),
        })).filter(c => !isNaN(c.latitude) && !isNaN(c.longitude) && (c.latitude !== 0 || c.longitude !== 0));
    }, [lokasi]);

    // Hitung metrik luas & keliling secara real-time
    const metrics = useMemo(() => {
        if (polygonCoords.length < 3) {
            const len = calcPolylineLength(polygonCoords);
            return { m2: 0, ha: 0, lengthM: len };
        }
        const { m2, ha } = calcGeodesicArea(polygonCoords);
        const len = calcPolylineLength(polygonCoords);
        return { m2, ha, lengthM: len };
    }, [polygonCoords]);

    // Inisialisasi posisi region peta dari titik yang sudah ada atau GPS
    useEffect(() => {
        if (polygonCoords.length > 0) {
            let minLat = polygonCoords[0].latitude;
            let maxLat = polygonCoords[0].latitude;
            let minLng = polygonCoords[0].longitude;
            let maxLng = polygonCoords[0].longitude;
            polygonCoords.forEach(p => {
                if (p.latitude < minLat) minLat = p.latitude;
                if (p.latitude > maxLat) maxLat = p.latitude;
                if (p.longitude < minLng) minLng = p.longitude;
                if (p.longitude > maxLng) maxLng = p.longitude;
            });
            const midLat = (minLat + maxLat) / 2;
            const midLng = (minLng + maxLng) / 2;
            const dLat = Math.max((maxLat - minLat) * 1.5, 0.01);
            const dLng = Math.max((maxLng - minLng) * 1.5, 0.01);

            const newReg = {
                latitude: midLat,
                longitude: midLng,
                latitudeDelta: dLat,
                longitudeDelta: dLng,
            };
            setRegion(newReg);
            setTimeout(() => {
                mapViewRef.current?.animateToRegion(newReg, 600);
            }, 500);
        } else {
            // Ambil GPS jika belum ada titik
            centerToUserLocation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── IZIN & PENGAMBILAN GPS ────────────────────────────────────────────────
    const requestLocationPermission = async () => {
        if (Platform.OS === 'ios') return true;
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: "Izin Akses Lokasi GPS",
                    message: "Aplikasi memerlukan akses lokasi untuk pemetaan batas desa.",
                    buttonPositive: "Izinkan"
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            return false;
        }
    };

    const centerToUserLocation = async (callback) => {
        const hasPerm = await requestLocationPermission();
        if (!hasPerm) return;

        Geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const newReg = {
                    latitude,
                    longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.01,
                };
                setRegion(newReg);
                mapViewRef.current?.animateToRegion(newReg, 800);
                if (callback) callback({ latitude, longitude });
            },
            (err) => {
                console.warn('GPS Error:', err.message);
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
    };

    // ── AKSI PETA: MENGGAMBAR LANGSUNG DI PETA ────────────────────────────────
    const handleMapPress = (e) => {
        if (isPegmanMode) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            openStreetView({ latitude, longitude }, `Street View (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);
            setIsPegmanMode(false);
            return;
        }

        // Mode Pasang Patok Mandiri (seperti Placemark Home)
        if (isPatokMode) {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setIsPatokMode(false);
            navigation.navigate('PlacemarkForm', {
                lat: latitude.toFixed(8),
                lon: longitude.toFixed(8),
                judul: `Patok Batas ${namaDesa || ''}`,
                ownerInfo: {
                    userId: PROFILE?.id,
                    nama: PROFILE?.profile?.nama || PROFILE?.nama || 'Admin Desa',
                    desa: namaDesa || '',
                    kecamatan: route.params?.nama_kecamatan || PROFILE?.profile?.nama_kecamatan || '',
                },
                onSaved: () => loadPatok()
            });
            return;
        }

        if (!isDrawMode) return;
        const { latitude, longitude } = e.nativeEvent.coordinate;
        if (isNaN(latitude) || isNaN(longitude)) return;

        const newPoint = {
            lat: latitude.toFixed(8),
            lng: longitude.toFixed(8),
            photo_uri: null,
            photo_file: null,
        };

        setLokasi(prev => [...prev, newPoint]);
    };

    // ── AKSI PETA: EDIT DENGAN DRAG & DROP ────────────────────────────────────
    const handleMarkerDragEnd = (index, coordinate) => {
        const { latitude, longitude } = coordinate;
        if (isNaN(latitude) || isNaN(longitude)) return;

        setLokasi(prev => {
            const updated = [...prev];
            if (updated[index]) {
                updated[index] = {
                    ...updated[index],
                    lat: latitude.toFixed(8),
                    lng: longitude.toFixed(8),
                };
            }
            return updated;
        });
    };

    // ── AKSI PETA: PASANG PATOK MANDIRI DI KOORDINAT GPS SAYA ─────────────────
    const handleCreatePatokAtGps = () => {
        setIsPatokMode(false);
        Geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                navigation.navigate('PlacemarkForm', {
                    lat: latitude.toFixed(8),
                    lon: longitude.toFixed(8),
                    judul: `Patok Batas ${namaDesa || ''}`,
                    ownerInfo: {
                        userId: PROFILE?.id,
                        nama: PROFILE?.profile?.nama || PROFILE?.nama || 'Admin Desa',
                        desa: namaDesa || '',
                        kecamatan: route.params?.nama_kecamatan || PROFILE?.profile?.nama_kecamatan || '',
                    },
                    onSaved: () => loadPatok()
                });
            },
            (err) => {
                Alert.alert('GPS', 'Gagal membaca GPS: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    // ── AKSI PETA: PILIH TITIK PATOK DARI PLACEMARKDB UNTUK DISAMBUNG KE BATAS ──
    const handleSelectExistingPatok = (pm) => {
        const pLat = parseFloat(pm.lat).toFixed(8);
        const pLng = parseFloat(pm.lon).toFixed(8);
        Alert.alert(
            `🚩 ${pm.judul || 'Patok Lapangan'}`,
            `Koordinat: ${pLat}, ${pLng}\n${pm.deskripsi ? `Keterangan: ${pm.deskripsi}\n` : ''}Pilih tindakan untuk patok ini:`,
            [
                { text: 'Tutup', style: 'cancel' },
                {
                    text: '✏️ Buka / Edit Patok',
                    onPress: () => {
                        navigation.navigate('PlacemarkForm', {
                            placemark: pm,
                            ownerInfo: {
                                userId: PROFILE?.id,
                                nama: PROFILE?.profile?.nama || PROFILE?.nama || 'Admin Desa',
                                desa: namaDesa || '',
                                kecamatan: route.params?.nama_kecamatan || PROFILE?.profile?.nama_kecamatan || '',
                            },
                            onSaved: () => loadPatok()
                        });
                    }
                },
                {
                    text: '➕ Sambungkan ke Batas',
                    onPress: () => {
                        const newIdx = lokasi.length + 1;
                        const newPt = {
                            lat: pLat,
                            lng: pLng,
                            photo_uri: pm.foto?.[0]?.uri || null,
                            photo_file: null,
                            is_patok: true,
                            patok_name: pm.judul || `Patok #${newIdx}`,
                        };
                        setLokasi(prev => [...prev, newPt]);
                    }
                }
            ]
        );
    };

    // ── AKSI: DAFTARKAN TITIK KE MENU PATOK LAPANGAN (PLACEMARKFORM) ─────────
    const handleRegisterPointAsPatok = (index) => {
        if (index == null || !lokasi[index]) return;
        const pt = lokasi[index];
        setPointModalVisible(false);
        navigation.navigate('PlacemarkForm', {
            lat: pt.lat,
            lon: pt.lng,
            judul: pt.patok_name || `Patok Titik #${index + 1} - ${namaDesa || ''}`,
            photoUri: pt.photo_uri || null,
            ownerInfo: {
                userId: PROFILE?.id,
                nama: PROFILE?.profile?.nama || PROFILE?.nama || 'Admin Desa',
                desa: namaDesa || '',
                kecamatan: route.params?.nama_kecamatan || PROFILE?.profile?.nama_kecamatan || '',
            },
            onSaved: () => {
                setLokasi(prev => {
                    const updated = [...prev];
                    if (updated[index]) {
                        updated[index] = {
                            ...updated[index],
                            is_patok: true,
                            patok_name: `Patok Titik #${index + 1}`,
                        };
                    }
                    return updated;
                });
                loadPatok();
            }
        });
    };

    // ── AKSI PETA: UNDO TITIK TERAKHIR ────────────────────────────────────────
    const handleUndo = () => {
        if (lokasi.length === 0) return;
        setLokasi(prev => prev.slice(0, -1));
    };

    // ── AKSI PETA: HAPUS SEMUA TITIK ─────────────────────────────────────────
    const handleClearAll = () => {
        if (lokasi.length === 0) return;
        Alert.alert(
            'Hapus Seluruh Titik',
            'Apakah Anda yakin ingin menghapus semua titik polygon yang telah digambar?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus Semua',
                    style: 'destructive',
                    onPress: () => {
                        setLokasi([]);
                        setSelectedPointIndex(null);
                    }
                }
            ]
        );
    };

    // ── AKSI MODAL EDIT TITIK SPESIFIK ────────────────────────────────────────
    const openPointEditor = (index) => {
        if (index < 0 || index >= lokasi.length) return;
        setSelectedPointIndex(index);
        setEditLat(lokasi[index]?.lat || '');
        setEditLng(lokasi[index]?.lng || '');
        setPointModalVisible(true);
    };

    const handleSaveSpecificPoint = () => {
        if (selectedPointIndex == null) return;
        const latNum = parseFloat(editLat);
        const lngNum = parseFloat(editLng);
        if (isNaN(latNum) || isNaN(lngNum)) {
            Alert.alert('Koordinat Tidak Valid', 'Harap masukkan angka koordinat Latitude dan Longitude yang benar.');
            return;
        }

        setLokasi(prev => {
            const updated = [...prev];
            if (updated[selectedPointIndex]) {
                updated[selectedPointIndex] = {
                    ...updated[selectedPointIndex],
                    lat: latNum.toFixed(8),
                    lng: lngNum.toFixed(8),
                };
            }
            return updated;
        });
        setPointModalVisible(false);
    };

    const handleDeleteSpecificPoint = (indexToDelete) => {
        const targetIdx = indexToDelete != null ? indexToDelete : selectedPointIndex;
        if (targetIdx == null || targetIdx < 0 || targetIdx >= lokasi.length) return;

        Alert.alert(
            'Hapus Titik Koordinat',
            `Apakah Anda yakin ingin menghapus Titik ${targetIdx + 1}?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: () => {
                        setLokasi(prev => prev.filter((_, i) => i !== targetIdx));
                        setPointModalVisible(false);
                        setSelectedPointIndex(null);
                    }
                }
            ]
        );
    };

    const handleInsertPointAfter = (index) => {
        if (index == null || index < 0 || index >= lokasi.length) return;
        const curr = lokasi[index];
        const next = lokasi[(index + 1) % lokasi.length];
        const newLat = ((parseFloat(curr.lat) + parseFloat(next.lat)) / 2).toFixed(8);
        const newLng = ((parseFloat(curr.lng) + parseFloat(next.lng)) / 2).toFixed(8);

        const newPoint = { lat: newLat, lng: newLng, photo_uri: null };
        setLokasi(prev => {
            const updated = [...prev];
            updated.splice(index + 1, 0, newPoint);
            return updated;
        });

        Alert.alert(
            'Titik Disisipkan',
            `Titik baru berhasil disisipkan di antara Titik ${index + 1} dan Titik ${index + 2}. Anda dapat menyeret atau mengedit posisinya.`
        );
        setPointModalVisible(false);
    };

    // ── FITUR UNDUH EXCEL / CSV SESUAI FORMAT GAMBAR ─────────────────────────
    const handleDownloadExcel = () => {
        if (lokasi.length === 0) {
            Alert.alert('Belum Ada Titik', 'Silakan gambar titik batas polygon di peta terlebih dahulu sebelum mengunduh.');
            return;
        }

        Alert.alert(
            'Unduh Format EXCEL',
            `Unduh ${lokasi.length} titik koordinat polygon ke berkas:`,
            [
                {
                    text: '📊 Microsoft Excel (.xls)',
                    onPress: async () => {
                        try {
                            const fileName = `Format_EXCEL_Batas_${Date.now()}`;
                            const path = `${RNFS.CachesDirectoryPath}/${fileName}.xls`;
                            const html = generateExcelHtml(lokasi, fileName);
                            await RNFS.writeFile(path, html, 'utf8');
                            await Share.open({
                                url: `file://${path}`,
                                type: 'application/vnd.ms-excel',
                                title: 'Format EXCEL Batas Desa',
                            });
                        } catch (e) {
                            if (e?.message && e.message !== 'User did not share') {
                                Alert.alert('Gagal', e.message);
                            }
                        }
                    }
                },
                {
                    text: '📑 File CSV (.csv)',
                    onPress: async () => {
                        try {
                            const fileName = `Format_EXCEL_Batas_${Date.now()}`;
                            const path = `${RNFS.CachesDirectoryPath}/${fileName}.csv`;
                            const csv = generateCsvContent(lokasi);
                            await RNFS.writeFile(path, csv, 'utf8');
                            await Share.open({
                                url: `file://${path}`,
                                type: 'text/csv',
                                title: 'Format CSV Batas Desa',
                            });
                        } catch (e) {
                            if (e?.message && e.message !== 'User did not share') {
                                Alert.alert('Gagal', e.message);
                            }
                        }
                    }
                },
                { text: 'Batal', style: 'cancel' }
            ]
        );
    };

    // ── AMBIL FOTO PATOK (OPSIONAL) ──────────────────────────────────────────
    const takePhotoForPoint = (index) => {
        navigation.navigate('GeoTagCamera', {
            onPhotoTaken: (photoData) => {
                setLokasi((prev) => {
                    const updated = [...prev];
                    if (updated[index]) {
                        updated[index].photo_uri = photoData.uri;
                    }
                    return updated;
                });
            }
        });
    };

    const handlePreviewPhoto = (uri, pointIndex) => {
        setPreviewImageUri(uri);
        setPreviewPointIndex(pointIndex);
        setPreviewModalVisible(true);
    };

    // ── SIMPAN & KIRIM KEMBALI KOORDINAT ──────────────────────────────────────
    const sendBackLokasi = () => {
        if (lokasi.length < 3) {
            Alert.alert(
                'Titik Kurang',
                'Pemetaan polygon batas wilayah membutuhkan minimal 3 titik koordinat. Silakan ketuk peta untuk menambah titik.'
            );
            return;
        }

        if (route.params?.onLokasiUpdate) {
            route.params.onLokasiUpdate(lokasi);
        }
        navigation.goBack();
    };

    return (
        <View style={localStyles.screenContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={true} />

            {/* TOP HEADER */}
            <View style={[localStyles.navTop, { paddingTop: topPadding }]}>
                <TouchableOpacity style={localStyles.navBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <FastImage
                        style={localStyles.backIcon}
                        source={require('../assets/img/chevron-left.png')}
                        resizeMode={FastImage.resizeMode.contain}
                    />
                </TouchableOpacity>

                <View style={localStyles.navCenter}>
                    <Text style={localStyles.navTitle}>Pemetaan Batas Desa</Text>
                    <Text style={localStyles.navSub}>Metode Polygon (Gambar Peta)</Text>
                </View>

                <TouchableOpacity
                    style={localStyles.btnSaveHeader}
                    onPress={sendBackLokasi}
                    activeOpacity={0.8}
                >
                    <Text style={localStyles.btnSaveHeaderText}>Selesai</Text>
                </TouchableOpacity>
            </View>

            {/* TAB SELECTOR: PETA vs DAFTAR TITIK */}
            <View style={localStyles.tabBarRow}>
                <TouchableOpacity
                    style={[localStyles.tabItem, activeTab === 'map' && localStyles.tabItemActive]}
                    onPress={() => setActiveTab('map')}
                    activeOpacity={0.8}
                >
                    <Text style={[localStyles.tabText, activeTab === 'map' && localStyles.tabTextActive]}>
                        🗺️ Kanvas Gambar Peta
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[localStyles.tabItem, activeTab === 'list' && localStyles.tabItemActive]}
                    onPress={() => setActiveTab('list')}
                    activeOpacity={0.8}
                >
                    <Text style={[localStyles.tabText, activeTab === 'list' && localStyles.tabTextActive]}>
                        📋 Daftar Titik ({lokasi.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* KONTEN UTAMA */}
            <View style={{ flex: 1 }}>
                {activeTab === 'map' ? (
                    <View style={localStyles.mapContainer}>
                        <MapView
                            ref={mapRef => (mapViewRef.current = mapRef)}
                            style={StyleSheet.absoluteFillObject}
                            provider="google"
                            initialRegion={region}
                            mapType={mapType}
                            showsUserLocation={true}
                            showsMyLocationButton={false}
                            showsCompass={false}
                            toolbarEnabled={false}
                            onPress={handleMapPress}
                        >
                            {/* POLYGON PETA DASAR DESA (SAMAR-SAMAR SEBAGAI REFERENSI / PERBANDINGAN) */}
                            {showPetaDasar && petaDasarCoords.map((ring, rIdx) => (
                                <React.Fragment key={`peta-dasar-frag-${rIdx}`}>
                                    {ring.length >= 3 && (
                                        <Polygon
                                            key={`peta-dasar-poly-${rIdx}`}
                                            coordinates={ring}
                                            strokeColor="rgba(245, 158, 11, 0.7)"
                                            fillColor="rgba(245, 158, 11, 0.08)"
                                            strokeWidth={2}
                                            lineDashPattern={[6, 6]}
                                            zIndex={1}
                                        />
                                    )}
                                    {ring.length >= 2 && (
                                        <Polyline
                                            key={`peta-dasar-line-${rIdx}`}
                                            coordinates={ring}
                                            strokeColor="rgba(245, 158, 11, 0.7)"
                                            strokeWidth={2}
                                            lineDashPattern={[6, 6]}
                                            zIndex={1}
                                        />
                                    )}
                                </React.Fragment>
                            ))}

                            {/* Garis Polyline Penghubung Usulan Final */}
                            {polygonCoords.length >= 2 && (
                                <Polyline
                                    coordinates={polygonCoords}
                                    strokeColor="#0284C7"
                                    strokeWidth={3}
                                    lineDashPattern={isDrawMode ? [6, 4] : undefined}
                                    zIndex={2}
                                />
                            )}

                            {/* Polygon Area Usulan Final */}
                            {polygonCoords.length >= 3 && (
                                <Polygon
                                    coordinates={polygonCoords}
                                    strokeColor="#0284C7"
                                    fillColor="rgba(2, 132, 199, 0.22)"
                                    strokeWidth={2.5}
                                    zIndex={2}
                                />
                            )}

                            {/* Marker Setiap Titik (Bisa di-Drag & Drop) */}
                            {lokasi.map((item, index) => {
                                const lat = parseFloat(item.lat);
                                const lng = parseFloat(item.lng);
                                if (isNaN(lat) || isNaN(lng)) return null;

                                const isSelected = selectedPointIndex === index;
                                return (
                                    <Marker
                                        key={`pt-${index}-${lokasi.length}`}
                                        coordinate={{ latitude: lat, longitude: lng }}
                                        draggable={true}
                                        onDragEnd={(e) => handleMarkerDragEnd(index, e.nativeEvent.coordinate)}
                                        onPress={() => openPointEditor(index)}
                                        anchor={{ x: 0.5, y: 0.5 }}
                                    >
                                        <View style={[localStyles.markerPin, isSelected && localStyles.markerPinSelected]}>
                                            <Text style={localStyles.markerPinText}>{index + 1}</Text>
                                        </View>
                                    </Marker>
                                );
                            })}

                            {/* MARKER TITIK PATOK LAPANGAN DARI MENU PATOK HOME */}
                            {showExistingPatok && existingPatokList.map((pm, pmIdx) => {
                                const pLat = parseFloat(pm.lat);
                                const pLng = parseFloat(pm.lon);
                                if (isNaN(pLat) || isNaN(pLng)) return null;
                                return (
                                    <Marker
                                        key={`patok-db-${pm.id || pmIdx}`}
                                        coordinate={{ latitude: pLat, longitude: pLng }}
                                        anchor={{ x: 0.5, y: 0.8 }}
                                        zIndex={1}
                                        onPress={() => handleSelectExistingPatok(pm)}
                                    >
                                        <View style={localStyles.patokMarkerWrap}>
                                            <View style={localStyles.patokMarkerPill}>
                                                <Text style={localStyles.patokMarkerText} numberOfLines={1}>
                                                    🚩 {pm.judul || `Patok ${pmIdx + 1}`}
                                                </Text>
                                            </View>
                                            <View style={localStyles.patokMarkerPin}>
                                                <Text style={{ fontSize: 18 }}>📍</Text>
                                            </View>
                                        </View>
                                    </Marker>
                                );
                            })}
                        </MapView>

                        {/* BANNER STATUS GAMBAR & METRIK */}
                        <View style={localStyles.topOverlayBanner} pointerEvents="box-none">
                            {/* Toggle Peta Dasar Samar */}
                            {petaDasarCoords.length > 0 && (
                                <TouchableOpacity
                                    style={[
                                        localStyles.petaDasarPill,
                                        !showPetaDasar && { backgroundColor: 'rgba(51, 65, 85, 0.85)', borderColor: '#475569' }
                                    ]}
                                    onPress={() => setShowPetaDasar(!showPetaDasar)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[localStyles.petaDasarDot, !showPetaDasar && { backgroundColor: '#94A3B8' }]} />
                                    <Text style={[localStyles.petaDasarText, !showPetaDasar && { color: '#CBD5E1' }]}>
                                        {showPetaDasar ? `🗺️ Peta Dasar ${namaDesa ? `(${namaDesa})` : ''} Samar: Aktif` : '🙈 Peta Dasar: Disembunyikan'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Toggle Tampilkan Patok Lapangan Home */}
                            {existingPatokList.length > 0 && (
                                <TouchableOpacity
                                    style={[
                                        localStyles.petaDasarPill,
                                        { backgroundColor: 'rgba(234, 88, 12, 0.22)', borderColor: '#EA580C' },
                                        !showExistingPatok && { backgroundColor: 'rgba(51, 65, 85, 0.85)', borderColor: '#475569' }
                                    ]}
                                    onPress={() => setShowExistingPatok(!showExistingPatok)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[localStyles.petaDasarDot, { backgroundColor: '#EA580C' }, !showExistingPatok && { backgroundColor: '#94A3B8' }]} />
                                    <Text style={[localStyles.petaDasarText, { color: '#FDBA74' }, !showExistingPatok && { color: '#CBD5E1' }]}>
                                        {showExistingPatok ? `🚩 Patok Home (${existingPatokList.length}): Aktif` : '🙈 Patok Home: Disembunyikan'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {isPatokMode ? (
                                <View style={[localStyles.drawModeBadge, { backgroundColor: '#EA580C' }]}>
                                    <View style={[localStyles.drawPulseDot, { backgroundColor: '#FFFFFF' }]} />
                                    <Text style={localStyles.drawModeText}>
                                        🚩 Mode Pasang Patok: Ketuk peta untuk letakkan patok
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => setIsPatokMode(false)}
                                        style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 4 }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕ Batal</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : isDrawMode ? (
                                <View style={localStyles.drawModeBadge}>
                                    <View style={localStyles.drawPulseDot} />
                                    <Text style={localStyles.drawModeText}>
                                        Mode Gambar Aktif: Ketuk peta untuk menambah titik
                                    </Text>
                                </View>
                            ) : (
                                <View style={[localStyles.drawModeBadge, { backgroundColor: 'rgba(30, 41, 59, 0.85)' }]}>
                                    <Text style={localStyles.drawModeText}>
                                        ✋ Mode Jelajah: Geser/tarik titik marker untuk ubah posisi
                                    </Text>
                                </View>
                            )}

                            {/* Info Luas & Titik */}
                            {lokasi.length >= 3 ? (
                                <View style={localStyles.metricsBox}>
                                    <Text style={localStyles.metricsMain}>
                                        📐 {metrics.m2.toLocaleString()} m² ({metrics.ha} Ha)
                                    </Text>
                                    <Text style={localStyles.metricsSub}>
                                        Keliling: {fmtM(metrics.lengthM)} • {lokasi.length} Titik
                                    </Text>
                                </View>
                            ) : (
                                <View style={localStyles.metricsBox}>
                                    <Text style={localStyles.metricsSub}>
                                        {lokasi.length} Titik • Tambahkan minimal {Math.max(0, 3 - lokasi.length)} titik lagi
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* MENU ALAT DI KANAN PETA (ADOBSI HOME / MAPPREVIEW) */}
                        <View style={localStyles.floatingRightToolbar} pointerEvents="box-none">
                            {/* Toggle Mode Gambar */}
                            <TouchableOpacity
                                style={[localStyles.toolBtn, isDrawMode && localStyles.toolBtnActive]}
                                onPress={() => {
                                    setIsDrawMode(!isDrawMode);
                                    if (!isDrawMode) {
                                        setIsPatokMode(false);
                                        setIsPegmanMode(false);
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.toolBtnIcon}>✏️</Text>
                                <Text style={[localStyles.toolBtnLabel, isDrawMode && { color: '#fff' }]}>
                                    {isDrawMode ? 'Gambar' : 'Jelajah'}
                                </Text>
                            </TouchableOpacity>

                            {/* Ganti Tipe Layer Peta */}
                            <TouchableOpacity
                                style={localStyles.toolBtn}
                                onPress={() => {
                                    setMapType(prev => (prev === 'hybrid' ? 'standard' : prev === 'standard' ? 'satellite' : 'hybrid'));
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.toolBtnIcon}>
                                    {mapType === 'hybrid' ? '🛰️' : mapType === 'satellite' ? '🏔️' : '🗺️'}
                                </Text>
                                <Text style={localStyles.toolBtnLabel}>Layer</Text>
                            </TouchableOpacity>

                            {/* Center ke GPS Saya */}
                            <TouchableOpacity
                                style={localStyles.toolBtn}
                                onPress={() => centerToUserLocation()}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.toolBtnIcon}>📍</Text>
                                <Text style={localStyles.toolBtnLabel}>GPS</Text>
                            </TouchableOpacity>

                            {/* Tombol Street View 360 */}
                            <TouchableOpacity
                                style={[localStyles.toolBtn, isPegmanMode && { backgroundColor: '#F59E0B' }]}
                                onPress={() => {
                                    if (lokasi.length > 0) {
                                        const idx = selectedPointIndex != null ? selectedPointIndex : 0;
                                        const pt = lokasi[idx];
                                        openStreetView(pt, `Street View Titik ${idx + 1}`);
                                    } else {
                                        setIsPegmanMode(!isPegmanMode);
                                        if (!isPegmanMode) {
                                            setIsPatokMode(false);
                                        }
                                        Alert.alert(
                                            !isPegmanMode ? 'Mode Street View Aktif' : 'Mode Street View Dimatikan',
                                            !isPegmanMode ? 'Ketuk titik mana saja di peta untuk melihat citra 360° Street View.' : 'Kembali ke mode pemetaan.'
                                        );
                                    }
                                }}
                                onLongPress={() => {
                                    setIsPegmanMode(!isPegmanMode);
                                    if (!isPegmanMode) {
                                        setIsPatokMode(false);
                                    }
                                    Alert.alert(
                                        !isPegmanMode ? 'Mode Street View Aktif' : 'Mode Street View Dimatikan',
                                        !isPegmanMode ? 'Ketuk titik mana saja di peta untuk melihat citra 360° Street View.' : 'Kembali ke mode pemetaan.'
                                    );
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.toolBtnIcon}>🚶‍♂️</Text>
                                <Text style={[localStyles.toolBtnLabel, isPegmanMode && { color: '#fff' }]}>Street</Text>
                            </TouchableOpacity>

                            {/* Tombol Pasang Patok Mandiri */}
                            <TouchableOpacity
                                style={[
                                    localStyles.toolBtn,
                                    isPatokMode && { backgroundColor: '#EA580C' }
                                ]}
                                onPress={() => {
                                    if (!isPatokMode) {
                                        setIsPatokMode(true);
                                        setIsDrawMode(false);
                                        setIsPegmanMode(false);
                                        Alert.alert(
                                            '🚩 Pasang Patok Mandiri',
                                            'Pilih cara memasang patok batas:',
                                            [
                                                { text: '📍 Pasang di Titik GPS Saya', onPress: handleCreatePatokAtGps },
                                                { text: '🗺️ Ketuk di Peta', onPress: () => {} },
                                                { text: 'Batal', style: 'cancel', onPress: () => setIsPatokMode(false) }
                                            ]
                                        );
                                    } else {
                                        setIsPatokMode(false);
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.toolBtnIcon}>🚩</Text>
                                <Text style={[localStyles.toolBtnLabel, isPatokMode && { color: '#FFFFFF', fontWeight: 'bold' }]}>
                                    {isPatokMode ? 'Batal' : '+ Patok'}
                                </Text>
                            </TouchableOpacity>

                            {/* Tombol Unduh Format EXCEL */}
                            <TouchableOpacity
                                style={[localStyles.toolBtn, { backgroundColor: '#10B981' }]}
                                onPress={handleDownloadExcel}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.toolBtnIcon}>📊</Text>
                                <Text style={[localStyles.toolBtnLabel, { color: '#fff' }]}>Excel</Text>
                            </TouchableOpacity>

                            {/* Tombol Undo */}
                            {lokasi.length > 0 && (
                                <TouchableOpacity
                                    style={localStyles.toolBtn}
                                    onPress={handleUndo}
                                    activeOpacity={0.8}
                                >
                                    <Icon name="undo" size={20} color="#1E293B" />
                                    <Text style={localStyles.toolBtnLabel}>Undo</Text>
                                </TouchableOpacity>
                            )}

                            {/* Tombol Hapus Semua */}
                            {lokasi.length > 0 && (
                                <TouchableOpacity
                                    style={[localStyles.toolBtn, { backgroundColor: '#EF4444' }]}
                                    onPress={handleClearAll}
                                    activeOpacity={0.8}
                                >
                                    <Text style={localStyles.toolBtnIcon}>✕</Text>
                                    <Text style={[localStyles.toolBtnLabel, { color: '#fff' }]}>Hapus</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                    /* TAB DAFTAR TITIK */
                    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                        <View style={localStyles.listHeaderBar}>
                            <View>
                                <Text style={localStyles.listHeaderTitle}>Daftar Titik Koordinat</Text>
                                <Text style={localStyles.listHeaderSub}>Ketuk titik untuk mengedit atau menghapus</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.btnExcelInList}
                                onPress={handleDownloadExcel}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.btnExcelInListText}>📊 Unduh Excel</Text>
                            </TouchableOpacity>
                        </View>

                        {lokasi.length === 0 ? (
                            <View style={localStyles.emptyContainer}>
                                <Text style={{ fontSize: 40, marginBottom: 10 }}>🗺️</Text>
                                <Text style={localStyles.emptyTitle}>Belum Ada Titik Polygon</Text>
                                <Text style={localStyles.emptySub}>
                                    Buka tab "Kanvas Gambar Peta" lalu ketuk pada peta untuk mulai menggambar batas desa.
                                </Text>
                                <TouchableOpacity
                                    style={localStyles.btnGoToMap}
                                    onPress={() => setActiveTab('map')}
                                >
                                    <Text style={localStyles.btnGoToMapText}>Buka Kanvas Peta</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <FlatList
                                data={lokasi}
                                keyExtractor={(_, index) => `pt-${index}`}
                                renderItem={({ item, index }) => (
                                    <CoordinateCard
                                        item={item}
                                        index={index}
                                        isSelected={selectedPointIndex === index}
                                        onSelectPoint={openPointEditor}
                                        onDeletePoint={handleDeleteSpecificPoint}
                                        onOpenStreetView={(pt, idx) => openStreetView(pt, `Titik ${idx}`)}
                                        takePhotoForPoint={takePhotoForPoint}
                                        previewPhoto={handlePreviewPhoto}
                                    />
                                )}
                                contentContainerStyle={{ paddingBottom: 80 }}
                            />
                        )}
                    </View>
                )}
            </View>

            {/* STICKY FOOTER ACTION BAR */}
            <View style={localStyles.footerBar}>
                <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={localStyles.footerTotalText}>
                        Total: <Text style={{ fontWeight: 'bold', color: '#0284C7' }}>{lokasi.length} Titik</Text>
                    </Text>
                    <Text style={localStyles.footerAreaText}>
                        {lokasi.length >= 3 ? `${metrics.ha} Ha (${metrics.m2.toLocaleString()} m²)` : 'Minimal 3 titik'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={localStyles.btnSimpanKirim}
                    onPress={sendBackLokasi}
                    activeOpacity={0.85}
                >
                    <Text style={localStyles.btnSimpanKirimText}>💾 Simpan Titik Batas</Text>
                </TouchableOpacity>
            </View>

            {/* MODAL EDIT TITIK SPESIFIK */}
            <Modal
                visible={pointModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPointModalVisible(false)}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        <View style={localStyles.modalHeaderRow}>
                            <Text style={localStyles.modalTitle}>
                                📌 Edit Titik {selectedPointIndex != null ? selectedPointIndex + 1 : ''} dari {lokasi.length}
                            </Text>
                            <TouchableOpacity onPress={() => setPointModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={localStyles.modalCloseBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={localStyles.modalInputLabel}>Latitude (Lintang)</Text>
                        <TextInput
                            style={localStyles.modalInput}
                            value={editLat}
                            onChangeText={setEditLat}
                            keyboardType="numeric"
                            placeholder="Contoh: -4.01181605"
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={localStyles.modalInputLabel}>Longitude (Bujur)</Text>
                        <TextInput
                            style={localStyles.modalInput}
                            value={editLng}
                            onChangeText={setEditLng}
                            keyboardType="numeric"
                            placeholder="Contoh: 122.43993316"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* Status & Aksi Patok Home */}
                        <View style={localStyles.modalPatokRow}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={localStyles.modalPatokTitle}>
                                    {selectedPointIndex != null && lokasi[selectedPointIndex]?.is_patok ? '🚩 Terdaftar di Menu Patok Home' : '📍 Belum Didaftarkan sebagai Patok'}
                                </Text>
                                <Text style={localStyles.modalPatokSub}>
                                    Foto patok bersifat opsional (tidak wajib verifikasi).
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    localStyles.btnRegisterPatokModal,
                                    selectedPointIndex != null && lokasi[selectedPointIndex]?.is_patok && { backgroundColor: '#10B981', borderColor: '#059669' }
                                ]}
                                onPress={() => handleRegisterPointAsPatok(selectedPointIndex)}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.btnRegisterPatokModalText}>
                                    {selectedPointIndex != null && lokasi[selectedPointIndex]?.is_patok ? '✓ Tersimpan Patok' : '➕ Daftarkan Patok'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Opsi Tambahan untuk Titik Ini */}
                        <View style={localStyles.pointActionsRow}>
                            <TouchableOpacity
                                style={[localStyles.btnPointActionPhoto, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}
                                onPress={() => {
                                    if (selectedPointIndex != null && lokasi[selectedPointIndex]) {
                                        setPointModalVisible(false);
                                        openStreetView(lokasi[selectedPointIndex], `Street View Titik ${selectedPointIndex + 1}`);
                                    }
                                }}
                            >
                                <Text style={[localStyles.btnPointActionPhotoText, { color: '#D97706' }]}>🚶‍♂️ Street View</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={localStyles.btnPointActionPhoto}
                                onPress={() => {
                                    setPointModalVisible(false);
                                    takePhotoForPoint(selectedPointIndex);
                                }}
                            >
                                <Text style={localStyles.btnPointActionPhotoText}>📷 Foto (Opsional)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={localStyles.btnPointActionInsert}
                                onPress={() => handleInsertPointAfter(selectedPointIndex)}
                            >
                                <Text style={localStyles.btnPointActionInsertText}>➕ Sisipkan</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={localStyles.btnPointActionDelete}
                                onPress={() => handleDeleteSpecificPoint(selectedPointIndex)}
                            >
                                <Text style={localStyles.btnPointActionDeleteText}>🗑️ Hapus</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={localStyles.btnSavePointModal}
                            onPress={handleSaveSpecificPoint}
                            activeOpacity={0.8}
                        >
                            <Text style={localStyles.btnSavePointModalText}>Terapkan Perubahan Titik</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL PREVIEW FOTO PATOK */}
            <Modal
                visible={previewModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewModalVisible(false)}
            >
                <View style={localStyles.photoPreviewOverlay}>
                    <View style={localStyles.photoPreviewHeader}>
                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
                            📷 Foto Patok Titik {previewPointIndex}
                        </Text>
                        <TouchableOpacity onPress={() => setPreviewModalVisible(false)}>
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>✕ Tutup</Text>
                        </TouchableOpacity>
                    </View>

                    {previewImageUri ? (
                        <Image
                            source={{ uri: previewImageUri }}
                            style={localStyles.photoPreviewImage}
                            resizeMode="contain"
                        />
                    ) : null}

                    <TouchableOpacity
                        onPress={() => {
                            const idx = (previewPointIndex || 1) - 1;
                            setPreviewModalVisible(false);
                            takePhotoForPoint(idx);
                        }}
                        style={localStyles.btnRetakePhoto}
                    >
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>🔄 Ambil Ulang Foto</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* MODAL GOOGLE STREET VIEW 360 */}
            <StreetViewModal
                visible={streetViewVisible}
                coordinate={streetViewCoord}
                polygonCoords={lokasi}
                petaDasarCoords={petaDasarCoords[0] || []}
                title={streetViewTitle}
                onClose={() => setStreetViewVisible(false)}
            />

            <TabBar />
        </View>
    );
};

// ── STYLES ───────────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    navTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingBottom: 14,
        backgroundColor: '#0F172A',
    },
    navBackBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        width: 20,
        height: 20,
    },
    navCenter: {
        flex: 1,
        marginHorizontal: 10,
    },
    navTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    navSub: {
        color: '#94A3B8',
        fontSize: 11,
    },
    btnSaveHeader: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
    },
    btnSaveHeaderText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    tabBarRow: {
        flexDirection: 'row',
        backgroundColor: '#1E293B',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabItemActive: {
        backgroundColor: '#0284C7',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    topOverlayBanner: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 70,
        zIndex: 10,
    },
    drawModeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(2, 132, 199, 0.92)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
    },
    petaDasarPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
        borderWidth: 1,
        borderColor: '#F59E0B',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 6,
        elevation: 2,
    },
    petaDasarDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#F59E0B',
        marginRight: 6,
    },
    petaDasarText: {
        color: '#FCD34D',
        fontSize: 10,
        fontWeight: 'bold',
    },
    drawPulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#38BDF8',
        marginRight: 6,
    },
    drawModeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
        flex: 1,
    },
    metricsBox: {
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    metricsMain: {
        color: '#38BDF8',
        fontSize: 12,
        fontWeight: 'bold',
    },
    metricsSub: {
        color: '#CBD5E1',
        fontSize: 10,
        marginTop: 2,
    },
    floatingRightToolbar: {
        position: 'absolute',
        right: 12,
        top: 12,
        zIndex: 10,
        alignItems: 'center',
    },
    toolBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    toolBtnActive: {
        backgroundColor: '#0284C7',
    },
    toolBtnIcon: {
        fontSize: 17,
    },
    toolBtnLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#334155',
        marginTop: 1,
    },
    markerPin: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#0284C7',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 4,
    },
    markerPinSelected: {
        backgroundColor: '#F59E0B',
        transform: [{ scale: 1.25 }],
    },
    markerPinText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    listHeaderBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    listHeaderTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    listHeaderSub: {
        fontSize: 11,
        color: '#64748B',
    },
    btnExcelInList: {
        backgroundColor: '#10B981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    btnExcelInListText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 12,
        marginHorizontal: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardSelected: {
        borderColor: '#0284C7',
        borderWidth: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    pointBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#475569',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    pointBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    hasPhotoBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
    },
    hasPhotoText: {
        fontSize: 10,
        color: '#16A34A',
        fontWeight: 'bold',
    },
    btnCardStreet: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 6,
    },
    btnCardStreetText: {
        fontSize: 11,
    },
    btnCardEdit: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 6,
    },
    btnCardEditText: {
        fontSize: 11,
        color: '#0284C7',
        fontWeight: 'bold',
    },
    btnCardDelete: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    btnCardDeleteText: {
        fontSize: 11,
        color: '#DC2626',
    },
    thumbnailContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        padding: 6,
        borderRadius: 6,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    thumbnailImg: {
        width: 44,
        height: 44,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
    },
    coordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    coordLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        marginRight: 4,
    },
    coordVal: {
        fontSize: 11,
        color: '#1E293B',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16,
    },
    btnGoToMap: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 8,
    },
    btnGoToMapText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    footerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    footerTotalText: {
        fontSize: 12,
        color: '#475569',
    },
    footerAreaText: {
        fontSize: 11,
        color: '#0284C7',
        fontWeight: '600',
        marginTop: 2,
    },
    btnSimpanKirim: {
        backgroundColor: '#0284C7',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#0284C7',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    btnSimpanKirimText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    modalCloseBtn: {
        fontSize: 18,
        color: '#64748B',
        fontWeight: 'bold',
    },
    modalInputLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#475569',
        marginBottom: 4,
        marginTop: 8,
    },
    modalInput: {
        height: 42,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 13,
        color: '#1E293B',
        backgroundColor: '#F8FAFC',
    },
    pointActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        marginBottom: 14,
    },
    btnPointActionPhoto: {
        flex: 1,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        marginRight: 6,
    },
    btnPointActionPhotoText: {
        color: '#0284C7',
        fontSize: 11,
        fontWeight: 'bold',
    },
    btnPointActionInsert: {
        flex: 1,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        marginRight: 6,
    },
    btnPointActionInsertText: {
        color: '#16A34A',
        fontSize: 11,
        fontWeight: 'bold',
    },
    btnPointActionDelete: {
        flex: 1,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    btnPointActionDeleteText: {
        color: '#DC2626',
        fontSize: 11,
        fontWeight: 'bold',
    },
    btnSavePointModal: {
        backgroundColor: '#0284C7',
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    btnSavePointModalText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    photoPreviewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    photoPreviewHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    photoPreviewImage: {
        width: '100%',
        height: '70%',
        borderRadius: 8,
        backgroundColor: '#1E293B',
    },
    btnRetakePhoto: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 16,
    },
    hasPatokBadge: {
        backgroundColor: '#FFEDD5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 6,
    },
    hasPatokText: {
        fontSize: 9,
        color: '#C2410C',
        fontWeight: 'bold',
    },
    patokMarkerWrap: {
        alignItems: 'center',
    },
    patokMarkerPill: {
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#EA580C',
        marginBottom: 2,
    },
    patokMarkerText: {
        color: '#FED7AA',
        fontSize: 9,
        fontWeight: 'bold',
    },
    patokMarkerPin: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalPatokRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
        marginBottom: 6,
    },
    modalPatokTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#C2410C',
    },
    modalPatokSub: {
        fontSize: 10,
        color: '#9A3412',
        marginTop: 2,
    },
    btnRegisterPatokModal: {
        backgroundColor: '#EA580C',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#C2410C',
    },
    btnRegisterPatokModalText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default MetodeText;
