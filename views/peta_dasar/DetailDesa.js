import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, ScrollView } from 'react-native';
import MapView, { Polygon, Marker } from 'react-native-maps';
import { useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';

const DetailDesa = () => {
  const route = useRoute();
  const TOKEN = useSelector(state => state.TOKEN);
// const profile = useSelector(state => state.PROFILE);
const url = useSelector(state => state.URL);

  const [isLoading, setIsLoading] = useState(true);
  const [desaDetail, setDesaDetail] = useState(null);
  const [polygonCoordinates, setPolygonCoordinates] = useState([]);
  const [centroid, setCentroid] = useState({ latitude: 0, longitude: 0 });

  useEffect(() => {
    const fetchDesaDetail = async () => {
      try {
        const response = await fetch(url.URL_HOME + 'petadasar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `kikensbatara ${TOKEN}`
          },
          body: JSON.stringify({ id_desa: route.params.id_desa }),
        });

        const data = await response.json();
        setDesaDetail(data);
        const coordinates = data.lokasi.coordinat.map(coord => ({
          latitude: parseFloat(coord.lat),
          longitude: parseFloat(coord.lng),
        }));
        setPolygonCoordinates(coordinates);
        calculateCentroid(coordinates);
      } catch (error) {
        Alert.alert('Error', 'Gagal mengambil detail desa');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDesaDetail();
  }, [route.params.id_desa]);

  const calculateCentroid = (coordinates) => {
    const totalLat = coordinates.reduce((sum, point) => sum + point.latitude, 0);
    const totalLng = coordinates.reduce((sum, point) => sum + point.longitude, 0);
    setCentroid({
      latitude: totalLat / coordinates.length,
      longitude: totalLng / coordinates.length,
    });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#208DC0" />
      ) : (
        <View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Detail Lokasi Desa</Text>
          <Text>Nama Desa: {desaDetail.nama}</Text>
          <Text>Nama Kecamatan: {desaDetail.nama_kecamatan}</Text>
          <Text>Luas Area: {calculateArea(polygonCoordinates)} km²</Text>
          
          <MapView
            style={{ height: 400, marginVertical: 20 }}
            initialRegion={{
              latitude: centroid.latitude,
              longitude: centroid.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Polygon
              coordinates={polygonCoordinates}
              strokeColor="#FF0000"
              fillColor="rgba(255, 0, 0, 0.5)"
            />
            <Marker coordinate={centroid} title="Centroid" description="Titik tengah desa" />
          </MapView>

          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Titik Koordinat:</Text>
          {polygonCoordinates.map((coord, index) => (
            <Text key={index}>
              {index + 1}. Lat: {coord.latitude}, Lng: {coord.longitude}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const calculateArea = (coordinates) => {
  // Contoh sederhana untuk menghitung luas area dari polygon (dianggap planar)
  if (coordinates.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const { latitude: x1, longitude: y1 } = coordinates[i];
    const { latitude: x2, longitude: y2 } = coordinates[(i + 1) % coordinates.length];
    area += (x1 * y2 - x2 * y1);
  }
  return Math.abs(area / 2).toFixed(2);
};

export default DetailDesa;
