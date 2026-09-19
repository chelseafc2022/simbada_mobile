/**
 * SIMBADA Mobile App
 * Sistem Informasi Batas Desa
 *
 * @format
 */

import React, { useEffect, useState } from 'react';

import { store } from './views/redux';
import { Provider, useDispatch, useSelector } from 'react-redux';
import {SafeAreaView,ScrollView,StyleSheet,Text,TouchableOpacity,useColorScheme,View,} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';

import { NavigationContainer, createStaticNavigation, useNavigation } from '@react-navigation/native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

// === Existing Screens ===
import Home from "./views/home/Home";
import Login from "./views/auth/Login";
import Monitoring from "./views/monitoring/Monitoring";
import Zona from "./views/monitoring/Zona";
import Perbandingan from "./views/monitoring/Perbandingan";
import Usulan from "./views/usulan_peta/Usulan";
import AddUsulan from "./views/usulan_peta/AddUsulan";
import EditUsulan from "./views/usulan_peta/EditUsulan";
import MetodeText from "./views/usulan_peta/MetodeText";
import MetodePolyline from "./views/usulan_peta/MetodePolyline";
import User from "./views/user/User";
import KebijakanPrivasi from "./views/user/KebijakanPrivasi";
import PetaDasar from "./views/peta_dasar/PetaDasar";
import PetaFinal from "./views/peta_final/PetaFinal";
import LihatUsulan from "./views/usulan_peta/LihatUsulan";
import FullMap from './views/monitoring/FullMap';

// === Modul Baru ===
import NavigasiKoordinat from "./views/navigasi/NavigasiKoordinat";
import GeoTagCamera from "./views/geotagging/GeoTagCamera";
import OfflineSync from "./views/offline/OfflineSync";
import NotificationList from "./views/notification/NotificationList";

// === Modul PRD: Pemetaan Offline ===
import TrackRecorder from "./views/track_recorder/TrackRecorder";
import TrackHistory from "./views/track_recorder/TrackHistory";
import NavigasiProjected from "./views/navigasi/NavigasiProjected";
import NavigasiPlacemark from "./views/navigasi/NavigasiPlacemark";
import NavigasiRuteManual from "./views/navigasi/NavigasiRuteManual";
import PlacemarkList from "./views/placemark/PlacemarkList";
import PlacemarkForm from "./views/placemark/PlacemarkForm";
import PlacemarkMap from "./views/placemark/PlacemarkMap";
import MapImporter from "./views/peta_offline/MapImporter";
import MapViewer from "./views/peta_offline/MapViewer";
import EksporData from "./views/ekspor/EksporData";
import ForceUpdateModal from "./views/components/ForceUpdateModal";
import VersionCheckService from "./views/library/VersionCheckService";

// === Services ===
import OfflineManager from "./views/library/OfflineManager";
import NotificationService from "./views/library/NotificationService";
import NavigasiService from "./views/library/NavigasiService";
import notifee, { EventType } from "@notifee/react-native";

const Stack = createNativeStackNavigator();

/**
 * AppContent — komponen dalam Provider untuk akses dispatch
 */
const AppContent = () => {
  const dispatch = useDispatch();
  const URL = useSelector((state: any) => state.URL);
  const [updateData, setUpdateData] = useState<any>(null);
  const [showForceUpdate, setShowForceUpdate] = useState<boolean>(false);

  useEffect(() => {
    // Periksa versi aplikasi ke server
    const checkVersion = async () => {
      try {
        const baseUrl = URL?.URL_APP || 'https://server-simbada.konaweselatankab.go.id/';
        const res = await VersionCheckService.checkAppVersion(baseUrl);
        if (res && res.needs_update && res.force_update) {
          setUpdateData(res);
          setShowForceUpdate(true);
        }
      } catch (err) {
        console.log('[App] Version check error:', err);
      }
    };
    checkVersion();
  }, [URL]);

  useEffect(() => {
    // Inisialisasi NavigasiService dan restore sesi jika ada
    NavigasiService.init();
    NavigasiService.restoreSession();

    // Notifee foreground event handler (misal tombol Hentikan di notifikasi)
    const unsubNotifeeForeground = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'stop_nav') {
        await NavigasiService.stopNavigation();
      }
    });

    // Setup auto-sync listener untuk offline mode
    const unsubscribe = OfflineManager.setupAutoSync(
      (isOnline: boolean) => {
        console.log('[App] Connection status:', isOnline ? 'ONLINE' : 'OFFLINE');
      },
      dispatch
    );

    // Setup notification foreground handler
    const unsubNotif = NotificationService.setupForegroundHandler(
      async (notif: any) => {
        console.log('[App] Notification received:', notif.title);
        const count = await NotificationService.getUnreadCount();
        dispatch({ type: 'SET_NOTIFICATION_COUNT', payload: count });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubNotif) unsubNotif();
      if (unsubNotifeeForeground) unsubNotifeeForeground();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Auth */}
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Home" component={Home} />
        
        {/* Monitoring */}
        <Stack.Screen name="Monitoring" component={Monitoring} />
        <Stack.Screen name="Zona" component={Zona} />
        <Stack.Screen name="Perbandingan" component={Perbandingan} />
        <Stack.Screen name="FullMap" component={FullMap} />
        
        {/* Usulan Peta */}
        <Stack.Screen name="MetodeText" component={MetodeText} />
        <Stack.Screen name="MetodePolyline" component={MetodePolyline} />
        <Stack.Screen name="AddUsulan" component={AddUsulan} />
        <Stack.Screen name="EditUsulan" component={EditUsulan} />
        <Stack.Screen name="Usulan" component={Usulan} />
        <Stack.Screen name="LihatUsulan" component={LihatUsulan} />
        
        {/* Peta */}
        <Stack.Screen name="PetaDasar" component={PetaDasar} />
        <Stack.Screen name="PetaFinal" component={PetaFinal} />
        
        {/* User */}
        <Stack.Screen name="User" component={User} />
        <Stack.Screen name="KebijakanPrivasi" component={KebijakanPrivasi} />

        {/* === Modul Baru (Legacy) === */}
        <Stack.Screen name="NavigasiKoordinat" component={NavigasiKoordinat} />
        <Stack.Screen name="GeoTagCamera" component={GeoTagCamera} />
        <Stack.Screen name="OfflineSync" component={OfflineSync} />
        <Stack.Screen name="NotificationList" component={NotificationList} />

        {/* === Modul PRD: Track Recorder === */}
        <Stack.Screen name="TrackRecorder" component={TrackRecorder} />
        <Stack.Screen name="TrackHistory" component={TrackHistory} />

        {/* === Modul PRD: Navigasi === */}
        <Stack.Screen name="NavigasiProjected" component={NavigasiProjected} />
        <Stack.Screen name="NavigasiPlacemark" component={NavigasiPlacemark} />
        <Stack.Screen name="NavigasiRuteManual" component={NavigasiRuteManual} />

        {/* === Modul PRD: Placemark === */}
        <Stack.Screen name="PlacemarkList" component={PlacemarkList} />
        <Stack.Screen name="PlacemarkForm" component={PlacemarkForm} />
        <Stack.Screen name="PlacemarkMap" component={PlacemarkMap} />

        {/* === Modul PRD: Peta Offline === */}
        <Stack.Screen name="MapImporter" component={MapImporter} />
        <Stack.Screen name="MapViewer" component={MapViewer} />

        {/* === Modul PRD: Ekspor Data === */}
        <Stack.Screen name="EksporData" component={EksporData} />
      </Stack.Navigator>

      {/* Dialog Pembaruan Wajib Server (Force Update) */}
      <ForceUpdateModal visible={showForceUpdate} updateData={updateData} />
    </NavigationContainer>
  );
};

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

const styles = StyleSheet.create({
  
});

export default App;