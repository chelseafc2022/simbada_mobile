import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, PermissionsAndroid } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from 'react-native-fast-image';
import styles from '../assets/style';
import TabBar from '../components/TabBar';

const MetodePolyline = ({ navigation, route }) => {
  const { lokasiAwal, onLokasiUpdate } = route.params;
  const [lokasi, setLokasi] = useState(lokasiAwal || []);
  const [polylineCoords, setPolylineCoords] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const mapViewRef = useRef(null);

  const region = {
    latitude: currentLocation?.latitude || -4.3332916,
    longitude: currentLocation?.longitude || 122.2788887,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const requestLocationPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const getUserLocation = async (callback) => {
    const granted = await requestLocationPermission();
    if (!granted) return Alert.alert('Izin Lokasi', 'Akses lokasi diperlukan.');

    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const loc = { latitude, longitude };
        setCurrentLocation(loc);
        if (callback) callback(loc);
      },
      (err) => Alert.alert('Gagal', 'Tidak bisa ambil lokasi: ' + err.message),
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 1000 }
    );
  };

  const centerToUserLocation = () => {
    getUserLocation((loc) => {
      mapViewRef.current?.animateToRegion({
        ...loc,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    });
  };

  const addLokasi = () => {
    setIsLoading(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPoint = { lat: latitude.toString(), lng: longitude.toString() };
        setLokasi((prev) => [...prev, newPoint]);
        setPolylineCoords((prev) => [...prev, { latitude, longitude }]);
        saveData();
        setIsLoading(false);
      },
      (err) => {
        Alert.alert('Gagal', 'Tidak bisa ambil lokasi: ' + err.message);
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 1000 }
    );
  };

  const hapusLokasi = () => {
    if (lokasi.length > 0) {
      setLokasi((prev) => prev.slice(0, -1));
      setPolylineCoords((prev) => prev.slice(0, -1));
    } else {
      Alert.alert('Info', 'Belum ada titik yang bisa dihapus.');
    }
  };

  const updateLokasi = (index, key, value) => {
    const updated = [...lokasi];
    updated[index][key] = value;
    setLokasi(updated);
    setPolylineCoords(updated.map(l => ({
      latitude: parseFloat(l.lat),
      longitude: parseFloat(l.lng),
    })));
  };

  const saveData = async () => {
    const data = { lokasi, polylineCoords };
    await AsyncStorage.setItem('lokasiPolylineData', JSON.stringify(data));
  };

  const loadData = async () => {
    const saved = await AsyncStorage.getItem('lokasiPolylineData');
    if (saved) {
      const parsed = JSON.parse(saved);
      setLokasi(parsed.lokasi || []);
      setPolylineCoords(parsed.polylineCoords || []);
    }
  };

  const sendBackLokasi = () => {
    if (lokasi.length < 2) {
      Alert.alert('Minimal 2 titik', 'Silakan tambahkan minimal 2 titik.');
      return;
    }
    onLokasiUpdate && onLokasiUpdate(lokasi);
    navigation.goBack();
  };

  useEffect(() => {
    // 1. Ambil lokasi GPS saat pertama kali masuk
    getUserLocation();
  
    // 2. Coba load lokasi dari AsyncStorage atau pakai lokasiAwal dari AddUsulan
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem('lokasiPolylineData');
        const parsed = saved ? JSON.parse(saved) : null;
  
        let dataToUse = [];
  
        if (route.params?.lokasiAwal && route.params.lokasiAwal.length > 0) {
          dataToUse = route.params.lokasiAwal;
          console.log("📥 Menggunakan lokasi dari AddUsulan");
        } else if (parsed && parsed.lokasi?.length > 0) {
          dataToUse = parsed.lokasi;
          console.log("📥 Menggunakan lokasi dari AsyncStorage");
        }
  
        setLokasi(dataToUse);
        setPolylineCoords(dataToUse.map((l) => ({
          latitude: parseFloat(l.lat),
          longitude: parseFloat(l.lng),
        })));
      } catch (e) {
        console.log("❌ Gagal load data lokasi polyline:", e.message);
      }
    };
  
    loadData();
  }, []);

  useEffect(() => {
    const updatedCoords = lokasi.map((l) => ({
      latitude: parseFloat(l.lat),
      longitude: parseFloat(l.lng),
    }));
    setPolylineCoords(updatedCoords);
    saveData(); // Pastikan tetap simpan saat lokasi berubah
  }, [lokasi]);
  
  

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.navTop}>
        <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()}>
          <FastImage
            style={styles.backIcon}
            source={require('../assets/img/chevron-left.png')}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.top2}>
          <Text style={styles.headerTitle}>Metode Polyline</Text>
        </View>
      </View>

      <View style={styles.mapxText}>
        <MapView
          style={styles.map}
          key={`${region.latitude}-${region.longitude}`}
          provider="google"
          ref={mapViewRef}
          region={region}
        >
          {currentLocation && (
            <Marker coordinate={currentLocation} title="Lokasi Saat Ini" pinColor="blue" />
          )}
          {lokasi.map((loc, idx) => (
            <Marker
              key={idx}
              coordinate={{ latitude: parseFloat(loc.lat), longitude: parseFloat(loc.lng) }}
              title={`Titik ${idx + 1}`}
              pinColor="red"
            />
          ))}
          {polylineCoords.length >= 2 && (
            <Polyline coordinates={polylineCoords} strokeColor="#208DC0" strokeWidth={3} />
          )}
        </MapView>
      </View>

      <ScrollView style={styles.body}>
        {lokasi.map((point, i) => (
          <View key={i} style={{ flexDirection: 'row' }}>
            <View style={{ width: '50%' }}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                style={styles.inputMetode}
                value={point.lat}
                onChangeText={(val) => updateLokasi(i, 'lat', val)}
              />
            </View>
            <View style={{ width: '50%' }}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                style={styles.inputMetode}
                value={point.lng}
                onChangeText={(val) => updateLokasi(i, 'lng', val)}
              />
            </View>
          </View>
        ))}

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 20 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#208DC0" />
          ) : (
            <>
              <TouchableOpacity style={styles.addbatasText} onPress={addLokasi}>
                <Text style={styles.addbatasxText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addbatasText} onPress={centerToUserLocation}>
                <Text style={styles.addbatasxText}>📍</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addbatasText} onPress={hapusLokasi}>
                <Text style={styles.addbatasxText}>-</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity onPress={sendBackLokasi} style={styles.addbatas}>
          <Text style={styles.addbatasx}>Kirim Lokasi</Text>
        </TouchableOpacity>
      </ScrollView>

      <TabBar />
    </View>
  );
};

export default MetodePolyline;
