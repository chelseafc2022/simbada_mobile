/**
 * SIMBADA Mobile App
 * Sistem Informasi Batas Desa
 *
 * @format
 */

import React, { useEffect } from 'react';

import { store } from './views/redux';
import { Provider, useDispatch } from 'react-redux'
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
import PetaDasar from "./views/peta_dasar/PetaDasar";
import PetaFinal from "./views/peta_final/PetaFinal";
import LihatUsulan from "./views/usulan_peta/LihatUsulan";
import FullMap from './views/monitoring/FullMap';

// === Modul Baru ===
import NavigasiKoordinat from "./views/navigasi/NavigasiKoordinat";
import GeoTagCamera from "./views/geotagging/GeoTagCamera";
import OfflineSync from "./views/offline/OfflineSync";
import NotificationList from "./views/notification/NotificationList";

// === Services ===
import OfflineManager from "./views/library/OfflineManager";
import NotificationService from "./views/library/NotificationService";

const Stack = createNativeStackNavigator();

/**
 * AppContent — komponen dalam Provider untuk akses dispatch
 */
const AppContent = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Setup auto-sync listener untuk offline mode
    const unsubscribe = OfflineManager.setupAutoSync(
      (isOnline) => {
        console.log('[App] Connection status:', isOnline ? 'ONLINE' : 'OFFLINE');
      },
      dispatch
    );

    // Setup notification foreground handler
    const unsubNotif = NotificationService.setupForegroundHandler(
      async (notif) => {
        console.log('[App] Notification received:', notif.title);
        const count = await NotificationService.getUnreadCount();
        dispatch({ type: 'SET_NOTIFICATION_COUNT', payload: count });
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubNotif) unsubNotif();
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

        {/* === Modul Baru === */}
        <Stack.Screen name="NavigasiKoordinat" component={NavigasiKoordinat} />
        <Stack.Screen name="GeoTagCamera" component={GeoTagCamera} />
        <Stack.Screen name="OfflineSync" component={OfflineSync} />
        <Stack.Screen name="NotificationList" component={NotificationList} />
      </Stack.Navigator>
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